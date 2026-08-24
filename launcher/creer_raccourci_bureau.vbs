Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

' Dossier ou se trouve ce script (launcher/)
scriptDir = oFS.GetParentFolderName(WScript.ScriptFullName)

' Chemins
targetStartBat = scriptDir & "\start_jobtracker.bat"
targetStopBat = scriptDir & "\stop_jobtracker.bat"
iconFile = scriptDir & "\jobtracker.ico"
desktopPath = oShell.SpecialFolders("Desktop")
shortcutStartPath = desktopPath & "\JobTracker AI.lnk"
shortcutStopPath = desktopPath & "\Arreter JobTracker AI.lnk"

' Verification que les fichiers necessaires existent
If Not oFS.FileExists(targetStartBat) Then
    MsgBox "Erreur : impossible de trouver start_jobtracker.bat" & vbCrLf & _
           "Ce script doit rester dans le dossier 'launcher'.", vbCritical, "JobTracker AI"
    WScript.Quit 1
End If

' Raccourci de demarrage
Set oShortcut = oShell.CreateShortcut(shortcutStartPath)
oShortcut.TargetPath = targetStartBat
oShortcut.WorkingDirectory = scriptDir
oShortcut.WindowStyle = 1
oShortcut.Description = "Lancer JobTracker AI"
If oFS.FileExists(iconFile) Then
    oShortcut.IconLocation = iconFile
End If
oShortcut.Save

' Raccourci d'arret
If oFS.FileExists(targetStopBat) Then
    Set oShortcutStop = oShell.CreateShortcut(shortcutStopPath)
    oShortcutStop.TargetPath = targetStopBat
    oShortcutStop.WorkingDirectory = scriptDir
    oShortcutStop.WindowStyle = 1
    oShortcutStop.Description = "Arreter JobTracker AI"
    If oFS.FileExists(iconFile) Then
        oShortcutStop.IconLocation = iconFile
    End If
    oShortcutStop.Save
End If

MsgBox "Les raccourcis ont ete crees sur ton Bureau :" & vbCrLf & _
       "- ""JobTracker AI"" pour lancer l'application" & vbCrLf & _
       "- ""Arreter JobTracker AI"" pour tout fermer proprement", _
       vbInformation, "JobTracker AI"
