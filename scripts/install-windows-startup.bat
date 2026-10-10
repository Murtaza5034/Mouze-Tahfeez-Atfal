@echo off
title Installing Mauze Tahfeez WhatsApp Bot 24/7 Permanent Background Service
color 0B
setlocal EnableDelayedExpansion

:: 1. Self-Elevation Check (Request Admin Rights for Task Scheduler)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges to register 24/7 Windows Scheduled Task...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0\.."
set "PROJECT_ROOT=%CD%"
set "SCRIPT_PATH=%~dp0mauze-bot-autorun-service.vbs"
set "DAEMON_BAT=%~dp0run-whatsapp-bot-daemon.bat"

echo =========================================================================
echo   MAUZE TAHFEEZ - 24/7 PERMANENT WHATSAPP BOT AUTO-RUN INSTALLER
echo =========================================================================
echo.
echo Project Directory : %PROJECT_ROOT%
echo Daemon Service    : %SCRIPT_PATH%
echo.

:: 2. Register Startup Shortcut in User Startup Folder
echo [1/3] Registering Windows User Startup Shortcut...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $startupPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup); $shortcut = $ws.CreateShortcut($startupPath + '\MauzeWhatsAppBot.lnk'); $shortcut.TargetPath = 'wscript.exe'; $shortcut.Arguments = '\"%SCRIPT_PATH%\"'; $shortcut.WorkingDirectory = '%PROJECT_ROOT%'; $shortcut.WindowStyle = 7; $shortcut.Description = 'Mauze Tahfeez 24/7 WhatsApp Bot Service'; $shortcut.Save()"

if %errorlevel% equ 0 (
    echo       [OK] Startup folder shortcut successfully registered.
) else (
    echo       [WARN] Could not register Startup folder shortcut.
)

:: 3. Register Resilient Windows Scheduled Task (Runs on Logon / Boot with highest privileges)
echo.
echo [2/3] Registering Windows Scheduled Task for 24/7 Boot Resilience...
schtasks /delete /tn "MauzeTahfeezWhatsAppBot" /f >nul 2>&1

:: Create scheduled task triggered at logon
schtasks /create /tn "MauzeTahfeezWhatsAppBot" /tr "wscript.exe \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Windows Scheduled Task 'MauzeTahfeezWhatsAppBot' successfully created.
) else (
    echo       [WARN] Creating elevated scheduled task failed.
)

:: 4. Start the background service immediately
echo.
echo [3/3] Launching Bot Daemon in background now...
wscript.exe "%SCRIPT_PATH%"

echo.
echo =========================================================================
echo   SUCCESS! WHATSAPP BOT IS CONFIGURED TO RUN ALWAYS (24/7):
echo.
echo   1. Starts automatically every time Windows boots / PC turns on.
echo   2. Runs 100%% silently in the background (no popup windows).
echo   3. Automatically auto-restarts within 3 seconds if disconnected or crashed.
echo   4. Realtime Web Dashboard : http://localhost:2785
echo   5. Log files stored at   : %PROJECT_ROOT%\logs\
echo =========================================================================
echo.
echo Press any key to exit installer...
pause >nul
