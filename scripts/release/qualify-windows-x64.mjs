#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyReleaseManifest } from "./verify-manifest.mjs";

const DEFAULT_TIMEOUT_MS = 30_000;
const NETWORK_GUARD_MECHANISM = "NODE_OPTIONS_ESM_BUILTIN_NETWORK_GUARD_V1";
const EVIDENCE_TYPES = Object.freeze([
  "SelfContainedArtifactResult",
  "ReleaseManifestConsistencyResult",
  "CleanWindowsStartupResult",
]);

const NETWORK_GUARD_SOURCE = String.raw`
import { appendFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { resolve as resolvePath } from "node:path";
import { syncBuiltinESMExports } from "node:module";

const logPath = process.env.ASEOS_NETWORK_GUARD_LOG;
if (!logPath) throw new Error("ASEOS_NETWORK_GUARD_LOG_REQUIRED");
const record = (entry) => appendFileSync(logPath, JSON.stringify({ pid: process.pid, ...entry }) + "\n", "utf8");
const normalizeHost = (value) => {
  if (typeof value !== "string") return "";
  let host = value.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.startsWith("::ffff:")) host = host.slice(7);
  if (/^127(?:\.\d{1,3}){3}$/u.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.every((octet) => octet >= 0 && octet <= 255)) return host;
  }
  return host;
};
const isLoopback = (host) => {
  const normalized = normalizeHost(host);
  return normalized === "::1" || normalized.startsWith("127.");
};
const guard = (kind, host) => {
  const normalized = normalizeHost(host);
  if (isLoopback(normalized)) {
    record({ kind, host: normalized, decision: "ALLOW_LOOPBACK" });
    return;
  }
  record({ kind, host: normalized || "UNSPECIFIED", decision: "BLOCK_NON_LOOPBACK" });
  const error = new Error("ASEOS_NON_LOOPBACK_NETWORK_BLOCKED:" + kind + ":" + (normalized || "UNSPECIFIED"));
  error.code = "ASEOS_NON_LOOPBACK_NETWORK_BLOCKED";
  throw error;
};
const netHost = (args) => {
  const first = args[0];
  if (first && typeof first === "object") return first.host ?? "127.0.0.1";
  if (typeof first === "number") return typeof args[1] === "string" ? args[1] : "127.0.0.1";
  if (typeof first === "string") return null;
  return "";
};
const urlHost = (args, protocol) => {
  const first = args[0];
  if (first instanceof URL || typeof first === "string") return new URL(first, protocol + "//invalid.invalid").hostname;
  if (first && typeof first === "object") {
    if (typeof first.hostname === "string") return first.hostname;
    if (typeof first.host === "string") {
      if (first.host.startsWith("[")) return first.host.slice(1, first.host.indexOf("]"));
      return first.host.split(":")[0];
    }
  }
  return "";
};
const wrapNet = (original, kind) => function (...args) {
  const host = netHost(args);
  if (host !== null) guard(kind, host);
  else record({ kind, host: "LOCAL_IPC", decision: "ALLOW_LOCAL_IPC" });
  return Reflect.apply(original, this, args);
};
net.connect = wrapNet(net.connect, "net.connect");
net.createConnection = wrapNet(net.createConnection, "net.createConnection");
net.Socket.prototype.connect = wrapNet(net.Socket.prototype.connect, "net.Socket.connect");
tls.connect = wrapNet(tls.connect, "tls.connect");
const wrapRequest = (original, kind, protocol) => function (...args) {
  guard(kind, urlHost(args, protocol));
  return Reflect.apply(original, this, args);
};
http.request = wrapRequest(http.request, "http.request", "http:");
http.get = wrapRequest(http.get, "http.get", "http:");
https.request = wrapRequest(https.request, "https.request", "https:");
https.get = wrapRequest(https.get, "https.get", "https:");
const originalDgramConnect = dgram.Socket.prototype.connect;
dgram.Socket.prototype.connect = function (port, address, callback) {
  guard("dgram.connect", typeof address === "string" ? address : "127.0.0.1");
  return Reflect.apply(originalDgramConnect, this, [port, address, callback]);
};
const originalDgramSend = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (...args) {
  const address = args.find((value, index) => index > 0 && typeof value === "string");
  if (address !== undefined) guard("dgram.send", address);
  return Reflect.apply(originalDgramSend, this, args);
};
const wrapDns = (original, kind) => function (host, ...args) {
  guard(kind, host);
  return Reflect.apply(original, this, [host, ...args]);
};
const resolverMethods = [
  "lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa",
  "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv",
  "resolveTxt", "reverse",
];
for (const name of resolverMethods) {
  if (typeof dns[name] === "function") dns[name] = wrapDns(dns[name], "dns." + name);
  if (typeof dnsPromises[name] === "function") dnsPromises[name] = wrapDns(dnsPromises[name], "dns.promises." + name);
}
const dnsServerHost = (server) => {
  if (typeof server !== "string") return "";
  if (server.startsWith("[")) {
    const end = server.indexOf("]");
    return end > 0 ? server.slice(1, end) : server;
  }
  const separator = server.lastIndexOf(":");
  if (separator > 0 && server.indexOf(":") === separator && /^\d+$/u.test(server.slice(separator + 1))) {
    return server.slice(0, separator);
  }
  return server;
};
const guardResolverPrototype = (Resolver, prefix) => {
  if (typeof Resolver !== "function") return;
  for (const name of resolverMethods.filter((method) => method.startsWith("resolve") || method === "reverse")) {
    if (typeof Resolver.prototype[name] === "function") {
      Resolver.prototype[name] = wrapDns(Resolver.prototype[name], prefix + "." + name);
    }
  }
  if (typeof Resolver.prototype.setServers === "function") {
    const originalSetServers = Resolver.prototype.setServers;
    Resolver.prototype.setServers = function (servers) {
      if (!Array.isArray(servers)) guard(prefix + ".setServers", "");
      for (const server of servers) guard(prefix + ".setServers", dnsServerHost(server));
      return Reflect.apply(originalSetServers, this, [servers]);
    };
  }
};
guardResolverPrototype(dns.Resolver, "dns.Resolver");
guardResolverPrototype(dnsPromises.Resolver, "dns.promises.Resolver");
if (typeof globalThis.fetch === "function") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    const url = input instanceof URL || typeof input === "string" ? new URL(input) : new URL(input.url);
    guard("fetch", url.hostname);
    return Reflect.apply(originalFetch, this, [input, init]);
  };
}
if (typeof globalThis.WebSocket === "function") {
  const OriginalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      guard("WebSocket", new URL(url).hostname);
      super(url, protocols);
    }
  };
}
syncBuiltinESMExports();
record({
  kind: "guard",
  decision: "INSTALLED",
  entrypoint: process.argv[1] ? resolvePath(process.argv[1]) : null,
});
`;

