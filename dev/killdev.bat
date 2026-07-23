@echo off
setlocal enabledelayedexpansion
echo [intra] Stopping local API/Web dev server windows (if running)...

taskkill /FI "WINDOWTITLE eq intra - API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq intra - Web*" /T /F >nul 2>nul

echo [intra] Freeing dev ports (8000 API, 3000/8080/5173 Web)...
for %%P in (8000 3000 8080 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /c:":%%P " ^| findstr "LISTENING"') do (
    echo [intra]   killing PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>nul
  )
)

echo [intra] Done.
endlocal
exit /b 0
