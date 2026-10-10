@echo off
title Stop Mauze Tahfeez WhatsApp Bot Service
color 0C
cd /d "%~dp0\.."

echo =========================================================================
echo   STOPPING MAUZE TAHFEEZ WHATSAPP BOT SERVICE...
echo =========================================================================

echo.
echo [1] Terminating running WhatsApp Bot daemon and node processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2785 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    echo     Terminated port 2785 process (PID: %%a)
)

:: Terminate cmd process running run-whatsapp-bot-daemon if matched by title
taskkill /F /FI "WINDOWTITLE eq Mauze Tahfeez WhatsApp Bot 24/7 Super-Daemon*" >nul 2>&1

echo.
echo [2] Checking status...
ping 127.0.0.1 -n 2 >nul 2>&1
netstat -ano | findstr :2785 >nul 2>&1
if %errorlevel% neq 0 (
    echo [OK] WhatsApp Bot Service successfully stopped.
) else (
    echo [WARN] Some processes may still be running.
)
echo.
pause
