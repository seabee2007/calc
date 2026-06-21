$root = Split-Path $PSScriptRoot -Parent
$downloads = Join-Path $env:USERPROFILE 'Downloads'
$install = Join-Path $PSScriptRoot 'install-design-texture-pack.ps1'

$packs = @(
  @{ zip = 'CorrugatedSteel006A_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-006a'; prefix = 'CorrugatedSteel006A_1K-JPG' },
  @{ zip = 'CorrugatedSteel001_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-001'; prefix = 'CorrugatedSteel001_1K-JPG' },
  @{ zip = 'CorrugatedSteel008C_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-008c'; prefix = 'CorrugatedSteel008C_1K-JPG' },
  @{ zip = 'CorrugatedSteel002_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-002'; prefix = 'CorrugatedSteel002_1K-JPG' },
  @{ zip = 'CorrugatedSteel004_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-004'; prefix = 'CorrugatedSteel004_1K-JPG' },
  @{ zip = 'CorrugatedSteel007A_1K-JPG.zip'; dest = 'public\textures\roof\corrugated-steel-007a'; prefix = 'CorrugatedSteel007A_1K-JPG' },
  @{ zip = 'Metal037_1K-JPG.zip'; dest = 'public\textures\steel\metal-037'; prefix = 'Metal037_1K-JPG' },
  @{ zip = 'Concrete048_1K-JPG.zip'; dest = 'public\textures\concrete\concrete-048'; prefix = 'Concrete048_1K-JPG' },
  @{ zip = 'Concrete031_1K-JPG.zip'; dest = 'public\textures\concrete\concrete-031'; prefix = 'Concrete031_1K-JPG' },
  @{ zip = 'Concrete017_1K-JPG.zip'; dest = 'public\textures\concrete\concrete-017'; prefix = 'Concrete017_1K-JPG' },
  @{ zip = 'Ground037_1K-JPG.zip'; dest = 'public\textures\terrain\ground-037'; prefix = 'Ground037_1K-JPG' },
  @{ zip = 'Grass007_1K-JPG.zip'; dest = 'public\textures\terrain\grass-007'; prefix = 'Grass007_1K-JPG' },
  @{ zip = 'Ground003_1K-JPG.zip'; dest = 'public\textures\terrain\ground-003'; prefix = 'Ground003_1K-JPG' },
  @{ zip = 'Grass004_1K-JPG.zip'; dest = 'public\textures\terrain\grass-004'; prefix = 'Grass004_1K-JPG' },
  @{ zip = 'Snow015_1K-JPG.zip'; dest = 'public\textures\terrain\snow-015'; prefix = 'Snow015_1K-JPG' },
  @{ zip = 'Ground075_1K-JPG.zip'; dest = 'public\textures\terrain\ground-075'; prefix = 'Ground075_1K-JPG' },
  @{ zip = 'WoodSiding013_1K-JPG.zip'; dest = 'public\textures\wood\wood-siding-013'; prefix = 'WoodSiding013_1K-JPG' },
  @{ zip = 'Wood095_1K-JPG.zip'; dest = 'public\textures\wood\wood-095'; prefix = 'Wood095_1K-JPG' },
  @{ zip = 'Wood066_1K-JPG.zip'; dest = 'public\textures\wood\wood-066'; prefix = 'Wood066_1K-JPG' },
  @{ zip = 'Wood067_1K-JPG.zip'; dest = 'public\textures\wood\wood-067'; prefix = 'Wood067_1K-JPG' },
  @{ zip = 'PavingStones150_1K-JPG.zip'; dest = 'public\textures\terrain\paving-stones-150'; prefix = 'PavingStones150_1K-JPG' },
  @{ zip = 'Rock064_1K-JPG.zip'; dest = 'public\textures\terrain\rock-064'; prefix = 'Rock064_1K-JPG' }
)

$installed = 0
$missing = 0
foreach ($pack in $packs) {
  $zipPath = Join-Path $downloads $pack.zip
  if (-not (Test-Path $zipPath)) {
    Write-Warning "Missing zip: $zipPath"
    $missing += 1
    continue
  }
  & $install -ZipPath $zipPath -DestinationFolder (Join-Path $root $pack.dest) -Prefix $pack.prefix
  $installed += 1
}

Write-Host "Installed $installed pack(s). Missing $missing zip(s)."
