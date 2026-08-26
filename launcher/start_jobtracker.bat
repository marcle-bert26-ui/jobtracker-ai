@echo off
title JobTracker AI - Lancement
setlocal

REM Se placer a la racine du projet (ce script est dans launcher/)
cd /d "%~dp0.."
set "ROOT=%cd%"

echo ============================================
echo   JobTracker AI - Demarrage
echo ============================================
echo.

REM --- Verification du venv backend ---
if not exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
    echo [ERREUR] L'environnement virtuel Python n'existe pas encore.
    echo.
    echo Pour le creer, ouvre une invite de commandes dans le dossier
    echo "backend" et lance :
    echo.
    echo     python -m venv .venv
    echo     .venv\Scripts\activate
    echo     pip install fastapi uvicorn sqlalchemy python-dotenv requests msal
    echo.
    pause
    exit /b 1
)

REM --- Verification des dependances frontend ---
if not exist "%ROOT%\frontend\node_modules" (
    echo [ERREUR] Les dependances du frontend ne sont pas installees.
    echo.
    echo Ouvre une invite de commandes dans le dossier "frontend" et lance :
    echo.
    echo     npm install
    echo.
    pause
    exit /b 1
)

REM --- Demarrage du backend (FastAPI) via script dedie (evite les guillemets imbriques) ---
echo Demarrage du backend...
start "JobTracker - Backend" cmd /k call "%~dp0run_backend.bat" "%ROOT%\backend"

REM --- Demarrage du frontend (Next.js) ---
echo Demarrage du frontend...
start "JobTracker - Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"

REM --- Attente que les serveurs soient prets ---
echo.
echo Attente du demarrage des serveurs...
timeout /t 10 /nobreak >nul

REM --- Ouverture du navigateur sur la page principale ---
start "" "http://localhost:3000"

echo.
echo JobTracker AI est lance.
echo Les deux fenetres noires (Backend / Frontend) doivent rester ouvertes
echo tant que tu utilises l'application. Ferme-les pour tout arreter.
echo.

endlocal
exit /b 0
