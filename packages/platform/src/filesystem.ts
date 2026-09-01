import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { ControlApiError } from "./errors.js";
import type { ControlEndpointDescriptor } from "./types.js";
import {
  WIN32_TOKEN_HELPER_ASSEMBLY_BASE64,
  WIN32_TOKEN_HELPER_ASSEMBLY_SHA256,
  WIN32_TOKEN_HELPER_SOURCE_SHA256,
} from "./win32-token-helper.generated.js";

const execFileAsync = promisify(execFile);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SEMANTIC_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const TOKEN_REF_PATTERN = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;

function windowsSystemDirectory(): string {
  const report: unknown = process.report.getReport();
  const reportSharedObjects =
    typeof report === "object" && report !== null
      ? (report as Record<string, unknown>)["sharedObjects"]
      : undefined;
  const sharedObjects = Array.isArray(reportSharedObjects)
    ? reportSharedObjects.filter((path): path is string => typeof path === "string")
    : [];
  const kernel32 = sharedObjects.find(
    (path) =>
      basename(path).toLowerCase() === "kernel32.dll" &&
      basename(dirname(path)).toLowerCase() === "system32",
  );
  if (kernel32 === undefined || !isAbsolute(kernel32) || kernel32.includes("\0")) {
    throw new Error("The loaded Windows system directory is unavailable");
  }
  return dirname(kernel32);
}

function windowsSystemExecutable(
  name: "whoami.exe" | "WindowsPowerShell\\v1.0\\powershell.exe",
): string {
  return join(windowsSystemDirectory(), name);
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

function normalizeWindowsSid(sid: string): string | undefined {
  const normalized = sid.trim().toUpperCase();
  if (!/^S-1-\d+(?:-\d+){1,15}$/u.test(normalized)) return undefined;
  const components = normalized.slice(4).split("-");
  const authority = components.shift();
  if (authority === undefined || BigInt(authority) > 0xffffffffffffn) return undefined;
  if (components.some((component) => BigInt(component) > 0xffffffffn)) return undefined;
  return normalized;
}

export function windowsCurrentUserSidFromWhoami(stdout: string): string | undefined {
  const match = /^(?:\uFEFF)?"(?:[^"\r\n]|"")*","(S-1-\d+(?:-\d+){1,15})"\r?\n?$/iu.exec(stdout);
  return match === null ? undefined : normalizeWindowsSid(match[1] ?? "");
}

async function currentWindowsSid(): Promise<string> {
  const { stdout } = await execFileAsync(
    windowsSystemExecutable("whoami.exe"),
    ["/user", "/fo", "csv", "/nh"],
    {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    },
  );
  const sid = windowsCurrentUserSidFromWhoami(stdout);
  if (sid === undefined) throw new Error("Current Windows user SID is unavailable");
  return sid;
}

