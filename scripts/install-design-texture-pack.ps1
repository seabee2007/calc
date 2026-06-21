param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,
  [Parameter(Mandatory = $true)]
  [string]$DestinationFolder,
  [Parameter(Mandatory = $true)]
  [string]$Prefix
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ZipPath)) {
  throw "Zip not found: $ZipPath"
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("design-texture-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $DestinationFolder -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force
Copy-Item (Join-Path $tmp "$Prefix`_*.jpg") $DestinationFolder -Force
Remove-Item $tmp -Recurse -Force
Write-Host "Installed $Prefix -> $DestinationFolder"
