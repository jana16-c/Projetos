@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel% neq 0 (
  echo Python nao encontrado.
  echo Instale o Python ou execute manualmente um servidor local nesta pasta.
  pause
  exit /b 1
)
echo Iniciando Conversor PDF para Excel Estrutural...
echo.
echo Acesse: http://localhost:8787
echo Para encerrar, feche esta janela.
echo.
start "" "http://localhost:8787"
python server.py
pause
