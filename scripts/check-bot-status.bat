@echo off
title Mauze Tahfeez WhatsApp Bot Status
color 0E
cd /d "%~dp0\.."

echo =========================================================================
echo   MAUZE TAHFEEZ - WHATSAPP BOT STATUS INSPECTOR
echo =========================================================================
echo.

echo [1] Checking Port 2785 Status...
netstat -ano | findstr :2785 | findstr LISTENING
if %errorlevel% equ 0 (
    echo     ==^> [STATUS: ONLINE] WhatsApp Bot Engine is running on port 2785!
) else (
    echo     ==^> [STATUS: OFFLINE] WhatsApp Bot is NOT currently running.
)

echo.
echo [2] Checking Scheduled Task...
schtasks /query /tn "MauzeTahfeezWhatsAppBot" /fo TABLE /nh 2>nul
if %errorlevel% neq 0 (
    echo     ==^> Scheduled Task: NOT FOUND
)

echo.
echo [3] Recent Bot Logs (Last 15 lines):
echo -------------------------------------------------------------------------
powershell -NoProfile -Command "if (Test-Path 'logs\whatsapp-bot.log') { Get-Content 'logs\whatsapp-bot.log' -Tail 15 } else { Write-Host 'No logs found yet.' }"
echo -------------------------------------------------------------------------

echo.
echo Live Dashboard URL: http://localhost:2785
echo.
pause