const WINDOWS_ACL_NATIVE_SOURCE = String.raw`
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class AseosWindowsTokenFile
{
    private const uint GENERIC_READ = 0x80000000;
    private const uint GENERIC_WRITE = 0x40000000;
    private const uint READ_CONTROL = 0x00020000;
    private const uint DELETE = 0x00010000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const uint CREATE_NEW = 1;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
    private const uint FILE_ATTRIBUTE_NORMAL = 0x00000080;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
    private const uint OWNER_SECURITY_INFORMATION = 0x00000001;
    private const uint DACL_SECURITY_INFORMATION = 0x00000004;
    private const int SE_FILE_OBJECT = 1;
    private const int FILE_DISPOSITION_INFO_CLASS = 4;

    [StructLayout(LayoutKind.Sequential)]
    private struct SECURITY_ATTRIBUTES
    {
        public int nLength;
        public IntPtr lpSecurityDescriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool bInheritHandle;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BY_HANDLE_FILE_INFORMATION
    {
        public uint dwFileAttributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME ftCreationTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME ftLastAccessTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME ftLastWriteTime;
        public uint dwVolumeSerialNumber;
        public uint nFileSizeHigh;
        public uint nFileSizeLow;
        public uint nNumberOfLinks;
        public uint nFileIndexHigh;
        public uint nFileIndexLow;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct FILE_DISPOSITION_INFO
    {
        [MarshalAs(UnmanagedType.U1)] public byte DeleteFile;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool ConvertStringSecurityDescriptorToSecurityDescriptorW(
        string stringSecurityDescriptor,
        uint stringSDRevision,
        out IntPtr securityDescriptor,
        out uint securityDescriptorSize);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern uint GetSecurityInfo(
        SafeFileHandle handle,
        int objectType,
        uint securityInfo,
        out IntPtr owner,
        out IntPtr group,
        out IntPtr dacl,
        out IntPtr sacl,
        out IntPtr securityDescriptor);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        ref SECURITY_ATTRIBUTES securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool WriteFile(
        SafeFileHandle file,
        byte[] buffer,
        uint bytesToWrite,
        out uint bytesWritten,
        IntPtr overlapped);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool FlushFileBuffers(SafeFileHandle file);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(
        SafeFileHandle file,
        out BY_HANDLE_FILE_INFORMATION information);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetFileInformationByHandle(
        SafeFileHandle file,
        int fileInformationClass,
        ref FILE_DISPOSITION_INFO information,
        uint bufferSize);

    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityDescriptorLength(IntPtr securityDescriptor);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);

    private static Exception Win32(string operation)
    {
        return new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }

    private static void ValidateIdentity(string sid)
    {
        SecurityIdentifier identity = new SecurityIdentifier(sid);
        if (!String.Equals(identity.Value, sid, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("SID_NOT_CANONICAL");
        SecurityIdentifier processIdentity = WindowsIdentity.GetCurrent().User;
        if (processIdentity == null || !String.Equals(processIdentity.Value, identity.Value, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("PROCESS_SID_MISMATCH");
    }

    private static void VerifyHandle(SafeFileHandle handle, string sid, bool directory)
    {
        BY_HANDLE_FILE_INFORMATION information;
        if (!GetFileInformationByHandle(handle, out information)) throw Win32("GetFileInformationByHandle");
        if ((information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
            throw new InvalidOperationException("REPARSE_POINT_REJECTED");
        bool actualDirectory = (information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        if (actualDirectory != directory) throw new InvalidOperationException("FILE_TYPE_MISMATCH");

        IntPtr owner;
        IntPtr group;
        IntPtr dacl;
        IntPtr sacl;
        IntPtr descriptor;
        uint result = GetSecurityInfo(
            handle,
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            out owner,
            out group,
            out dacl,
            out sacl,
            out descriptor);
        if (result != 0) throw new Win32Exception((int)result, "GetSecurityInfo");
        try
        {
            uint length = GetSecurityDescriptorLength(descriptor);
            if (length == 0 || length > 65536) throw new InvalidOperationException("SECURITY_DESCRIPTOR_SIZE_INVALID");
            byte[] bytes = new byte[length];
            Marshal.Copy(descriptor, bytes, 0, (int)length);
            RawSecurityDescriptor raw = new RawSecurityDescriptor(bytes, 0);
            if (raw.Owner == null || !String.Equals(raw.Owner.Value, sid, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("OWNER_SID_MISMATCH");
            if ((raw.ControlFlags & ControlFlags.DiscretionaryAclProtected) == 0)
                throw new InvalidOperationException("DACL_NOT_PROTECTED");
            if ((raw.ControlFlags & ControlFlags.DiscretionaryAclDefaulted) != 0)
                throw new InvalidOperationException("DACL_DEFAULTED");
            if ((raw.ControlFlags & ControlFlags.DiscretionaryAclPresent) == 0 || raw.DiscretionaryAcl == null)
                throw new InvalidOperationException("DACL_MISSING");
            if (raw.DiscretionaryAcl.Count != 1) throw new InvalidOperationException("DACL_RULE_COUNT_MISMATCH");
            CommonAce ace = raw.DiscretionaryAcl[0] as CommonAce;
            AceFlags expectedFlags = directory
                ? AceFlags.ContainerInherit | AceFlags.ObjectInherit
                : AceFlags.None;
            if (ace == null || ace.AceQualifier != AceQualifier.AccessAllowed || ace.AceFlags != expectedFlags)
                throw new InvalidOperationException("DACL_ACE_SHAPE_MISMATCH");
            if (ace.SecurityIdentifier == null || !String.Equals(ace.SecurityIdentifier.Value, sid, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("DACL_SID_MISMATCH");
            if (ace.AccessMask != (int)FileSystemRights.FullControl)
                throw new InvalidOperationException("DACL_NOT_FULL_CONTROL");
        }
        finally
        {
            if (descriptor != IntPtr.Zero) LocalFree(descriptor);
        }
    }

    public static void Verify(string path, string sid, bool directory)
    {
        ValidateIdentity(sid);
        uint flags = FILE_FLAG_OPEN_REPARSE_POINT | (directory ? FILE_FLAG_BACKUP_SEMANTICS : 0);
        using (SafeFileHandle handle = CreateFileW(
            path,
            READ_CONTROL,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            IntPtr.Zero,
            OPEN_EXISTING,
            flags,
            IntPtr.Zero))
        {
            if (handle.IsInvalid) throw Win32("CreateFile(verify)");
            VerifyHandle(handle, sid, directory);
        }
    }

    public static string Create(string path, string sid)
    {
        ValidateIdentity(sid);
        Delete(path, sid);
        IntPtr descriptor = IntPtr.Zero;
        uint descriptorSize;
        string sddl = "O:" + sid + "D:P(A;;FA;;;" + sid + ")";
        if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, out descriptor, out descriptorSize))
            throw Win32("ConvertStringSecurityDescriptorToSecurityDescriptor");
        try
        {
            SECURITY_ATTRIBUTES attributes = new SECURITY_ATTRIBUTES();
            attributes.nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES));
            attributes.lpSecurityDescriptor = descriptor;
            attributes.bInheritHandle = false;
            SafeFileHandle handle = CreateFileW(
                path,
                GENERIC_READ | GENERIC_WRITE | READ_CONTROL | DELETE,
                0,
                ref attributes,
                CREATE_NEW,
                FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT,
                IntPtr.Zero);
            try
            {
                if (handle.IsInvalid) throw Win32("CreateFile(create)");
                VerifyHandle(handle, sid, false);
                byte[] random = new byte[32];
                using (RandomNumberGenerator generator = RandomNumberGenerator.Create()) generator.GetBytes(random);
                string token = Convert.ToBase64String(random).TrimEnd('=').Replace('+', '-').Replace('/', '_');
                byte[] content = Encoding.UTF8.GetBytes(token + "\n");
                uint written;
                if (!WriteFile(handle, content, (uint)content.Length, out written, IntPtr.Zero)) throw Win32("WriteFile");
                if (written != content.Length) throw new InvalidOperationException("TOKEN_WRITE_INCOMPLETE");
                if (!FlushFileBuffers(handle)) throw Win32("FlushFileBuffers");
                VerifyHandle(handle, sid, false);
                return token;
            }
            catch
            {
                if (handle != null && !handle.IsInvalid && !handle.IsClosed)
                {
                    FILE_DISPOSITION_INFO disposition = new FILE_DISPOSITION_INFO();
                    disposition.DeleteFile = 1;
                    SetFileInformationByHandle(
                        handle,
                        FILE_DISPOSITION_INFO_CLASS,
                        ref disposition,
                        (uint)Marshal.SizeOf(typeof(FILE_DISPOSITION_INFO)));
                }
                throw;
            }
            finally
            {
                if (handle != null) handle.Dispose();
            }
        }
        finally
        {
            if (descriptor != IntPtr.Zero) LocalFree(descriptor);
        }
    }

    public static void Delete(string path, string sid)
    {
        ValidateIdentity(sid);
        using (SafeFileHandle handle = CreateFileW(
            path,
            READ_CONTROL | DELETE,
            0,
            IntPtr.Zero,
            OPEN_EXISTING,
            FILE_FLAG_OPEN_REPARSE_POINT,
            IntPtr.Zero))
        {
            if (handle.IsInvalid)
            {
                int error = Marshal.GetLastWin32Error();
                if (error == 2 || error == 3) return;
                throw new Win32Exception(error, "CreateFile(delete-token)");
            }
            VerifyHandle(handle, sid, false);
            FILE_DISPOSITION_INFO disposition = new FILE_DISPOSITION_INFO();
            disposition.DeleteFile = 1;
            if (!SetFileInformationByHandle(
                handle,
                FILE_DISPOSITION_INFO_CLASS,
                ref disposition,
                (uint)Marshal.SizeOf(typeof(FILE_DISPOSITION_INFO))))
                throw Win32("SetFileInformationByHandle(delete-token)");
        }
    }
}
`;

