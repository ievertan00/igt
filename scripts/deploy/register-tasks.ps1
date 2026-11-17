# Registers the ClearWrite runtime and daily backup as scheduled tasks for the
# current user. Run from an ordinary (non-admin) PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy\register-tasks.ps1 -ReleaseDir DIR -BackupDir DIR -LogDir DIR
param(
  [Parameter(Mandatory = $true)][string]$ReleaseDir,
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [Parameter(Mandatory = $true)][string]$LogDir
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node.exe).Source
$user = "$env:USERDOMAIN\$env:USERNAME"

$settings = New-ScheduledTaskSettingsSet `
  -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew

# S4U runs at boot without storing a password; fall back to interactive logon
# if the policy on this machine rejects it.
$logonType = "S4U"
try {
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
  $webAction = New-ScheduledTaskAction -Execute $node -Argument "scripts\deploy\service-launcher.mjs --logs `"$LogDir`"" -WorkingDirectory $ReleaseDir
  $webTrigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName "IGT ClearWrite Web" -Action $webAction -Trigger $webTrigger -Settings $settings -Principal $principal -Force | Out-Null
} catch {
  Write-Warning "S4U registration failed ($_); falling back to interactive logon trigger."
  $logonType = "Interactive"
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  $webAction = New-ScheduledTaskAction -Execute $node -Argument "scripts\deploy\service-launcher.mjs --logs `"$LogDir`"" -WorkingDirectory $ReleaseDir
  $webTrigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  Register-ScheduledTask -TaskName "IGT ClearWrite Web" -Action $webAction -Trigger $webTrigger -Settings $settings -Principal $principal -Force | Out-Null
}

$backupAction = New-ScheduledTaskAction -Execute $node -Argument "scripts\deploy\backup.mjs --dest `"$BackupDir`"" -WorkingDirectory $ReleaseDir
$backupTrigger = New-ScheduledTaskTrigger -Daily -At "03:30"
Register-ScheduledTask -TaskName "IGT ClearWrite Backup" -Action $backupAction -Trigger $backupTrigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Output "Registered tasks (logon type: $logonType):"
Get-ScheduledTask -TaskName "IGT ClearWrite*" | Select-Object TaskName, State | Format-Table