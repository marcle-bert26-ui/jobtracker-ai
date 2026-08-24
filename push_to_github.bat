@echo off
title JobTracker AI - Envoi vers GitHub
setlocal enabledelayedexpansion

REM Se placer a la racine du projet (ce script y est stocke)
cd /d "%~dp0"

echo ============================================
echo   JobTracker AI - Envoi vers GitHub
echo ============================================
echo.

REM --- Verification que Git est installe ---
where git >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Git n'est pas installe ou pas dans le PATH.
    echo Telecharge-le sur https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM --- Verification que c'est bien un depot Git ---
if not exist ".git" (
    echo [ERREUR] Ce dossier n'est pas un depot Git.
    echo Ce script doit se trouver a la racine du projet ^(a cote du dossier .git^).
    echo.
    pause
    exit /b 1
)

REM --- Ajout de tous les changements ---
git add -A

REM --- Verification qu'il y a bien quelque chose a envoyer ---
git diff --cached --quiet
if not errorlevel 1 (
    echo Aucune modification locale a envoyer.
    echo.
    echo On tente quand meme un "push" au cas ou des commits
    echo seraient deja prets mais pas encore envoyes...
    echo.
    git push
    echo.
    pause
    exit /b 0
)

REM --- Creation du message de commit avec date et heure ---
for /f "tokens=1-3 delims=/. " %%a in ('date /t') do set "DATESTR=%%a-%%b-%%c"
set "TIMESTR=%time:~0,5%"
set "TIMESTR=%TIMESTR::=h%"
set "COMMITMSG=Mise a jour automatique - %date% %TIMESTR%"

echo Enregistrement des modifications...
git commit -m "%COMMITMSG%"

if errorlevel 1 (
    echo.
    echo [ERREUR] Le commit a echoue. Voir le message ci-dessus.
    echo.
    pause
    exit /b 1
)

echo.
echo Envoi vers GitHub...
git push

if errorlevel 1 (
    echo.
    echo [ERREUR] L'envoi a echoue. Verifie ta connexion et tes identifiants GitHub.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Termine ! Tes modifications sont sur GitHub.
echo ============================================
echo.
timeout /t 5 >nul
endlocal
exit /b 0