function parseArguments(arguments_) {
  const result = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === undefined || !name.startsWith("--") || value === undefined) {
      throw new Error("QUALIFICATION_ARGUMENTS_INVALID");
    }
    result[name.slice(2)] = value;
  }
  return result;
}

function requiredOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`QUALIFICATION_OPTION_REQUIRED:${name}`);
  }
  return value;
}

function safePayloadPath(root, value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\")) {
    throw new Error("QUALIFICATION_PAYLOAD_PATH_INVALID");
  }
  const candidate = resolve(root, ...value.split("/"));
  const boundary = `${resolve(root)}${sep}`;
  if (!candidate.startsWith(boundary) || relative(root, candidate).startsWith("..")) {
    throw new Error("QUALIFICATION_PAYLOAD_PATH_ESCAPE");
  }
  return candidate;
}

export function sanitizedWindowsEnvironment(source = process.env) {
  const keep = [
    "ALLUSERSPROFILE",
    "APPDATA",
    "COMPUTERNAME",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "OS",
    "PROCESSOR_ARCHITECTURE",
    "PROCESSOR_IDENTIFIER",
    "ProgramData",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERDOMAIN",
    "USERNAME",
    "USERPROFILE",
    "windir",
  ];
  const environment = {};
  for (const name of keep) {
    if (typeof source[name] === "string") environment[name] = source[name];
  }
  environment.PATH = "";
  environment.Path = "";
  environment.PATHEXT = "";
  environment.NODE_PATH = "";
  environment.PNPM_HOME = "";
  environment.ASEOS_QUALIFICATION_NO_DEVELOPMENT_TOOLCHAIN = "1";
  return Object.freeze(environment);
}

