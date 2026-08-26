Set oShell = CreateObject("WScript.Shell")
Set oFS = CreateObject("Scripting.FileSystemObject")

scriptDir = oFS.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\restart_backend.bat"

If Not oFS.FileExists(batPath) Then
    MsgBox "Erreur : restart_backend.bat introuvable dans " & scriptDir & vbCrLf & _
           "Ce script doit rester dans le dossier 'launcher'.", vbCritical, "JobTracker AI"
    WScript.Quit 1
End If

' HKCU (utilisateur courant) : ne necessite PAS de droits administrateur,
' contrairement a HKEY_CLASSES_ROOT.
basePath = "HKCU\Software\Classes\jobtracker\"

On Error Resume Next
oShell.RegWrite basePath, "URL:JobTracker Protocol", "REG_SZ"
oShell.RegWrite basePath & "URL Protocol", "", "REG_SZ"
oShell.RegWrite basePath & "shell\open\command\", Chr(34) & batPath & Chr(34) & " ""%1""", "REG_SZ"

If Err.Number <> 0 Then
    MsgBox "Erreur lors de l'enregistrement : " & Err.Description, vbCritical, "JobTracker AI"
    WScript.Quit 1
End If
On Error Goto 0

MsgBox "Le protocole jobtracker:// a ete enregistre avec succes." & vbCrLf & vbCrLf & _
       "Le bouton ""Backend hors ligne"" dans l'appli peut maintenant " & _
       "relancer le backend automatiquement." & vbCrLf & vbCrLf & _
       "Note : la premiere fois, ton navigateur va probablement demander " & _
       "confirmation avant d'ouvrir le lien (c'est normal et attendu).", _
       vbInformation, "JobTracker AI"
