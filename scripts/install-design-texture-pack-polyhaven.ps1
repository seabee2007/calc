param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,
  [Parameter(Mandatory = $true)]
  [string]$DestinationFolder,
  [Parameter(Mandatory = $true)]
  [string]$BaseName
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ZipPath)) {
  throw "Zip not found: $ZipPath"
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("design-texture-poly-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $DestinationFolder -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force

$sourceDir = Join-Path $tmp 'textures'
if (-not (Test-Path $sourceDir)) {
  $sourceDir = $tmp
}

Copy-Item (Join-Path $sourceDir "${BaseName}_*_1k.jpg") $DestinationFolder -Force
Remove-Item $tmp -Recurse -Force
Write-Host "Installed $BaseName -> $DestinationFolder"
