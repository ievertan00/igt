param([string]$NodeExe, [string]$OwnerEntry, [string]$Instance)
& $NodeExe $OwnerEntry $Instance
exit $LASTEXITCODE
