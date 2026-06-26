@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js nao encontrado.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo Dependencias do backend nao encontradas em backend\node_modules.
  echo Execute npm install na pasta backend antes de abrir o app.
  pause
  exit /b 1
)

echo Iniciando backend local...
start "Conversor PDF Excel Estrutural" cmd /k "cd /d ""%~dp0"" && npm.cmd run start"
timeout /t 2 >nul
start "" "http://127.0.0.1:8787"
