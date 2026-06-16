$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $root "assets\js\vendor"
New-Item -ItemType Directory -Force -Path $vendor | Out-Null

$arquivos = @(
  @{
    Nome = "pdf.min.js"
    Url = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
  },
  @{
    Nome = "pdf.worker.min.js"
    Url = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
  },
  @{
    Nome = "exceljs.min.js"
    Url = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"
  },
  @{
    Nome = "zip-full.min.js"
    Url = "https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/dist/zip-full.min.js"
  }
)

foreach ($arquivo in $arquivos) {
  $destino = Join-Path $vendor $arquivo.Nome
  Write-Host "Baixando $($arquivo.Nome)..."
  Invoke-WebRequest -Uri $arquivo.Url -OutFile $destino -UseBasicParsing
}

Write-Host "Concluido."
