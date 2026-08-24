@echo off
title JobTracker AI - Arret
setlocal

echo ============================================
echo   JobTracker AI - Arret
echo ============================================
echo.

set "FOUND=0"

REM --- Fermeture de la fenetre Backend (et ses processus enfants) ---
tasklist /v /fo csv 2>nul | findstr /i "JobTracker - Backend" >nul
if not errorlevel 1 (
    taskkill /FI "WINDOWTITLE eq JobTracker - Backend*" /T /F >nul 2>&1
    echo Backend arrete.
    set "FOUND=1"
)

REM --- Fermeture de la fenetre Frontend (et ses processus enfants) ---
tasklist /v /fo csv 2>nul | findstr /i "JobTracker - Frontend" >nul
if not errorlevel 1 (
    taskkill /FI "WINDOWTITLE eq JobTracker - Frontend*" /T /F >nul 2>&1
    echo Frontend arrete.
    set "FOUND=1"
)

if "%FOUND%"=="0" (
    echo Aucune fenetre JobTracker n'etait ouverte.
) else (
    echo.
    echo JobTracker AI est arrete.
)

echo.
timeout /t 3 >nul
endlocal
exit /b 0
