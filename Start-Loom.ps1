# Abre o LOOM: confere o pacote (SHA-256), prepara uma copia local na primeira vez e abre o executavel.
$ErrorActionPreference = 'Stop'
$version = '1.0.0'
$package = Join-Path $PSScriptRoot "distribution\$version\LOOM-$version-win-x64.zip"
$config = Join-Path $PSScriptRoot 'config\loom.config.json'
if (!(Test-Path -LiteralPath $config)) { throw 'Configuracao ausente: config\loom.config.json. Baixe o repositorio completo.' }
if (!(Test-Path -LiteralPath $package)) { throw "Pacote ausente: distribution\$version. Baixe o repositorio completo." }

$checksumFile = "$package.sha256"
if (!(Test-Path -LiteralPath $checksumFile)) { throw 'Checksum ausente. Baixe novamente o repositorio completo.' }
$expected = [regex]::Match((Get-Content -LiteralPath $checksumFile -Raw), '^[A-Fa-f0-9]{64}').Value
$hash = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash
if ($expected.Length -ne 64 -or $hash -ne $expected) { throw 'O pacote esta incompleto ou foi alterado. Baixe novamente o repositorio completo.' }

$cacheBase = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'BU2Loom\packages'
$install = Join-Path $cacheBase ($version + '-' + $hash.Substring(0, 16))
$exe = Join-Path $install 'LOOM.exe'
$ready = Join-Path $install '.complete'
New-Item -ItemType Directory -Path $cacheBase -Force | Out-Null
$gate = $null
try {
    try { $gate = [IO.File]::Open((Join-Path $cacheBase ($hash + '.lock')), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'Outra abertura esta preparando o LOOM. Aguarde alguns segundos e tente novamente.' }
    if (!(Test-Path -LiteralPath $ready) -or !(Test-Path -LiteralPath $exe)) {
        Write-Host 'Preparando o LOOM. A primeira abertura pode levar alguns segundos...'
        New-Item -ItemType Directory -Path $install -Force | Out-Null
        Expand-Archive -LiteralPath $package -DestinationPath $install -Force
        foreach ($required in @('LOOM.exe', 'LOOM.dll', 'coreclr.dll', 'WebView2Loader.dll', 'frontend\index.html', 'frontend\cascade.js')) {
            if (!(Test-Path -LiteralPath (Join-Path $install $required))) { throw "Arquivo obrigatorio ausente: $required" }
        }
        New-Item -ItemType File -Path $ready -Force | Out-Null
    }
} finally { if ($gate) { $gate.Dispose() } }

# A configuracao fica no repositorio (config\loom.config.json), nao na copia local.
Start-Process -FilePath $exe -ArgumentList @('--config', "`"$config`"")
