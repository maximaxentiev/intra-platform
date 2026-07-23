@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "ROOT=%CD%"

echo ============================================
echo  Intra Platform - starting local dev stack
echo ============================================
echo.

echo [intra] Stopping any previously running local dev servers...
call "%ROOT%\dev\killdev.bat"
echo.

if not exist "%ROOT%\.env" (
  echo [intra] No .env found - creating one from .env.example with local defaults...
  copy /y "%ROOT%\.env.example" "%ROOT%\.env" >nul
  echo [intra] Created .env - edit it later if you need different settings.
  echo.
)

where node >nul 2>nul
if errorlevel 1 (
  echo [intra] ERROR: Node.js was not found on PATH.
  echo [intra] Install Node 22+ from https://nodejs.org, restart this terminal, and try again.
  pause
  exit /b 1
)

node -e "const m=Number(process.versions.node.split('.')[0]); if (m < 22) { console.error('[intra] ERROR: Node 22+ is required, found ' + process.versions.node); process.exit(1); }"
if errorlevel 1 (
  pause
  exit /b 1
)

call "%ROOT%\dev\postgres-dev-up.bat"
if errorlevel 1 (
  echo.
  echo [intra] Could not start Postgres/Redis - see errors above.
  pause
  exit /b 1
)
echo.

if not exist "%ROOT%\node_modules" (
  echo [intra] Installing dependencies - first run only, this can take a few minutes...
  call npm install --no-audit
  if errorlevel 1 (
    echo [intra] ERROR: npm install failed. See output above.
    pause
    exit /b 1
  )
  echo.
)

echo [intra] Applying database migrations...
call npm run db:migrate
if errorlevel 1 (
  echo [intra] ERROR: Database migration failed. See output above.
  pause
  exit /b 1
)
echo.

echo [intra] Launching API and Web in separate windows...
start "intra - API" cmd /k call "%ROOT%\dev\runback.bat"
start "intra - Web" cmd /k call "%ROOT%\dev\runfront.bat"

echo.
echo ============================================
echo  Done. Two windows opened: "intra - API" and "intra - Web".
echo  Leave them open while you work. Closing them stops the servers.
echo ============================================
echo.
type "%ROOT%\dev\HOWTO-local.txt"
echo.
pause
endlocal
exit /b 0