function runFile(executable, arguments_, { cwd, env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      if (!settled)
        rejectPromise(new Error(`QUALIFICATION_COMMAND_TIMEOUT:${arguments_[0] ?? ""}`));
      settled = true;
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) rejectPromise(error);
      settled = true;
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        rejectPromise(
          new Error(
            `QUALIFICATION_COMMAND_FAILED:${arguments_[0] ?? ""}:${String(code)}:${signal ?? ""}:${errorOutput}`,
          ),
        );
        return;
      }
      resolvePromise({ stdout: output, stderr: errorOutput });
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function defaultShutdownProbe({ pid, descriptorPath, tokenFilePath }) {
  return Object.freeze({
    processRunning: processExists(pid),
    descriptorPresent: await pathExists(descriptorPath),
    tokenPresent: await pathExists(tokenFilePath),
  });
}

export async function waitForRuntimeShutdown({
  pid,
  descriptorPath,
  tokenFilePath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  probe = defaultShutdownProbe,
}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  do {
    last = await probe({ pid, descriptorPath, tokenFilePath });
    if (
      last?.processRunning === false &&
      last.descriptorPresent === false &&
      last.tokenPresent === false
    ) {
      return Object.freeze({ processExited: true, discoveryRemoved: true, tokenRemoved: true });
    }
    await delay(50);
  } while (Date.now() < deadline);
  throw new Error(
    `QUALIFICATION_SHUTDOWN_TIMEOUT:${String(last?.processRunning)}:${String(last?.descriptorPresent)}:${String(last?.tokenPresent)}`,
  );
}

async function readRuntimePid(dataRoot) {
  for (const path of [
    join(dataRoot, "state", "runtime", "control-endpoint.json"),
    join(dataRoot, "state", "runtime", "control-api.lock"),
  ]) {
    try {
      const value = JSON.parse(await readFile(path, "utf8"));
      if (Number.isSafeInteger(value?.pid) && value.pid > 0 && value.pid !== process.pid) {
        return value.pid;
      }
    } catch {
      // Discovery is best-effort here; the caller continues polling both authoritative files.
    }
  }
  return undefined;
}

