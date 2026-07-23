@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."

where docker >nul 2>nul
if errorlevel 1 (
  echo [intra] ERROR: Docker was not found on PATH.
  echo [intra] Install Docker Desktop from https://www.docker.com/products/docker-desktop and make sure it's running.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [intra] ERROR: Docker Desktop does not appear to be running.
  echo [intra] Start Docker Desktop, wait for it to finish starting, then try again.
  exit /b 1
)

echo [intra] Starting local Postgres (127.0.0.1:5434) and Redis (127.0.0.1:6380)...
docker compose -p intra-dev -f docker-compose.dev.yml --env-file .env up -d
if errorlevel 1 (
  echo [intra] ERROR: Failed to start Postgres/Redis containers. See output above.
  exit /b 1
)

echo [intra] Waiting for Postgres to become healthy...
set "_tries=0"

:wait_pg
set "_pgstatus="
for /f "usebackq delims=" %%S in (`docker inspect -f "{{.State.Health.Status}}" intra-dev-postgres-1 2^>nul`) do set "_pgstatus=%%S"
if "%_pgstatus%"=="healthy" goto pg_ready

set /a _tries+=1
if %_tries% GEQ 40 (
  echo [intra] ERROR: Postgres did not become healthy in time. Run "docker compose -p intra-dev -f docker-compose.dev.yml logs postgres" to investigate.
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_pg

:pg_ready
echo [intra] Postgres is healthy.
endlocal
exit /b 0
