@echo off
title Mauze Tahfeez WhatsApp Bot Auto-Restart Daemon
cd /d "%~dp0\.."

:LOOP
echo [%date% %time%] Starting Mauze Tahfeez WhatsApp Bot on port 2785...
node scripts/mauze-whatsapp-bot.js
echo [%date% %time%] WhatsApp Bot exited with code %ERRORLEVEL%. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
