@echo off
cd /d "%~1"
call .venv\Scripts\activate.bat
powershell -NoLogo -Command "& { Start-Transcript -Path sync_log.txt -Force | Out-Null; uvicorn main:app --reload; Stop-Transcript | Out-Null }"
