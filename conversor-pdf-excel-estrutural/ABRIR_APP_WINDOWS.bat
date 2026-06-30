@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CODEX_CACHE_BUSTER=%RANDOM%%RANDOM%%RANDOM%"

where py >nul 2>nul
if %errorlevel% equ 0 (
  start "" "http://127.0.0.1:8787/?v=%CODEX_CACHE_BUSTER%"
  py -3 server.py
  exit /b
)

where python >nul 2>nul
if %errorlevel% equ 0 (
  start "" "http://127.0.0.1:8787/?v=%CODEX_CACHE_BUSTER%"
  python server.py
  exit /b
)

echo Python nao encontrado.
echo Abra a pasta em um servidor estatico local.
pause
