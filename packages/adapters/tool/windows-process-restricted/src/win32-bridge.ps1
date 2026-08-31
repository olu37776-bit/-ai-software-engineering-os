param(
  [string]$RequestPath,
  [switch]$Probe
)

$ErrorActionPreference = "Stop"

Add-Type -ReferencedAssemblies "System.Web.Extensions.dll" -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;
using System.Web.Script.Serialization;

public static class AseosWindowsProcessRestrictedBridge
{
    private const uint CREATE_SUSPENDED = 0x00000004;
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    private const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    private const uint STARTF_USESTDHANDLES = 0x00000100;
    private const uint HANDLE_FLAG_INHERIT = 0x00000001;
    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint OPEN_EXISTING = 3;
    private const uint WAIT_OBJECT_0 = 0;
    private const uint WAIT_TIMEOUT = 258;
    private const uint JOB_OBJECT_LIMIT_PROCESS_TIME = 0x00000002;
    private const uint JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008;
    private const uint JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100;
    private const uint JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;
    private const int JobObjectBasicAccountingInformation = 1;
    private const int JobObjectAssociateCompletionPortInformation = 7;
    private static readonly IntPtr PROC_THREAD_ATTRIBUTE_HANDLE_LIST = new IntPtr(0x00020002);

    public sealed class Limits
    {
        public int wallClockMs { get; set; }
        public int processCpuTimeMs { get; set; }
        public long memoryBytes { get; set; }
        public int activeProcessLimit { get; set; }
        public int stdoutBytes { get; set; }
        public int stderrBytes { get; set; }
    }

    public sealed class Request
    {
        public string executable { get; set; }
        public string executableSha256 { get; set; }
        public string[] arguments { get; set; }
        public string workingDirectory { get; set; }
        public Dictionary<string, string> environment { get; set; }
        public string cancellationPath { get; set; }
        public Limits limits { get; set; }
    }

