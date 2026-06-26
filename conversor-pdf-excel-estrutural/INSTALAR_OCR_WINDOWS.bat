@echo off
chcp 65001 >nul
cd /d "%~dp0"

where powershell >nul 2>nul
if %errorlevel% neq 0 (
  echo PowerShell nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\instalar-ocr.ps1"

if %errorlevel% neq 0 (
  echo.
  echo Falha na instalacao do OCR.
  pause
  exit /b 1
)

echo.
echo OCR instalado.
pause
