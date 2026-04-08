@echo off
if not exist "%~dp0igt.ps1" (
    echo Error: igt.ps1 not found in %~dp0
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0igt.ps1"
