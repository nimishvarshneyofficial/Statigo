@echo off
REM Start-dev helper for Statigo (Windows)
REM Usage: double-click or run from project folder: start-dev.bat

cd /d "%~dp0"

echo [Statigo] Checking for dependencies...
if not exist node_modules (
  echo [Statigo] Installing npm dependencies (this may take a minute)...
  npm install
)

echo [Statigo] Starting development servers in a new window...
start "Statigo - Dev" cmd /k "npm run dev"

timeout /t 1 >nul
echo [Statigo] Opening frontend in the default browser...
start "" "http://localhost:5173"

echo [Statigo] Done. Dev servers are running in a separate terminal window.
echo Press any key to close this helper window.
pause >nul
