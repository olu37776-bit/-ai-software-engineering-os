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
