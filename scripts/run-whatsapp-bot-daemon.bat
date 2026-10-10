@echo off
title Mauze Tahfeez WhatsApp Bot 24/7 Super-Daemon
setlocal

:: Force project root directory
cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"

:: Setup logs
if not exist "%PROJECT_ROOT%\logs" mkdir "%PROJECT_ROOT%\logs"
set "DAEMON_LOG=%PROJECT_ROOT%\logs\daemon.log"
set "BOT_LOG=%PROJECT_ROOT%\logs\whatsapp-bot.log"

:: Locate Node.js executable
set "NODE_EXE=node"
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

echo ========================================================================= >> "%DAEMON_LOG%"
echo [%date% %time%] [DAEMON-START] Mauze Tahfeez WhatsApp Bot Super-Daemon active >> "%DAEMON_LOG%"
echo [%date% %time%] [DAEMON] Root Directory: %PROJECT_ROOT% >> "%DAEMON_LOG%"
echo [%date% %time%] [DAEMON] Node Executable: %NODE_EXE% >> "%DAEMON_LOG%"
echo ========================================================================= >> "%DAEMON_LOG%"

:: Wait 5s on boot for network
ping 127.0.0.1 -n 6 >nul 2>&1

:LOOP
echo [%date% %time%] [DAEMON] Launching Mauze Tahfeez WhatsApp Bot Engine... >> "%DAEMON_LOG%"
echo [%date% %time%] ================= BOT ENGINE START ================= >> "%BOT_LOG%"

call "%NODE_EXE%" --max-old-space-size=2048 "scripts\mauze-whatsapp-bot.js" >> "%BOT_LOG%" 2>&1

echo [%date% %time%] [DAEMON-WARNING] Bot process exited. Auto-restarting in 3 seconds... >> "%DAEMON_LOG%"
ping 127.0.0.1 -n 4 >nul 2>&1
goto LOOP
