# Re-applies the low-latency streaming patch to the running CosyVoice container.
#
# The patch is just an extra FastAPI endpoint (/inference_zero_shot_stream, stream=True)
# added to the container's server.py. It lives in the container's writable layer, so it
# is LOST if the container is recreated (docker rm + run, compose recreate, image rebuild).
# Restarting the container (docker restart) preserves it; recreating it does not.
#
# Run this script after recreating the container to restore streaming. You do NOT need it
# for voice to work — without the streaming endpoint IGT automatically falls back to the
# stable non-streaming WAV path (just a bit higher latency on long replies).
#
# Usage:  pwsh tools/cosyvoice/apply-streaming-patch.ps1   [-Container cosyvoice3]

param(
  [string]$Container = "cosyvoice3",
  [string]$Dest = "/opt/CosyVoice/CosyVoice/runtime/python/fastapi/server.py"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $here "server.streaming.py"
if (-not (Test-Path $server)) { throw "missing $server" }

Write-Host "Backing up current server.py from $Container ..."
docker cp "${Container}:${Dest}" (Join-Path $here "server.py.container-bak") 2>$null

Write-Host "Copying streaming server into $Container ..."
docker cp $server "${Container}:${Dest}"

Write-Host "Restarting $Container ..."
docker restart $Container | Out-Null

Write-Host "Done. /inference_zero_shot_stream is now available on the container."
