import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { ControlApiError } from "./errors.js";
import type { ControlEndpointDescriptor } from "./types.js";

const execFileAsync = promisify(execFile);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SEMANTIC_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const TOKEN_REF_PATTERN = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;

function windowsSystemExecutable(name: "icacls.exe" | "whoami.exe"): string {
  const windowsRoot = process.env["SystemRoot"] ?? "C:\\Windows";
  if (!isAbsolute(windowsRoot) || windowsRoot.includes("\0")) {
    throw new Error("The Windows system root is not an absolute host path");
  }
  return join(windowsRoot, "System32", name);
}

function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/u.exec(
      value,
    );
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    daysInMonth !== undefined &&
    day <= daysInMonth &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6]) <= 60 &&
    (match[8] === undefined || Number(match[8]) <= 23) &&
    (match[9] === undefined || Number(match[9]) <= 59)
  );
}

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

async function currentWindowsIdentity(): Promise<string> {
  const { stdout } = await execFileAsync(windowsSystemExecutable("whoami.exe"), [], {
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: 64 * 1024,
  });
  const identity = stdout.trim();
  if (identity === "") throw new Error("Current Windows identity is unavailable");
  return identity;
}

export function windowsAclOutputIsUserOnly(
  stdout: string,
  pathSpellings: readonly string[],
  identity: string,
  computerName: string | undefined,
  requireChildInheritance: boolean,
): boolean {
  const normalizedIdentity = identity.trim().toLowerCase();
  if (normalizedIdentity === "") return false;
  const allowedPrincipals = new Set([normalizedIdentity]);
  const separator = normalizedIdentity.indexOf("\\");
  const normalizedComputerName = computerName?.trim().toLowerCase();
  if (
    separator > 0 &&
    separator < normalizedIdentity.length - 1 &&
    normalizedIdentity.slice(0, separator) === normalizedComputerName
  ) {
    allowedPrincipals.add(normalizedIdentity.slice(separator + 1));
  }
  const normalizedPaths = [...pathSpellings]
    .filter((candidate) => candidate !== "")
    .sort((left, right) => right.length - left.length)
    .map((candidate) => ({ length: candidate.length, value: candidate.toLowerCase() }));
  const aclLines: string[] = [];
  for (const rawLine of stdout.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    if (!rawLine.includes(":(")) continue;
    let aclLine = rawLine;
    if (aclLines.length === 0) {
      const normalizedLine = rawLine.toLowerCase();
      const pathPrefix = normalizedPaths.find(
        (candidate) =>
          normalizedLine.startsWith(candidate.value) &&
          /^\s$/u.test(rawLine.charAt(candidate.length)),
      );
      if (pathPrefix === undefined) return false;
      aclLine = rawLine.slice(pathPrefix.length);
    }
    aclLines.push(aclLine.trim());
  }
  if (aclLines.length === 0) return false;
  const principals = aclLines.map((line) => line.slice(0, line.indexOf(":(")).trim().toLowerCase());
  const identityLines = aclLines.filter((_, index) =>
    allowedPrincipals.has(principals[index] ?? ""),
  );
  return (
    identityLines.length === 1 &&
    identityLines[0]?.includes("(F)") === true &&
    !identityLines[0].includes("(DENY)") &&
    (!requireChildInheritance ||
      (identityLines[0].includes("(OI)") && identityLines[0].includes("(CI)"))) &&
    principals.every((principal) => allowedPrincipals.has(principal)) &&
    aclLines.every((line) => !line.includes("(I)"))
  );
}

async function assertWindowsUserOnlyAcl(
  path: string,
  identity: string,
  requireChildInheritance: boolean,
): Promise<void> {
  const { stdout } = await execFileAsync(windowsSystemExecutable("icacls.exe"), [path], {
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: 64 * 1024,
  });
  const canonicalPath = await realpath(path);
  if (
    !windowsAclOutputIsUserOnly(
      stdout,
      [path, canonicalPath],
      identity,
      process.env["COMPUTERNAME"],
      requireChildInheritance,
    )
  ) {
    throw new Error("ACL verification permits only the current user without inherited access");
  }
}

