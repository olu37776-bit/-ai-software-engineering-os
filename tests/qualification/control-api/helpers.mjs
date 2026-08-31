/* global TextDecoder, clearTimeout, fetch, setTimeout */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { startControlApi } from "@aseos/platform";

const execFileAsync = promisify(execFile);

export async function withControlApi(run, options = {}) {
  const dataRoot = await mkdtemp(join(tmpdir(), "aseos-p1-v07-"));
  const runtime = await startControlApi({
    dataRoot,
    frameworkVersion: "0.1.0",
    releaseId: "p1-v07-qualification",
    ...options,
  });
  try {
    return await run({ dataRoot, runtime });
  } finally {
    await runtime.stop();
    await rm(dataRoot, { force: true, recursive: true });
  }
}

export async function readBearer(runtime) {
  return (await readFile(runtime.tokenFilePath, "utf8")).trim();
}

export function endpointUrl(runtime, path) {
  return `http://${runtime.descriptor.host}:${String(runtime.descriptor.port)}${path}`;
}

export async function authenticatedFetch(runtime, path, init = {}) {
  const token = await readBearer(runtime);
  return fetch(endpointUrl(runtime, path), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      host: `${runtime.descriptor.host}:${String(runtime.descriptor.port)}`,
      ...(init.headers ?? {}),
    },
  });
}

export async function rawHttpRequest(runtime, path, headers) {
  const response = await new Promise((resolvePromise, reject) => {
    const outgoing = request(
      {
        host: "127.0.0.1",
        port: runtime.descriptor.port,
        method: "GET",
        path,
        headers,
      },
      resolvePromise,
    );
    outgoing.once("error", reject);
    outgoing.end();
  });
  const chunks = [];
  for await (const chunk of response) chunks.push(Buffer.from(chunk));
  return {
    status: response.statusCode ?? 0,
    headers: response.headers,
    body: Buffer.concat(chunks).toString("utf8"),
  };
}

export async function tokenAclEvidence(path) {
  if (process.platform !== "win32") {
    const metadata = await stat(path);
    return {
      platform: process.platform,
      userOnly: (metadata.mode & 0o077) === 0,
      mode: (metadata.mode & 0o777).toString(8).padStart(3, "0"),
    };
  }
  const { stdout } = await execFileAsync("icacls.exe", [path], {
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: 64 * 1024,
  });
  const normalized = stdout.toLowerCase();
  return {
    platform: process.platform,
    userOnly:
      normalized.includes(userInfo().username.toLowerCase()) &&
      !normalized.includes("everyone:") &&
      !normalized.includes("authenticated users:"),
    acl: stdout.trim(),
  };
}

export async function readSseRecord(response, timeoutMs = 2_000) {
  if (response.body === null) throw new Error("SSE_RESPONSE_BODY_MISSING");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const timer = setTimeout(() => void reader.cancel("timeout"), timeoutMs);
  try {
    while (!buffer.includes("\n\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
    await reader.cancel("qualification frame consumed");
  }
  const record = buffer.split("\n\n", 1)[0] ?? "";
  const fields = Object.fromEntries(
    record
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator), line.slice(separator + 1).trimStart()];
      }),
  );
  return fields;
}
