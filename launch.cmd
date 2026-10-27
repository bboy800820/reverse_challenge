@echo off
setlocal
cd /d "%~dp0app"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js with npm is required. Install Node.js 24 LTS, then try again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run dev -- --open
if errorlevel 1 (
  echo If port 5187 is already in use, open http://127.0.0.1:5187 in your browser.
  pause
)
