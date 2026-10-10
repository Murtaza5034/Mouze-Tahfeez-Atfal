Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(scriptDir, "run-whatsapp-bot-daemon.bat")
projectDir = fso.GetParentFolderName(scriptDir)
WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd.exe /c call """ & batPath & """", 0, False
