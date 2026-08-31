import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { ControlApiError } from "./errors.js";
import type { ControlEndpointDescriptor } from "./types.js";

const execFileAsync = promisify(execFile);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function controlPaths(dataRoot: string): Readonly<{
  descriptorPath: string;
  tokenFilePath: string;
  lockFilePath: string;
}> {
  const root = resolve(dataRoot);
  return Object.freeze({
    descriptorPath: join(root, "state", "runtime", "control-endpoint.json"),
    tokenFilePath: join(root, "secrets", "runtime", "control-api.token"),
    lockFilePath: join(root, "state", "runtime", "control-api.lock"),
  });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function acquireRuntimeLock(
  dataRoot: string,
  instanceId: string,
): Promise<() => Promise<void>> {
  const { lockFilePath } = controlPaths(dataRoot);
  await mkdir(dirname(lockFilePath), { recursive: true, mode: 0o700 });
  const content = `${JSON.stringify({ instanceId, pid: process.pid })}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockFilePath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return async (): Promise<void> => {
        try {
          if ((await readFile(lockFilePath, "utf8")) === content)
            await rm(lockFilePath, { force: true });
        } catch {
          // A missing or replaced lock is never removed by an older runtime.
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const current = JSON.parse(await readFile(lockFilePath, "utf8")) as unknown;
        const pid =
          typeof current === "object" && current !== null
            ? (current as Record<string, unknown>)["pid"]
            : undefined;
        if (typeof pid === "number" && Number.isSafeInteger(pid) && processExists(pid)) {
          throw new ControlApiError(
            "CONTROL_RUNTIME_ALREADY_ACTIVE",
            "A control runtime is already active",
          );
        }
      } catch (readError) {
        if (readError instanceof ControlApiError) throw readError;
      }
      await rm(lockFilePath, { force: true });
    }
  }
  throw new ControlApiError(
    "CONTROL_RUNTIME_LOCK_FAILED",
    "Runtime instance lock could not be acquired",
  );
}

function isWithin(root: string, candidate: string): boolean {
  const delta = relative(root, candidate);
  return delta === "" || (!delta.startsWith(`..${sep}`) && delta !== ".." && !isAbsolute(delta));
}

async function fsyncFile(path: string): Promise<void> {
  // Windows requires a write-capable handle for FlushFileBuffers.
  const handle = await open(path, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function replaceAtomically(path: string, content: string, mode: number): Promise<void> {
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode });
    await fsyncFile(temporary);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function applyWindowsUserOnlyAcl(path: string): Promise<void> {
  const identity =
    process.env["USERDOMAIN"] === undefined
      ? userInfo().username
      : `${process.env["USERDOMAIN"]}\\${userInfo().username}`;
  try {
    await execFileAsync("icacls.exe", [path, "/inheritance:r", "/grant:r", `${identity}:(F)`], {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const { stdout } = await execFileAsync("icacls.exe", [path], {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const lower = stdout.toLowerCase();
    if (!lower.includes(userInfo().username.toLowerCase()) || lower.includes("everyone:")) {
      throw new Error("ACL verification rejected an inherited or public principal");
    }
  } catch (error) {
    throw new ControlApiError("CONTROL_TOKEN_ACL_UNSAFE", "Token ACL could not be made user-only", {
      cause: error,
    });
  }
}

async function verifyPosixUserOnly(path: string): Promise<void> {
  await chmod(path, 0o600);
  const metadata = await stat(path);
  if ((metadata.mode & 0o077) !== 0) {
    throw new ControlApiError(
      "CONTROL_TOKEN_ACL_UNSAFE",
      "Token file permissions are not user-only",
    );
  }
}

export async function createSecureToken(path: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  try {
    await replaceAtomically(path, `${token}\n`, 0o600);
    if (process.platform === "win32") await applyWindowsUserOnlyAcl(path);
    else await verifyPosixUserOnly(path);
    return token;
  } catch (error) {
    await rm(path, { force: true });
    if (error instanceof ControlApiError) throw error;
    throw new ControlApiError(
      "CONTROL_TOKEN_CREATE_FAILED",
      "Control token could not be created safely",
      {
        cause: error,
      },
    );
  }
}

export async function writeDescriptor(
  path: string,
  descriptor: ControlEndpointDescriptor,
): Promise<void> {
  try {
    await replaceAtomically(path, `${JSON.stringify(descriptor, undefined, 2)}\n`, 0o600);
  } catch (error) {
    throw new ControlApiError(
      "CONTROL_DESCRIPTOR_WRITE_FAILED",
      "Endpoint descriptor write failed",
      {
        cause: error,
      },
    );
  }
}

function validateDescriptor(value: unknown, dataRoot: string): ControlEndpointDescriptor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ControlApiError("CONTROL_DESCRIPTOR_INVALID", "Endpoint descriptor is not an object");
  }
  const descriptor = value as Record<string, unknown>;
  const keys = Object.keys(descriptor).sort().join(",");
  const expected = [
    "apiVersions",
    "frameworkVersion",
    "host",
    "instanceId",
    "pid",
    "port",
    "releaseId",
    "schemaVersion",
    "startedAt",
    "tokenFileRef",
  ]
    .sort()
    .join(",");
  const tokenRef = descriptor["tokenFileRef"];
  const tokenPath = typeof tokenRef === "string" ? resolve(dataRoot, tokenRef) : "";
  if (
    keys !== expected ||
    descriptor["schemaVersion"] !== "1.0.0" ||
    typeof descriptor["instanceId"] !== "string" ||
    !Number.isSafeInteger(descriptor["pid"]) ||
    Number(descriptor["pid"]) < 1 ||
    typeof descriptor["startedAt"] !== "string" ||
    !Number.isFinite(Date.parse(descriptor["startedAt"])) ||
    descriptor["host"] !== "127.0.0.1" ||
    !Number.isSafeInteger(descriptor["port"]) ||
    Number(descriptor["port"]) < 1 ||
    Number(descriptor["port"]) > 65_535 ||
    !Array.isArray(descriptor["apiVersions"]) ||
    descriptor["apiVersions"].length !== 1 ||
    descriptor["apiVersions"][0] !== "v1" ||
    typeof descriptor["frameworkVersion"] !== "string" ||
    typeof descriptor["releaseId"] !== "string" ||
    typeof tokenRef !== "string" ||
    isAbsolute(tokenRef) ||
    !isWithin(resolve(dataRoot), tokenPath)
  ) {
    throw new ControlApiError(
      "CONTROL_DESCRIPTOR_INVALID",
      "Endpoint descriptor failed validation",
    );
  }
  return value as ControlEndpointDescriptor;
}

export async function discoverControlEndpoint(
  dataRoot: string,
): Promise<ControlEndpointDescriptor> {
  const { descriptorPath } = controlPaths(dataRoot);
  let parsed: unknown;
  try {
    const text = await readFile(descriptorPath, { encoding: "utf8" });
    if (Buffer.byteLength(text) > 16 * 1024) throw new Error("descriptor too large");
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new ControlApiError(
      "CONTROL_DESCRIPTOR_UNAVAILABLE",
      "Endpoint descriptor is unavailable",
      {
        cause: error,
      },
    );
  }
  return validateDescriptor(parsed, resolve(dataRoot));
}

export async function readControlToken(
  dataRoot: string,
  descriptor: ControlEndpointDescriptor,
): Promise<string> {
  const root = resolve(dataRoot);
  const path = resolve(root, descriptor.tokenFileRef);
  if (!isWithin(root, path)) {
    throw new ControlApiError("CONTROL_TOKEN_REF_UNSAFE", "Token reference escapes the data root");
  }
  try {
    const token = (await readFile(path, { encoding: "utf8" })).trim();
    if (!TOKEN_PATTERN.test(token)) throw new Error("invalid token format");
    return token;
  } catch (error) {
    throw new ControlApiError("CONTROL_TOKEN_UNAVAILABLE", "Control token is unavailable", {
      cause: error,
    });
  }
}

export async function removeControlFiles(dataRoot: string): Promise<void> {
  const paths = controlPaths(dataRoot);
  await Promise.all([
    rm(paths.descriptorPath, { force: true }),
    rm(paths.tokenFilePath, { force: true }),
  ]);
}