const WINDOWS_ACL_NATIVE_COMMAND = [
  "$ErrorActionPreference = 'Stop'",
  "$assembly = [Reflection.Assembly]::Load([Convert]::FromBase64String($env:ASEOS_ACL_ASSEMBLY))",
  "$type = $assembly.GetType('AseosWindowsTokenFile', $true)",
  "$directory = $env:ASEOS_ACL_DIRECTORY -eq 'true'",
  "if ($env:ASEOS_ACL_MODE -eq 'create') { $result = $type.GetMethod('Create').Invoke($null, [object[]]@($env:ASEOS_ACL_TARGET, $env:ASEOS_ACL_SID)); [Console]::Out.Write([string]$result) } elseif ($env:ASEOS_ACL_MODE -eq 'delete') { $null = $type.GetMethod('Delete').Invoke($null, [object[]]@($env:ASEOS_ACL_TARGET, $env:ASEOS_ACL_SID)); [Console]::Out.Write('ASEOS_ACL_OK') } else { $null = $type.GetMethod('Verify').Invoke($null, [object[]]@($env:ASEOS_ACL_TARGET, $env:ASEOS_ACL_SID, $directory)); [Console]::Out.Write('ASEOS_ACL_OK') }",
].join("; ");

async function invokeWindowsAclNative(
  mode: "create" | "delete" | "verify",
  path: string,
  sid: string,
  requireChildInheritance: boolean,
): Promise<string> {
  const systemDirectory = windowsSystemDirectory();
  const systemRoot = dirname(systemDirectory);
  const assembly = Buffer.from(WIN32_TOKEN_HELPER_ASSEMBLY_BASE64, "base64");
  if (
    createHash("sha256").update(assembly).digest("hex") !== WIN32_TOKEN_HELPER_ASSEMBLY_SHA256 ||
    createHash("sha256").update(WINDOWS_ACL_NATIVE_SOURCE.slice(1), "utf8").digest("hex") !==
      WIN32_TOKEN_HELPER_SOURCE_SHA256
  ) {
    throw new Error("The embedded Windows token helper failed its fixed hash binding");
  }
  const encodedCommand = Buffer.from(WINDOWS_ACL_NATIVE_COMMAND, "utf16le").toString("base64");
  const { stdout } = await execFileAsync(
    windowsSystemExecutable("WindowsPowerShell\\v1.0\\powershell.exe"),
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
    {
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 64 * 1024,
      env: {
        SystemDrive: parse(systemRoot).root.replace(/\\$/u, ""),
        SystemRoot: systemRoot,
        windir: systemRoot,
        PATH: systemDirectory,
        PATHEXT: ".COM;.EXE;.BAT;.CMD",
        ComSpec: join(systemDirectory, "cmd.exe"),
        ASEOS_ACL_MODE: mode,
        ASEOS_ACL_ASSEMBLY: assembly.toString("base64"),
        ASEOS_ACL_TARGET: path,
        ASEOS_ACL_SID: sid,
        ASEOS_ACL_DIRECTORY: requireChildInheritance ? "true" : "false",
      },
    },
  );
  return stdout;
}

