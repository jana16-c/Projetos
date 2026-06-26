$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $root ".venv"
$requirements = Join-Path $root "ocr\requirements.txt"

if (-not (Test-Path $requirements)) {
  throw "Arquivo de requisitos OCR nao encontrado: $requirements"
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python nao encontrado no PATH."
}

if (-not (Test-Path $venvPath)) {
  Write-Host "Criando ambiente virtual em $venvPath ..."
  python -m venv $venvPath
}

$pythonExe = Join-Path $venvPath "Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
  throw "Python do ambiente virtual nao encontrado: $pythonExe"
}

Write-Host "Atualizando pip..."
& $pythonExe -m pip install --upgrade pip

Write-Host "Instalando dependencias OCR..."
& $pythonExe -m pip install -r $requirements

Write-Host ""
Write-Host "OCR instalado com sucesso."
Write-Host "Python OCR: $pythonExe"