async function applyWindowsUserOnlyAcl(
  path: string,
  identity: string,
  inheritToChildren = false,
): Promise<void> {
  let operation = "GRANT_CURRENT_USER";
  try {
    const icacls = windowsSystemExecutable("icacls.exe");
    const options = {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    } as const;
    const grant = `${identity}:${inheritToChildren ? "(OI)(CI)" : ""}(F)`;
    // Grant the user explicitly before removing inherited entries so a partial failure never
    // leaves the current process without an access rule for the path it must verify or clean up.
    await execFileAsync(icacls, [path, "/grant:r", grant], options);
    operation = "REMOVE_INHERITANCE";
    await execFileAsync(icacls, [path, "/inheritance:r"], options);
    // Owner reassignment is not needed to establish a user-only DACL and can require
    // SeTakeOwnershipPrivilege/SeRestorePrivilege on hosted or otherwise restricted runners.
    // The explicit Full Control rule is sufficient for the current process to verify and clean up.
    operation = "VERIFY_USER_ONLY_DACL";
    await assertWindowsUserOnlyAcl(path, identity, inheritToChildren);
  } catch (error) {
    throw new ControlApiError(
      "CONTROL_TOKEN_ACL_UNSAFE",
      `Token ACL could not be made user-only during ${operation}`,
      { cause: error },
    );
  }
}

async function assertPosixUserOnly(path: string): Promise<void> {
  const metadata = await stat(path);
  if ((metadata.mode & 0o077) !== 0) {
    throw new ControlApiError(
      "CONTROL_TOKEN_ACL_UNSAFE",
      "Token file permissions are not user-only",
    );
  }
}

async function replaceWindowsTokenAtomically(path: string, content: string): Promise<void> {
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const identity = await currentWindowsIdentity();
  await applyWindowsUserOnlyAcl(parent, identity, true);
  const temporary = `${path}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
    await applyWindowsUserOnlyAcl(temporary, identity);
    const handle = await open(temporary, "r+");
    try {
      await handle.writeFile(content, { encoding: "utf8" });
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertWindowsUserOnlyAcl(temporary, identity, false);
    await rename(temporary, path);
    await assertWindowsUserOnlyAcl(path, identity, false);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function verifyControlPathUserOnly(path: string): Promise<void> {
  try {
    if (process.platform === "win32") {
      await assertWindowsUserOnlyAcl(path, await currentWindowsIdentity(), false);
    } else {
      await assertPosixUserOnly(path);
    }
  } catch (error) {
    if (error instanceof ControlApiError) throw error;
    throw new ControlApiError("CONTROL_TOKEN_ACL_UNSAFE", "Token ACL is not user-only", {
      cause: error,
    });
  }
}

export async function createSecureToken(path: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  try {
    if (process.platform === "win32") {
      await replaceWindowsTokenAtomically(path, `${token}\n`);
    } else {
      await replaceAtomically(path, `${token}\n`, 0o600);
      await chmod(path, 0o600);
      await assertPosixUserOnly(path);
    }
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
    !UUID_V7_PATTERN.test(descriptor["instanceId"]) ||
    !Number.isSafeInteger(descriptor["pid"]) ||
    Number(descriptor["pid"]) < 1 ||
    Number(descriptor["pid"]) > 2_147_483_647 ||
    !isRfc3339DateTime(descriptor["startedAt"]) ||
    descriptor["host"] !== "127.0.0.1" ||
    !Number.isSafeInteger(descriptor["port"]) ||
    Number(descriptor["port"]) < 1 ||
    Number(descriptor["port"]) > 65_535 ||
    !Array.isArray(descriptor["apiVersions"]) ||
    descriptor["apiVersions"].length < 1 ||
    !descriptor["apiVersions"].every(
      (version) => typeof version === "string" && /^v[1-9][0-9]*$/u.test(version),
    ) ||
    new Set(descriptor["apiVersions"]).size !== descriptor["apiVersions"].length ||
    typeof descriptor["frameworkVersion"] !== "string" ||
    !SEMANTIC_VERSION_PATTERN.test(descriptor["frameworkVersion"]) ||
    typeof descriptor["releaseId"] !== "string" ||
    descriptor["releaseId"].length < 1 ||
    descriptor["releaseId"].length > 256 ||
    typeof tokenRef !== "string" ||
    tokenRef.length < 1 ||
    tokenRef.length > 512 ||
    !TOKEN_REF_PATTERN.test(tokenRef) ||
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
