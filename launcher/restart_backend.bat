@echo off
title JobTracker AI - Redemarrage backend
setlocal

REM Se placer a la racine du projet (ce script est dans launcher/)
cd /d "%~dp0.."
set "ROOT=%cd%"

REM Ferme une eventuelle fenetre backend deja ouverte (ex: plantee/bloquee)
taskkill /FI "WINDOWTITLE eq JobTracker - Backend*" /T /F >nul 2>&1

if not exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
    msg "%username%" "JobTracker AI : environnement backend introuvable (.venv manquant)." 2>nul
    exit /b 1
)

start "JobTracker - Backend" cmd /k "cd /d "%ROOT%\backend" && call .venv\Scripts\activate.bat && powershell -NoLogo -Command "& { uvicorn main:app --reload 2>&1 | Tee-Object -FilePath sync_log.txt }""

endlocal
exit /b 0
