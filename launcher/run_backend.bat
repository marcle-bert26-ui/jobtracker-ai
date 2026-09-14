@echo off
cd /d "%~1"
call .venv\Scripts\activate.bat
powershell -NoLogo -Command "& { try { Start-Transcript -Path sync_log.txt -Force -ErrorAction Stop | Out-Null } catch { Write-Host 'Journal (sync_log.txt) deja utilise par une autre fenetre - poursuite sans journal pour cette session.' -ForegroundColor Yellow }; uvicorn main:app --reload; try { Stop-Transcript | Out-Null } catch {} }"