async function deleteWindowsUserOnlyToken(path: string): Promise<void> {
  const stdout = await invokeWindowsAclNative("delete", path, await currentWindowsSid(), false);
  if (stdout !== "ASEOS_ACL_OK") {
    throw new Error("Windows token deletion did not produce the exact success marker");
  }
}

async function assertWindowsUserOnlyAcl(
  path: string,
  sid: string,
  requireChildInheritance: boolean,
): Promise<void> {
  const stdout = await invokeWindowsAclNative("verify", path, sid, requireChildInheritance);
  if (stdout !== "ASEOS_ACL_OK") {
    throw new Error("ACL verification did not produce the exact success marker");
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

async function createWindowsTokenAtomically(path: string): Promise<string> {
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const sid = await currentWindowsSid();
  const token = await invokeWindowsAclNative("create", path, sid, false);
  if (!TOKEN_PATTERN.test(token)) throw new Error("Native token creation returned invalid output");
  return token;
}

export async function verifyControlPathUserOnly(path: string): Promise<void> {
  try {
    if (process.platform === "win32") {
      await assertWindowsUserOnlyAcl(path, await currentWindowsSid(), false);
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
  try {
    if (process.platform === "win32") {
      return await createWindowsTokenAtomically(path);
    }
    const token = randomBytes(32).toString("base64url");
    await replaceAtomically(path, `${token}\n`, 0o600);
    await chmod(path, 0o600);
    await assertPosixUserOnly(path);
    return token;
  } catch (error) {
    if (process.platform !== "win32") await rm(path, { force: true });
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
    process.platform === "win32"
      ? deleteWindowsUserOnlyToken(paths.tokenFilePath)
      : rm(paths.tokenFilePath, { force: true }),
  ]);
}
