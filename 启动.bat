@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting local server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to start. Please send the error text above to support.
  pause
)
