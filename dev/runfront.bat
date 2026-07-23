@echo off
setlocal
cd /d "%~dp0.."
echo [intra] Starting Web (Vite / TanStack Start) — usually http://localhost:8080
call npm run dev:web
endlocal
