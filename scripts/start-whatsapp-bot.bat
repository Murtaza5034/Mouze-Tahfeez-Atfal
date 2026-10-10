@echo off
title Start Mauze Tahfeez WhatsApp Bot Service
color 0A
cd /d "%~dp0\.."

echo =========================================================================
echo   STARTING MAUZE TAHFEEZ WHATSAPP BOT SERVICE (BACKGROUND 24/7)
echo =========================================================================
echo.

wscript.exe "%~dp0mauze-bot-autorun-service.vbs"

echo [OK] WhatsApp Bot background service launched.
echo.
echo Checking port 2785 status...
ping 127.0.0.1 -n 6 >nul 2>&1

netstat -ano | findstr :2785 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] WhatsApp Bot is now ONLINE at http://localhost:2785
) else (
    echo [INFO] Bot is initializing in the background. Check logs at logs\whatsapp-bot.log
)

echo.
ping 127.0.0.1 -n 3 >nul 2>&1