async function readNetworkEvents(path) {
  if (!(await pathExists(path))) return [];
  return (await readFile(path, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function selectRuntimeAuditPids(events, runtimeEntry) {
  const expectedEntrypoint = resolve(runtimeEntry);
  const pids = new Set();
  for (const event of events) {
    if (
      event?.kind === "guard" &&
      event.decision === "INSTALLED" &&
      typeof event.entrypoint === "string" &&
      resolve(event.entrypoint) === expectedEntrypoint &&
      Number.isSafeInteger(event.pid) &&
      event.pid > 0 &&
      event.pid !== process.pid
    ) {
      pids.add(event.pid);
    }
  }
  return Object.freeze([...pids]);
}

async function qualifyNetworkGuard({ nodeExecutable, guardPath, workspace, baseEnvironment }) {
  const negativeLog = join(workspace, "network-guard-negative.jsonl");
  const environment = {
    ...baseEnvironment,
    NODE_OPTIONS: `--import=${pathToFileURL(guardPath).href}`,
    ASEOS_NETWORK_GUARD_LOG: negativeLog,
  };
  await runFile(
    nodeExecutable,
    [
      "--input-type=module",
      "--eval",
      `import { Socket } from "node:net";
import { get } from "node:http";
import { Resolver as CallbackResolver, resolve4 } from "node:dns";
import { Resolver as PromiseResolver } from "node:dns/promises";
const blocked = (operation) => {
  try { operation(); } catch (error) {
    if (error?.code === "ASEOS_NON_LOOPBACK_NETWORK_BLOCKED") return;
    throw error;
  }
  throw new Error("NETWORK_GUARD_DID_NOT_BLOCK");
};
blocked(() => new Socket().connect({ host: "203.0.113.1", port: 9 }));
blocked(() => get("http://203.0.113.1/"));
blocked(() => fetch("https://203.0.113.1/"));
blocked(() => resolve4("example.invalid", () => {}));
blocked(() => new CallbackResolver().resolve4("example.invalid", () => {}));
blocked(() => new PromiseResolver().resolve4("example.invalid"));
blocked(() => new CallbackResolver().setServers(["8.8.8.8"]));
blocked(() => new PromiseResolver().setServers(["[2001:4860:4860::8888]:53"]));`,
    ],
    { cwd: workspace, env: environment },
  );
  const events = await readNetworkEvents(negativeLog);
  const blocked = events.filter((event) => event.decision === "BLOCK_NON_LOOPBACK");
  if (
    blocked.length !== 8 ||
    !blocked.some((event) => event.kind === "net.Socket.connect") ||
    !blocked.some((event) => event.kind === "http.get") ||
    !blocked.some((event) => event.kind === "fetch") ||
    !blocked.some((event) => event.kind === "dns.resolve4") ||
    !blocked.some((event) => event.kind === "dns.Resolver.resolve4") ||
    !blocked.some((event) => event.kind === "dns.promises.Resolver.resolve4") ||
    !blocked.some((event) => event.kind === "dns.Resolver.setServers") ||
    !blocked.some((event) => event.kind === "dns.promises.Resolver.setServers")
  ) {
    throw new Error("QUALIFICATION_NETWORK_GUARD_NEGATIVE_PROBE_FAILED");
  }
  return Object.freeze({ mechanism: NETWORK_GUARD_MECHANISM, negativeProbeBlocked: true });
}

async function cleanupDiscoveredRuntime({
  dataRoot,
  nodeExecutable,
  cliEntry,
  installRoot,
  environment,
  preferredPid,
  networkLogPath,
  runtimeEntry,
}) {
  const candidatePids = new Set();
  if (preferredPid !== undefined) candidatePids.add(preferredPid);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const discoveredPid = await readRuntimePid(dataRoot);
    if (discoveredPid !== undefined) candidatePids.add(discoveredPid);
    try {
      for (const pid of selectRuntimeAuditPids(
        await readNetworkEvents(networkLogPath),
        runtimeEntry,
      ))
        candidatePids.add(pid);
    } catch {
      // A concurrently appended final JSONL record is retried on the next poll.
    }
    if (candidatePids.size > 0) break;
    await delay(50);
  }
  try {
    await runFile(nodeExecutable, [cliEntry, "stop", "--data-root", dataRoot], {
      cwd: installRoot,
      env: environment,
      timeoutMs: 5_000,
    });
  } catch {
    // A partially started runtime may not have enough discovery data for a graceful stop.
  }
  for (const pid of candidatePids) {
    for (let attempt = 0; attempt < 40 && processExists(pid); attempt += 1) await delay(50);
    if (processExists(pid)) {
      try {
        process.kill(pid);
      } catch {
        // The explicit liveness check below determines whether cleanup succeeded.
      }
    }
    for (let attempt = 0; attempt < 40 && processExists(pid); attempt += 1) await delay(50);
    if (processExists(pid)) throw new Error(`QUALIFICATION_RUNTIME_CLEANUP_FAILED:${pid}`);
  }
}

function parseCliResult(command, output) {
  const lines = output.split(/\r?\n/u).filter(Boolean);
  const value = JSON.parse(lines.at(-1) ?? "null");
  if (value?.ok !== true || value.command !== command) {
    throw new Error(`QUALIFICATION_CLI_RESULT_INVALID:${command}`);
  }
  return value;
}

export async function expectManifestFailure(
  options,
  expectedCode,
  verifier = verifyReleaseManifest,
) {
  try {
    await verifier(options);
  } catch (error) {
    const actualCode = typeof error?.code === "string" ? error.code : "UNKNOWN_ERROR_CODE";
    if (actualCode !== expectedCode) {
      throw new Error(`QUALIFICATION_REJECTION_CODE_MISMATCH:${expectedCode}:${actualCode}`, {
        cause: error,
      });
    }
    return Object.freeze({
      expectedCode,
      rejected: true,
      message: String(error?.message ?? error),
    });
  }
  throw new Error(`QUALIFICATION_FAIL_CLOSED_MISSING:${expectedCode}`);
}

function manifestPayload(manifest) {
  if (!Array.isArray(manifest.payload) || manifest.payload.length === 0) {
    throw new Error("QUALIFICATION_MANIFEST_PAYLOAD_EMPTY");
  }
  return manifest.payload;
}

export async function qualifyWindowsArtifact({
  artifactRoot,
  manifestPath = join(artifactRoot, "release-manifest.json"),
  expectedVersion,
  expectedGitCommit,
  toolchainPath,
  evidenceOutput,
  keepWorkspace = false,
}) {
  if (process.platform !== "win32") throw new Error("QUALIFICATION_WINDOWS_REQUIRED");
  const sourceRoot = resolve(artifactRoot);
  const sourceManifestPath = resolve(manifestPath);
  const workspace = await mkdtemp(join(tmpdir(), "aseos-p1-v09-"));
  const installRoot = join(workspace, "安装 根", "releases", expectedVersion);
  const dataRoot = join(workspace, "数据 根", "本地 用户 数据");
  const installedManifestPath = join(installRoot, "release-manifest.json");
  const installedToolchainPath = resolve(toolchainPath);
  const descriptorPath = join(dataRoot, "state", "runtime", "control-endpoint.json");
  const tokenFilePath = join(dataRoot, "secrets", "runtime", "control-api.token");
  let startAttempted = false;
  let shutdownComplete = false;
  let runtimePid;
  let cleanupContext;

  const verifierOptions = {
    artifactRoot: installRoot,
    manifestPath: "release-manifest.json",
    expectedVersion,
    expectedGitCommit,
    toolchainPath: installedToolchainPath,
  };

  try {
    await mkdir(dirname(installRoot), { recursive: true });
    await cp(sourceRoot, installRoot, { recursive: true, force: false, errorOnExist: true });
    if (sourceManifestPath !== join(sourceRoot, "release-manifest.json")) {
      await cp(sourceManifestPath, installedManifestPath, { force: true });
    }
    await mkdir(dataRoot, { recursive: true });

    const manifestBeforeStartup = await verifyReleaseManifest(verifierOptions);
    const manifest = JSON.parse(await readFile(installedManifestPath, "utf8"));
    const payload = manifestPayload(manifest);
    const nodeExecutable = safePayloadPath(installRoot, manifest.runtime?.executable);
    const cliEntry = join(installRoot, "app", "apps", "cli", "dist", "main.js");
    const runtimeEntry = join(installRoot, "app", "apps", "runtime", "dist", "main.js");
    const releaseId = `p1-v09-${randomUUID()}`;
    const guardPath = join(workspace, "network-guard.mjs");
    const networkLogPath = join(workspace, "network-guard-runtime.jsonl");
    await writeFile(guardPath, NETWORK_GUARD_SOURCE, { encoding: "utf8", flag: "wx" });
    const baseEnvironment = sanitizedWindowsEnvironment();
    const networkGuard = await qualifyNetworkGuard({
      nodeExecutable,
      guardPath,
      workspace,
      baseEnvironment,
    });
    const environment = Object.freeze({
      ...baseEnvironment,
      NODE_OPTIONS: `--import=${pathToFileURL(guardPath).href}`,
      ASEOS_NETWORK_GUARD_LOG: networkLogPath,
    });
    const commonArguments = [
      "--data-root",
      dataRoot,
      "--framework-version",
      expectedVersion,
      "--release-id",
      releaseId,
    ];
    const commandResults = {};
    cleanupContext = {
      dataRoot,
      nodeExecutable,
      cliEntry,
      installRoot,
      environment,
      networkLogPath,
      runtimeEntry,
    };

    const runCli = async (command, extraArguments = []) => {
      const execution = await runFile(
        nodeExecutable,
        [cliEntry, command, ...commonArguments, ...extraArguments],
        { cwd: installRoot, env: environment },
      );
      const result = parseCliResult(command, execution.stdout);
      commandResults[command] = result.value;
      return result;
    };

    startAttempted = true;
    const startResult = await runCli("start", ["--runtime-entry", runtimeEntry]);
    runtimePid = startResult.value?.descriptor?.pid;
    if (!Number.isSafeInteger(runtimePid) || runtimePid <= 0 || runtimePid === process.pid) {
      throw new Error("QUALIFICATION_RUNTIME_PID_INVALID");
    }
    const version = await runCli("version");
    if (
      version.value?.frameworkVersion !== expectedVersion ||
      version.value?.releaseId !== releaseId
    ) {
      throw new Error("QUALIFICATION_RUNTIME_IDENTITY_MISMATCH");
    }
    const doctor = await runCli("doctor");
    if (doctor.value?.status !== "PASS") throw new Error("QUALIFICATION_DOCTOR_FAILED");
    const status = await runCli("status");
    if (status.value?.status !== "READY") throw new Error("QUALIFICATION_STATUS_NOT_READY");
    await runCli("stop");
    const shutdown = await waitForRuntimeShutdown({
      pid: runtimePid,
      descriptorPath,
      tokenFilePath,
    });
    shutdownComplete = true;

    const manifestAfterShutdown = await verifyReleaseManifest(verifierOptions);
    for (const field of [
      "manifestSha256",
      "manifestSizeBytes",
      "payloadFiles",
      "payloadSizeBytes",
    ]) {
      if (manifestBeforeStartup[field] !== manifestAfterShutdown[field]) {
        throw new Error(`QUALIFICATION_MANIFEST_CHANGED_AFTER_SHUTDOWN:${field}`);
      }
    }

    const networkEvents = await readNetworkEvents(networkLogPath);
    const nonLoopbackOutbound = networkEvents.filter(
      (event) => event.decision === "BLOCK_NON_LOOPBACK",
    );
    const loopbackOperations = networkEvents.filter((event) => event.decision === "ALLOW_LOOPBACK");
    const runtimeGuardInstalled = networkEvents.some(
      (event) =>
        event.pid === runtimePid &&
        event.kind === "guard" &&
        event.decision === "INSTALLED" &&
        typeof event.entrypoint === "string" &&
        resolve(event.entrypoint) === resolve(runtimeEntry),
    );
    if (nonLoopbackOutbound.length !== 0) {
      throw new Error(`QUALIFICATION_NON_LOOPBACK_OUTBOUND_OBSERVED:${nonLoopbackOutbound.length}`);
    }
    if (loopbackOperations.length === 0 || !runtimeGuardInstalled) {
      throw new Error("QUALIFICATION_NETWORK_GUARD_COVERAGE_MISSING");
    }
    const offlineStartup =
      networkGuard.negativeProbeBlocked &&
      runtimeGuardInstalled &&
      nonLoopbackOutbound.length === 0;

    const probe = payload.find(
      (entry) =>
        typeof entry?.path === "string" &&
        entry.path !== "node/node.exe" &&
        entry.path !== "aseos.cmd" &&
        Number.isSafeInteger(entry.sizeBytes) &&
        entry.sizeBytes > 0 &&
        entry.sizeBytes <= 1_048_576,
    );
    if (probe === undefined) throw new Error("QUALIFICATION_TAMPER_PROBE_UNAVAILABLE");
    const probePath = safePayloadPath(installRoot, probe.path);
    const original = await readFile(probePath);
    try {
      const tampered = Buffer.from(original);
      tampered[0] ^= 0x01;
      await writeFile(probePath, tampered);
      commandResults.tamper = await expectManifestFailure(
        verifierOptions,
        "RELEASE_PAYLOAD_HASH_MISMATCH",
      );
    } finally {
      await writeFile(probePath, original);
    }
    try {
      await unlink(probePath);
      commandResults.missing = await expectManifestFailure(
        verifierOptions,
        "RELEASE_PAYLOAD_MISSING",
      );
    } finally {
      await writeFile(probePath, original);
    }
    const manifestAfterFaultInjection = await verifyReleaseManifest(verifierOptions);
    if (manifestAfterFaultInjection.manifestSha256 !== manifestBeforeStartup.manifestSha256) {
      throw new Error("QUALIFICATION_MANIFEST_CHANGED_AFTER_FAULT_INJECTION");
    }

    const recordedAt = new Date().toISOString();
    const evidence = Object.freeze({
      $schema: "urn:aseos:release-schema:packaging-evidence:1.0.0",
      schemaVersion: "1.0.0",
      operationId: "P1-O08",
      verificationStepId: "P1-V09-PACKAGING",
      recordedAt,
      subject: Object.freeze({
        frameworkVersion: expectedVersion,
        gitCommit: expectedGitCommit,
        platform: "win32-x64",
      }),
      results: Object.freeze([
        Object.freeze({
          evidenceType: EVIDENCE_TYPES[0],
          result: "PASS",
          bundledRuntimeExecutable: manifest.runtime.executable,
          pathWasEmpty: environment.PATH === "",
          developmentToolchainEnvironmentRemoved: true,
          elevationRequested: false,
          privilegedLocationUsed: false,
          offlineStartup,
          networkGuardMechanism: networkGuard.mechanism,
          negativeNonLoopbackProbeBlocked: networkGuard.negativeProbeBlocked,
          observedNonLoopbackOutboundAttempts: nonLoopbackOutbound.length,
          observedLoopbackOperations: loopbackOperations.length,
          runtimeGuardInstalled,
        }),
        Object.freeze({
          evidenceType: EVIDENCE_TYPES[1],
          result: "PASS",
          payloadFileCount: payload.length,
          verifiedBeforeStartup: true,
          verifiedAfterShutdown: true,
          manifestSha256: manifestBeforeStartup.manifestSha256,
          verifiedManifestSha256Before: manifestBeforeStartup.manifestSha256,
          verifiedManifestSha256After: manifestAfterShutdown.manifestSha256,
          manifestSizeBytes: manifestBeforeStartup.manifestSizeBytes,
          payloadSizeBytes: manifestBeforeStartup.payloadSizeBytes,
          tamperRejected: commandResults.tamper.rejected,
          missingPayloadRejected: commandResults.missing.rejected,
        }),
        Object.freeze({
          evidenceType: EVIDENCE_TYPES[2],
          result: "PASS",
          installRootClass: "UNICODE_AND_SPACE_TEMP_PATH",
          dataRootClass: "SEPARATE_UNICODE_AND_SPACE_TEMP_PATH",
          commands: Object.freeze(["start", "version", "doctor", "status", "stop"]),
          releaseDataSeparated: !resolve(dataRoot).startsWith(`${resolve(installRoot)}${sep}`),
          releasePayloadUnchanged: true,
          processExited: shutdown.processExited,
          discoveryRemoved: shutdown.discoveryRemoved,
          tokenRemoved: shutdown.tokenRemoved,
          commandResults,
        }),
      ]),
    });
    if (evidenceOutput !== undefined) {
      await mkdir(dirname(resolve(evidenceOutput)), { recursive: true });
      await writeFile(resolve(evidenceOutput), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    }
    return evidence;
  } finally {
    if (startAttempted && !shutdownComplete && cleanupContext !== undefined) {
      await cleanupDiscoveredRuntime({ ...cleanupContext, preferredPid: runtimePid });
    }
    if (!keepWorkspace) await rm(workspace, { recursive: true, force: true, maxRetries: 5 });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const artifactRoot = resolve(requiredOption(options, "artifact-root"));
  const evidence = await qualifyWindowsArtifact({
    artifactRoot,
    manifestPath: resolve(options.manifest ?? join(artifactRoot, "release-manifest.json")),
    expectedVersion: requiredOption(options, "expected-version"),
    expectedGitCommit: requiredOption(options, "expected-git-commit"),
    toolchainPath: resolve(requiredOption(options, "toolchain")),
    ...(options["evidence-output"] === undefined
      ? {}
      : { evidenceOutput: resolve(options["evidence-output"]) }),
    keepWorkspace: options["keep-workspace"] === "true",
  });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: "P1_V09_QUALIFICATION_FAILED", message: String(error?.message ?? error) })}\n`,
    );
    process.exitCode = 1;
  });
}