    public sealed class Response
    {
        public string status { get; set; }
        public int? exitCode { get; set; }
        public string reason { get; set; }
        public string stdoutBase64 { get; set; }
        public string stderrBase64 { get; set; }
        public long durationMs { get; set; }
        public string code { get; set; }
        public string message { get; set; }
        public int rootProcessId { get; set; }
        public long cpuTimeMs { get; set; }
        public long memoryPeakBytes { get; set; }
        public int processPeakCount { get; set; }
        public int activeProcessCountAfterCompletion { get; set; }
        public bool descendantTerminationVerified { get; set; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SECURITY_ATTRIBUTES
    {
        public int nLength;
        public IntPtr lpSecurityDescriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool bInheritHandle;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public uint dwX;
        public uint dwY;
        public uint dwXSize;
        public uint dwYSize;
        public uint dwXCountChars;
        public uint dwYCountChars;
        public uint dwFillAttribute;
        public uint dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct STARTUPINFOEX
    {
        public STARTUPINFO StartupInfo;
        public IntPtr lpAttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
    {
        public long TotalUserTime;
        public long TotalKernelTime;
        public long ThisPeriodTotalUserTime;
        public long ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount;
        public uint TotalProcesses;
        public uint ActiveProcesses;
        public uint TotalTerminatedProcesses;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_ASSOCIATE_COMPLETION_PORT
    {
        public IntPtr CompletionKey;
        public IntPtr CompletionPort;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessW(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", EntryPoint = "CreateProcessW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessWEx(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFOEX lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(
        IntPtr lpAttributeList,
        int dwAttributeCount,
        uint dwFlags,
        ref IntPtr lpSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(
        IntPtr lpAttributeList,
        uint dwFlags,
        IntPtr Attribute,
        IntPtr lpValue,
        IntPtr cbSize,
        IntPtr lpPreviousValue,
        IntPtr lpReturnSize);

    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr lpAttributeList);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
        IntPtr hJob,
        int JobObjectInformationClass,
        IntPtr lpJobObjectInformation,
        uint cbJobObjectInformationLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(
        IntPtr hJob,
        int JobObjectInformationClass,
        IntPtr lpJobObjectInformation,
        uint cbJobObjectInformationLength,
        out uint lpReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateIoCompletionPort(
        IntPtr FileHandle,
        IntPtr ExistingCompletionPort,
        UIntPtr CompletionKey,
        uint NumberOfConcurrentThreads);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetQueuedCompletionStatus(
        IntPtr CompletionPort,
        out uint lpNumberOfBytesTransferred,
        out UIntPtr lpCompletionKey,
        out IntPtr lpOverlapped,
        uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr hThread);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CreatePipe(
        out IntPtr hReadPipe,
        out IntPtr hWritePipe,
        ref SECURITY_ATTRIBUTES lpPipeAttributes,
        uint nSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr hObject, uint dwMask, uint dwFlags);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateFileW(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        ref SECURITY_ATTRIBUTES lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    private static Exception Win32(string operation)
    {
        return new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }

    private static string Quote(string value)
    {
        if (value.Length > 0 && value.All(c => !Char.IsWhiteSpace(c) && c != '"'))
            return value;
        var output = new StringBuilder("\"");
        var slashes = 0;
        foreach (var character in value)
        {
            if (character == '\\')
            {
                slashes++;
                continue;
            }
            if (character == '"')
            {
                output.Append('\\', slashes * 2 + 1).Append('"');
                slashes = 0;
                continue;
            }
            output.Append('\\', slashes).Append(character);
            slashes = 0;
        }
        output.Append('\\', slashes * 2).Append('"');
        return output.ToString();
    }

    private static char[] EnvironmentBlock(Dictionary<string, string> environment)
    {
        var entries = (environment ?? new Dictionary<string, string>())
            .OrderBy(pair => pair.Key, StringComparer.OrdinalIgnoreCase)
            .Select(pair => pair.Key + "=" + pair.Value);
        return (String.Join("\0", entries) + "\0\0").ToCharArray();
    }

    private static byte[] ReadBounded(IntPtr readHandle, int maximumBytes, IntPtr job, int reasonCode)
    {
        using (var safeHandle = new SafeFileHandle(readHandle, true))
        using (var stream = new FileStream(safeHandle, FileAccess.Read, 8192, false))
        using (var output = new MemoryStream(Math.Min(maximumBytes, 65536)))
        {
            var buffer = new byte[8192];
            while (true)
            {
                var count = stream.Read(buffer, 0, buffer.Length);
                if (count == 0) break;
                var remaining = maximumBytes - (int)output.Length;
                if (remaining > 0) output.Write(buffer, 0, Math.Min(remaining, count));
                if (count > remaining)
                {
                    Interlocked.CompareExchange(ref terminationReason, reasonCode, 0);
                    TerminateJobObject(job, 0xE0000002);
                    break;
                }
            }
            return output.ToArray();
        }
    }

    private static int terminationReason;

    private static bool IsForbiddenExecutableIdentity(string value)
    {
        if (String.IsNullOrWhiteSpace(value)) return false;
        var name = Path.GetFileName(value).ToLowerInvariant();
        return new[] {
            "bash.exe", "cmd.exe", "cscript.exe", "mshta.exe", "node.exe",
            "powershell.exe", "pwsh.exe", "python.exe", "python3.exe", "sh.exe",
            "wscript.exe", "wsl.exe"
        }.Contains(name);
    }

    private static void ReadUsage(
        IntPtr job,
        out long cpuTimeMs,
        out long memoryPeakBytes,
        out int processCount,
        out int activeProcessCount)
    {
        cpuTimeMs = 0;
        memoryPeakBytes = 0;
        processCount = 0;
        activeProcessCount = 0;
        var accountingSize = Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION));
        var accountingPointer = Marshal.AllocHGlobal(accountingSize);
        var extendedSize = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        var extendedPointer = Marshal.AllocHGlobal(extendedSize);
        try
        {
            uint returned;
            if (QueryInformationJobObject(
                job, JobObjectBasicAccountingInformation, accountingPointer,
                (uint)accountingSize, out returned))
            {
                var accounting = (JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)
                    Marshal.PtrToStructure(accountingPointer, typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION));
                cpuTimeMs = (accounting.TotalUserTime + accounting.TotalKernelTime) / 10000L;
                processCount = checked((int)accounting.TotalProcesses);
                activeProcessCount = checked((int)accounting.ActiveProcesses);
            }
            if (QueryInformationJobObject(
                job, JobObjectExtendedLimitInformation, extendedPointer,
                (uint)extendedSize, out returned))
            {
                var extended = (JOBOBJECT_EXTENDED_LIMIT_INFORMATION)
                    Marshal.PtrToStructure(extendedPointer, typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                memoryPeakBytes = checked((long)extended.PeakJobMemoryUsed.ToUInt64());
            }
        }
        finally
        {
            Marshal.FreeHGlobal(accountingPointer);
            Marshal.FreeHGlobal(extendedPointer);
        }
    }

    private static void ConsumeResourceNotifications(IntPtr completionPort)
    {
        uint message;
        UIntPtr key;
        IntPtr overlapped;
        while (GetQueuedCompletionStatus(completionPort, out message, out key, out overlapped, 0))
        {
            if (message == 1 || message == 2)
                Interlocked.CompareExchange(ref terminationReason, 5, 0);
            else if (message == 3)
                Interlocked.CompareExchange(ref terminationReason, 7, 0);
            else if (message == 9 || message == 10)
                Interlocked.CompareExchange(ref terminationReason, 6, 0);
        }
    }

    public static string Run(string requestJson)
    {
        var serializer = new JavaScriptSerializer { MaxJsonLength = Int32.MaxValue };
        var watch = Stopwatch.StartNew();
        IntPtr job = IntPtr.Zero;
        IntPtr completionPort = IntPtr.Zero;
        IntPtr process = IntPtr.Zero;
        IntPtr thread = IntPtr.Zero;
        IntPtr stdoutRead = IntPtr.Zero;
        IntPtr stdoutWrite = IntPtr.Zero;
        IntPtr stderrRead = IntPtr.Zero;
        IntPtr stderrWrite = IntPtr.Zero;
        IntPtr stdinHandle = IntPtr.Zero;
        IntPtr limitsPointer = IntPtr.Zero;
        IntPtr attributeList = IntPtr.Zero;
        IntPtr inheritedHandlesPointer = IntPtr.Zero;
        GCHandle environmentPin = default(GCHandle);
        Task<byte[]> stdoutTask = null;
        Task<byte[]> stderrTask = null;
        FileStream executableLock = null;
        terminationReason = 0;
        try
        {
            var request = serializer.Deserialize<Request>(requestJson);
            if (request == null || request.limits == null) throw new InvalidDataException("Malformed request");
            executableLock = new FileStream(
                request.executable, FileMode.Open, FileAccess.Read, FileShare.Read,
                65536, FileOptions.SequentialScan);
            var versionIdentity = FileVersionInfo.GetVersionInfo(request.executable);
            if (IsForbiddenExecutableIdentity(request.executable) ||
                IsForbiddenExecutableIdentity(versionIdentity.OriginalFilename) ||
                IsForbiddenExecutableIdentity(versionIdentity.InternalName))
                throw new InvalidDataException("Shell or script interpreter executable identity is forbidden");
            string executableDigest;
            using (var sha256 = SHA256.Create())
                executableDigest = BitConverter.ToString(sha256.ComputeHash(executableLock))
                    .Replace("-", "").ToLowerInvariant();
            if (!String.Equals(executableDigest, request.executableSha256, StringComparison.Ordinal))
                throw new InvalidDataException("Trusted executable SHA-256 mismatch inside launch bridge");
            executableLock.Position = 0;
            var security = new SECURITY_ATTRIBUTES {
                nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),
                bInheritHandle = true
            };
            if (!CreatePipe(out stdoutRead, out stdoutWrite, ref security, 0)) throw Win32("CreatePipe(stdout)");
            if (!SetHandleInformation(stdoutRead, HANDLE_FLAG_INHERIT, 0)) throw Win32("SetHandleInformation(stdout)");
            if (!CreatePipe(out stderrRead, out stderrWrite, ref security, 0)) throw Win32("CreatePipe(stderr)");
            if (!SetHandleInformation(stderrRead, HANDLE_FLAG_INHERIT, 0)) throw Win32("SetHandleInformation(stderr)");
            stdinHandle = CreateFileW(
                "NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, ref security,
                OPEN_EXISTING, 0, IntPtr.Zero);
            if (stdinHandle == new IntPtr(-1)) throw Win32("CreateFile(NUL)");

            job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw Win32("CreateJobObject");
            completionPort = CreateIoCompletionPort(new IntPtr(-1), IntPtr.Zero, UIntPtr.Zero, 1);
            if (completionPort == IntPtr.Zero) throw Win32("CreateIoCompletionPort");
            var completionAssociation = new JOBOBJECT_ASSOCIATE_COMPLETION_PORT {
                CompletionKey = new IntPtr(1),
                CompletionPort = completionPort
            };
            var completionAssociationSize = Marshal.SizeOf(typeof(JOBOBJECT_ASSOCIATE_COMPLETION_PORT));
            var completionAssociationPointer = Marshal.AllocHGlobal(completionAssociationSize);
            try
            {
                Marshal.StructureToPtr(completionAssociation, completionAssociationPointer, false);
                if (!SetInformationJobObject(
                    job, JobObjectAssociateCompletionPortInformation,
                    completionAssociationPointer, (uint)completionAssociationSize))
                    throw Win32("SetInformationJobObject(completion port)");
            }
            finally
            {
                Marshal.FreeHGlobal(completionAssociationPointer);
            }
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags =
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
                JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
                JOB_OBJECT_LIMIT_PROCESS_TIME |
                JOB_OBJECT_LIMIT_PROCESS_MEMORY |
                JOB_OBJECT_LIMIT_JOB_MEMORY;
            limits.BasicLimitInformation.ActiveProcessLimit = (uint)request.limits.activeProcessLimit;
            limits.BasicLimitInformation.PerProcessUserTimeLimit = request.limits.processCpuTimeMs * 10000L;
            limits.ProcessMemoryLimit = new UIntPtr((ulong)request.limits.memoryBytes);
            limits.JobMemoryLimit = new UIntPtr((ulong)request.limits.memoryBytes);
            var limitsSize = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            limitsPointer = Marshal.AllocHGlobal(limitsSize);
            Marshal.StructureToPtr(limits, limitsPointer, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, limitsPointer, (uint)limitsSize))
                throw Win32("SetInformationJobObject");

            var startup = new STARTUPINFOEX {
                StartupInfo = new STARTUPINFO {
                cb = Marshal.SizeOf(typeof(STARTUPINFOEX)),
                dwFlags = STARTF_USESTDHANDLES,
                hStdInput = stdinHandle,
                hStdOutput = stdoutWrite,
                hStdError = stderrWrite
                }
            };
            IntPtr attributeListSize = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeListSize);
            attributeList = Marshal.AllocHGlobal(attributeListSize);
            if (!InitializeProcThreadAttributeList(attributeList, 1, 0, ref attributeListSize))
                throw Win32("InitializeProcThreadAttributeList");
            var inheritedHandles = new[] { stdinHandle, stdoutWrite, stderrWrite };
            inheritedHandlesPointer = Marshal.AllocHGlobal(IntPtr.Size * inheritedHandles.Length);
            Marshal.Copy(inheritedHandles, 0, inheritedHandlesPointer, inheritedHandles.Length);
            if (!UpdateProcThreadAttribute(
                attributeList, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                inheritedHandlesPointer, new IntPtr(IntPtr.Size * inheritedHandles.Length),
                IntPtr.Zero, IntPtr.Zero))
                throw Win32("UpdateProcThreadAttribute(HANDLE_LIST)");
            startup.lpAttributeList = attributeList;
            var commandLine = new StringBuilder(
                String.Join(" ", new[] { request.executable }.Concat(request.arguments ?? new string[0]).Select(Quote)));
            var environment = EnvironmentBlock(request.environment);
            environmentPin = GCHandle.Alloc(environment, GCHandleType.Pinned);
            PROCESS_INFORMATION processInformation;
            if (!CreateProcessWEx(
                request.executable,
                commandLine,
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
                environmentPin.AddrOfPinnedObject(),
                request.workingDirectory,
                ref startup,
                out processInformation))
                throw Win32("CreateProcessW(CREATE_SUSPENDED)");
            executableLock.Dispose(); executableLock = null;
            process = processInformation.hProcess;
            thread = processInformation.hThread;
            CloseHandle(stdoutWrite); stdoutWrite = IntPtr.Zero;
            CloseHandle(stderrWrite); stderrWrite = IntPtr.Zero;
            CloseHandle(stdinHandle); stdinHandle = IntPtr.Zero;

            if (!AssignProcessToJobObject(job, process))
            {
                TerminateProcess(process, 0xE0000001);
                throw Win32("AssignProcessToJobObject");
            }
            var stdoutReaderHandle = stdoutRead;
            stdoutRead = IntPtr.Zero;
            stdoutTask = Task.Run(() => ReadBounded(stdoutReaderHandle, request.limits.stdoutBytes, job, 2));
            var stderrReaderHandle = stderrRead;
            stderrRead = IntPtr.Zero;
            stderrTask = Task.Run(() => ReadBounded(stderrReaderHandle, request.limits.stderrBytes, job, 3));
            if (ResumeThread(thread) == UInt32.MaxValue)
            {
                TerminateJobObject(job, 0xE0000001);
                throw Win32("ResumeThread");
            }

            long cpuTimeMs = 0;
            long memoryPeakBytes = 0;
            int processPeakCount = 1;
            int activeProcessCount = 1;
            int totalProcesses = 1;
            int finalTotalProcesses = 1;
            while (true)
            {
                var wait = WaitForSingleObject(process, 20);
                ConsumeResourceNotifications(completionPort);
                ReadUsage(job, out cpuTimeMs, out memoryPeakBytes, out totalProcesses, out activeProcessCount);
                processPeakCount = Math.Max(processPeakCount, activeProcessCount);
                if (File.Exists(request.cancellationPath))
                    Interlocked.CompareExchange(ref terminationReason, 4, 0);
                else if (watch.ElapsedMilliseconds >= request.limits.wallClockMs)
                    Interlocked.CompareExchange(ref terminationReason, 1, 0);
                else if (cpuTimeMs >= request.limits.processCpuTimeMs)
                    Interlocked.CompareExchange(ref terminationReason, 5, 0);
                else if (memoryPeakBytes >= request.limits.memoryBytes)
                    Interlocked.CompareExchange(ref terminationReason, 6, 0);
                else if (activeProcessCount > request.limits.activeProcessLimit)
                    Interlocked.CompareExchange(ref terminationReason, 7, 0);
                if (terminationReason != 0)
                {
                    TerminateJobObject(job, 0xE0000002);
                    WaitForSingleObject(process, 5000);
                    break;
                }
                if (wait == WAIT_OBJECT_0) break;
                if (wait != WAIT_TIMEOUT)
                {
                    TerminateJobObject(job, 0xE0000001);
                    throw Win32("WaitForSingleObject");
                }
            }
            ReadUsage(job, out cpuTimeMs, out memoryPeakBytes, out finalTotalProcesses, out activeProcessCount);
            processPeakCount = Math.Max(processPeakCount, activeProcessCount);
            if (terminationReason == 0 && cpuTimeMs >= request.limits.processCpuTimeMs)
                terminationReason = 5;
            else if (terminationReason == 0 && memoryPeakBytes >= request.limits.memoryBytes)
                terminationReason = 6;
            TerminateJobObject(job, 0);
            for (var index = 0; index < 100 && activeProcessCount != 0; index++)
            {
                Thread.Sleep(10);
                ReadUsage(job, out cpuTimeMs, out memoryPeakBytes, out finalTotalProcesses, out activeProcessCount);
            }
            if (activeProcessCount != 0)
                throw new TimeoutException("Job process tree did not reach zero active processes");
            var readersCompleted = Task.WaitAll(new Task[] { stdoutTask, stderrTask }, 5000);
            if (!readersCompleted) throw new TimeoutException("Bounded output readers did not close");
            uint exitCode;
            if (!GetExitCodeProcess(process, out exitCode)) throw Win32("GetExitCodeProcess");
            watch.Stop();
            var reason = terminationReason == 1 ? "WALL_CLOCK_LIMIT" :
                terminationReason == 2 || terminationReason == 3 ? "OUTPUT_LIMIT" :
                terminationReason == 4 ? "CANCELLED" :
                terminationReason == 5 ? "CPU_LIMIT" :
                terminationReason == 6 ? "MEMORY_LIMIT" :
                terminationReason == 7 ? "PROCESS_COUNT_LIMIT" : null;
            return serializer.Serialize(new Response {
                status = reason == null ? "COMPLETED" : "TERMINATED",
                exitCode = reason == null ? (int?)unchecked((int)exitCode) : null,
                reason = reason,
                stdoutBase64 = Convert.ToBase64String(stdoutTask.Result),
                stderrBase64 = Convert.ToBase64String(stderrTask.Result),
                durationMs = watch.ElapsedMilliseconds,
                rootProcessId = checked((int)processInformation.dwProcessId),
                cpuTimeMs = cpuTimeMs,
                memoryPeakBytes = memoryPeakBytes,
                processPeakCount = processPeakCount,
                activeProcessCountAfterCompletion = activeProcessCount,
                descendantTerminationVerified = activeProcessCount == 0
            });
        }
        catch (Exception error)
        {
            if (job != IntPtr.Zero) TerminateJobObject(job, 0xE0000001);
            else if (process != IntPtr.Zero) TerminateProcess(process, 0xE0000001);
            watch.Stop();
            return serializer.Serialize(new Response {
                status = "FAILED_TO_START",
                code = error is Win32Exception ? "WIN32_CALL_FAILED" : "BRIDGE_FAILURE",
                message = error.ToString(),
                durationMs = watch.ElapsedMilliseconds
            });
        }
        finally
        {
            if (environmentPin.IsAllocated) environmentPin.Free();
            if (executableLock != null) executableLock.Dispose();
            if (attributeList != IntPtr.Zero) {
                DeleteProcThreadAttributeList(attributeList);
                Marshal.FreeHGlobal(attributeList);
            }
            if (inheritedHandlesPointer != IntPtr.Zero) Marshal.FreeHGlobal(inheritedHandlesPointer);
            if (limitsPointer != IntPtr.Zero) Marshal.FreeHGlobal(limitsPointer);
            if (stdoutWrite != IntPtr.Zero) CloseHandle(stdoutWrite);
            if (stderrWrite != IntPtr.Zero) CloseHandle(stderrWrite);
            if (stdoutRead != IntPtr.Zero) CloseHandle(stdoutRead);
            if (stderrRead != IntPtr.Zero) CloseHandle(stderrRead);
            if (stdinHandle != IntPtr.Zero && stdinHandle != new IntPtr(-1)) CloseHandle(stdinHandle);
            if (thread != IntPtr.Zero) CloseHandle(thread);
            if (process != IntPtr.Zero) CloseHandle(process);
            if (job != IntPtr.Zero) CloseHandle(job);
            if (completionPort != IntPtr.Zero) CloseHandle(completionPort);
        }
    }
}
'@

if ($Probe) {
  $probeDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("aseos-job-probe-" + [Guid]::NewGuid().ToString("N"))
  [System.IO.Directory]::CreateDirectory($probeDirectory) | Out-Null
  try {
    $probeExecutable = Join-Path $env:SystemRoot "System32\whoami.exe"
    $probeRequest = @{
      executable = $probeExecutable
      executableSha256 = (Get-FileHash -LiteralPath $probeExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
      arguments = @()
      workingDirectory = $probeDirectory
      environment = @{}
      cancellationPath = (Join-Path $probeDirectory "cancel")
      limits = @{
        wallClockMs = 5000
        processCpuTimeMs = 2000
        memoryBytes = 67108864
        activeProcessLimit = 4
        stdoutBytes = 65536
        stderrBytes = 65536
      }
    } | ConvertTo-Json -Depth 8 -Compress
    $probeResult = [AseosWindowsProcessRestrictedBridge]::Run($probeRequest) | ConvertFrom-Json
    $available = $probeResult.status -eq "COMPLETED" -and $probeResult.exitCode -eq 0
    [Console]::Out.Write((@{
      available = $available
      nestedProcessAssignmentSupported = $available
      windowsBuild = [Environment]::OSVersion.Version.ToString(3)
      reasonCode = $(if ($available) { $null } else { "WIN32_JOB_OBJECT_PROBE_FAILED" })
      diagnostic = $(if ($available) { $null } else { ($probeResult.status + ":" + $probeResult.reason + ":" + $probeResult.message) })
    } | ConvertTo-Json -Compress))
  }
  finally {
    Remove-Item -LiteralPath $probeDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

if ([string]::IsNullOrWhiteSpace($RequestPath)) {
  throw "RequestPath is required unless -Probe is used"
}
$requestJson = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $RequestPath))
[Console]::Out.Write([AseosWindowsProcessRestrictedBridge]::Run($requestJson))
