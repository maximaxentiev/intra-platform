@echo off
setlocal
cd /d "%~dp0.."
echo [intra] Starting API (NestJS) — http://localhost:8000  (docs: /api/docs)
call npm run dev:api
endlocal
