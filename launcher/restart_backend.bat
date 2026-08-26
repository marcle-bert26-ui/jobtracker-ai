@echo off
title JobTracker AI - Redemarrage backend
setlocal

REM Se placer a la racine du projet (ce script est dans launcher/)
cd /d "%~dp0.."
set "ROOT=%cd%"

REM Ferme une eventuelle fenetre backend deja ouverte (ex: plantee/bloquee)
taskkill /FI "WINDOWTITLE eq JobTracker - Backend*" /T /F >nul 2>&1

REM Filet de securite : si un ancien processus uvicorn est reste accroche
REM au port 8000 (ex: echappe a l'arret ci-dessus a cause du pipe PowerShell/
REM Tee-Object), on le ferme aussi pour eviter un "port deja utilise".
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

if not exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
    msg "%username%" "JobTracker AI : environnement backend introuvable (.venv manquant)." 2>nul
    exit /b 1
)

start "JobTracker - Backend" cmd /k call "%~dp0run_backend.bat" "%ROOT%\backend"

endlocal
exit /b 0
