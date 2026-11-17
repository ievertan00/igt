param([string]$NodeExe, [string]$WorkerScript, [string]$Instance, [string]$Directory, [int]$OwnerId, [int]$GuardianId, [switch]$Background)
$ErrorActionPreference = 'Stop'
$recordPath = Join-Path $Directory 'instance.json'
$requestToken = (Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json).token
$stopPath = Join-Path $Directory 'stop.json'
# Create the worker suspended, attach it before any child can be spawned, then resume.
# This guardian deliberately lives outside the job so it can clean the lock AFTER teardown.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public sealed class IgtJob : IDisposable {
    // ABI layouts: JOBOBJECT_BASIC_LIMIT_INFORMATION, IO_COUNTERS, and
    // JOBOBJECT_EXTENDED_LIMIT_INFORMATION (pointer-size fields remain UIntPtr).
    [StructLayout(LayoutKind.Sequential)] struct Basic { public long processTimeLimit,jobTimeLimit; public uint limitFlags; public UIntPtr minWorkingSet,maxWorkingSet; public uint activeProcessLimit; public UIntPtr affinity; public uint priorityClass,schedulingClass; }
    [StructLayout(LayoutKind.Sequential)] struct Io { public ulong readOperations,writeOperations,otherOperations,readBytes,writeBytes,otherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic; public Io io; public UIntPtr processMemoryLimit,jobMemoryLimit,peakProcessMemory,peakJobMemory; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup {
        public int cb; public string reserved,desktop,title; public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reserved2;
        public IntPtr reservedPtr,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct Info { public IntPtr process,thread; public uint pid,tid; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Entry {
        public uint size,usage,pid; public UIntPtr heap; public uint module,threads,parent; public int priority; public uint flags;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string exe;
    }
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint length);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFile(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr a,IntPtr b,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out Info info);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32First(IntPtr snapshot,ref Entry entry);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32Next(IntPtr snapshot,ref Entry entry);
    IntPtr job;
    static void Check(bool value) { if(!value) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    static string Quote(string value) {
        StringBuilder result=new StringBuilder("\""); int slashes=0;
        foreach(char c in value) {
            if(c=='\\') { slashes++; continue; }
            result.Append('\\', c=='"' ? slashes*2+1 : slashes); result.Append(c); slashes=0;
        }
        return result.Append('\\',slashes*2).Append('"').ToString();
    }
    public IgtJob() {
        job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) throw new Win32Exception();
        Extended limits=new Extended(); limits.basic.limitFlags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended))));
    }
    public Process Launch(string node,string script,string instance,string directory,string cwd) {
        using(FileStream output=new FileStream(Path.Combine(directory,"stdout.log"),FileMode.Create,FileAccess.Write,FileShare.ReadWrite))
        using(FileStream error=new FileStream(Path.Combine(directory,"stderr.log"),FileMode.Create,FileAccess.Write,FileShare.ReadWrite)) {
            IntPtr inHandle=CreateFile("NUL",0x80000000,3,IntPtr.Zero,3,0,IntPtr.Zero);
            if(inHandle==new IntPtr(-1)) throw new Win32Exception();
            try {
            IntPtr outHandle=output.SafeFileHandle.DangerousGetHandle(), errHandle=error.SafeFileHandle.DangerousGetHandle();
            Check(SetHandleInformation(outHandle,1,1)); Check(SetHandleInformation(errHandle,1,1)); Check(SetHandleInformation(inHandle,1,1));
            Startup startup=new Startup(); startup.cb=Marshal.SizeOf(typeof(Startup)); startup.flags=0x100; startup.output=outHandle; startup.error=errHandle; startup.input=inHandle;
            Info info;
            Check(CreateProcess(node,new StringBuilder(Quote(node)+" "+Quote(script)+" "+Quote(instance)),IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref startup,out info));
            try {
                Check(AssignProcessToJobObject(job,info.process));
                Process worker=Process.GetProcessById((int)info.pid); IntPtr retained=worker.Handle;
                if(ResumeThread(info.thread)==0xffffffff) throw new Win32Exception();
                return worker;
            } catch { TerminateProcess(info.process,1); throw; }
            finally { CloseHandle(info.thread); CloseHandle(info.process); }
            } finally { CloseHandle(inHandle); }
        }
    }
    public static Process[] Owners(int owner) {
        Dictionary<uint,Entry> entries=new Dictionary<uint,Entry>();
        IntPtr snapshot=CreateToolhelp32Snapshot(2,0); if(snapshot==new IntPtr(-1)) throw new Win32Exception();
        try { Entry e=new Entry(); e.size=(uint)Marshal.SizeOf(typeof(Entry)); if(Process32First(snapshot,ref e)) do { entries[e.pid]=e; } while(Process32Next(snapshot,ref e)); }
        finally { CloseHandle(snapshot); }
        List<Process> owners=new List<Process>(); HashSet<uint> seen=new HashSet<uint>(); uint current=(uint)owner;
        DateTime youngest=DateTime.MaxValue;
        while(current>0 && seen.Add(current)) {
            Entry e; if(!entries.TryGetValue(current,out e)) break;
            string name=e.exe.ToLowerInvariant();
            if(name=="explorer.exe" || name=="services.exe" || name=="svchost.exe" || name=="wininit.exe") break;
            try {
                Process p=Process.GetProcessById((int)current); IntPtr retained=p.Handle;
                if(p.StartTime>youngest) { p.Dispose(); break; } // PID reuse is not ancestry.
                youngest=p.StartTime;
                if(current==(uint)owner || name=="cmd.exe" || name=="pwsh.exe" || name=="powershell.exe" || name=="sh.exe" || name=="bash.exe" || name=="windowsterminal.exe" || name=="openconsole.exe") owners.Add(p);
                else p.Dispose();
            } catch { if(current==(uint)owner) throw; break; }
            current=e.parent;
        }
        return owners.ToArray();
    }
    public void Dispose() { if(job!=IntPtr.Zero) { TerminateJobObject(job,1); CloseHandle(job); job=IntPtr.Zero; } }
}
'@
$job = $null
$owners = @()
try {
    if (-not $Background) { $owners = @([IgtJob]::Owners($OwnerId)) }
    $guardianOwner = [System.Diagnostics.Process]::GetProcessById($GuardianId)
    $retainedHandle = $guardianOwner.Handle
    $owners += $guardianOwner
    $job = [IgtJob]::new()
    $worker = $job.Launch($NodeExe, $WorkerScript, $Instance, $Directory, (Get-Location).Path)
    $stopDeadline = $null
    while (-not $worker.WaitForExit(250)) {
        foreach ($owner in $owners) {
            if ($owner.HasExited -and -not $stopDeadline) {
                @{ token = $requestToken } | ConvertTo-Json -Compress | Set-Content -LiteralPath $stopPath -Encoding UTF8
            }
        }
        if (-not $stopDeadline -and (Test-Path -LiteralPath $stopPath)) {
            try {
                if ((Get-Content -LiteralPath $stopPath -Raw | ConvertFrom-Json).token -eq $requestToken) { $stopDeadline = [DateTime]::UtcNow.AddSeconds(6) }
            } catch { } # A writer may still be finishing the small request file.
        }
        if ($stopDeadline -and [DateTime]::UtcNow -ge $stopDeadline) { return }
    }
    exit $worker.ExitCode
} catch {
    $_ | Out-String | Add-Content -LiteralPath (Join-Path $Directory 'guardian.log') -Encoding UTF8
    exit 1
} finally {
    if ($job) { $job.Dispose() }
    foreach ($owner in $owners) { $owner.Dispose() }
    # Only this guardian removes its lock, after the whole job has been terminated.
    $lock = Join-Path $Directory 'lock'
    if ((Test-Path -LiteralPath $lock) -and (Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json).token -eq $requestToken) { Remove-Item -LiteralPath $lock }
}
