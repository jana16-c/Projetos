@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Baixando bibliotecas locais para o Conversor PDF Excel Estrutural...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\baixar-bibliotecas.ps1"

if %errorlevel% neq 0 (
  echo.
  echo Nao foi possivel baixar as bibliotecas automaticamente.
  echo Verifique sua conexao ou consulte assets\js\vendor\README.md.
  pause
  exit /b 1
)

echo.
echo Bibliotecas baixadas com sucesso.
echo Agora execute ABRIR_APP_WINDOWS.bat.
pause
