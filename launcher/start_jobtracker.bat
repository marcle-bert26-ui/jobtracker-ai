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

REM --- Nettoyage d'un lancement precedent mal ferme -------------------
REM Si des fenetres "JobTracker - Backend/Frontend" trainent deja (par
REM exemple fermees avec la petite croix sans que les processus enfants
REM (uvicorn/node) ne s'arretent avec), on les ferme avant de relancer.
REM Sinon : port deja utilise, fichier de log deja ouvert par l'ancien
REM processus, etc. Voir aussi restart_backend.bat qui fait deja ca pour
REM le backend seul.
echo Nettoyage d'un lancement precedent eventuel...
taskkill /FI "WINDOWTITLE eq JobTracker - Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq JobTracker - Frontend*" /T /F >nul 2>&1

REM Filet de securite : si un ancien processus est reste accroche a l'un
REM des deux ports (echappe a la fermeture ci-dessus), on le ferme aussi.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
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
