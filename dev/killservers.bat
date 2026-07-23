@echo off
setlocal
call "%~dp0killdev.bat"

cd /d "%~dp0.."
where docker >nul 2>nul
if errorlevel 1 (
  echo [intra] Docker not found on PATH — skipping Postgres/Redis shutdown.
  goto :eof
)

echo [intra] Stopping local Postgres/Redis containers (data is preserved)...
docker compose -p intra-dev -f docker-compose.dev.yml down

echo [intra] Done. Run dev\runservers.bat to start everything again.
endlocal
exit /b 0
