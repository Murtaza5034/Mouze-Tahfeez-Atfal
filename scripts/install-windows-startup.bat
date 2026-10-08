@echo off
title Installing Mauze Tahfeez WhatsApp Bot Windows Auto-Startup
cd /d "%~dp0\.."

set SCRIPT_PATH=%~dp0mauze-bot-autorun-service.vbs
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\MauzeWhatsAppBot.lnk

echo =========================================================================
echo Setting up WhatsApp Bot Silent Auto-Startup on PC Boot...
echo =========================================================================

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%SCRIPT_PATH%\"'; $s.WorkingDirectory = '%~dp0..'; $s.WindowStyle = 7; $s.Save()"

echo.
echo [SUCCESS] WhatsApp Bot registered to start silently every time Windows boots!
echo Shortcut location: %SHORTCUT_PATH%
echo Target: %SCRIPT_PATH%
echo.
echo Starting bot service now in background...
start "" wscript.exe "%SCRIPT_PATH%"
echo Bot daemon launched!
