# Gera o pacote final do LOOM (somente na maquina de desenvolvimento).
# Requer .NET SDK 10 e Node; o computador que abre o LOOM nao precisa de nada disso.
[CmdletBinding()]
param(
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = "1.0.0",
    [string]$Dotnet = "dotnet",
    [switch]$SkipTests
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Falha no build da interface." }
    if (-not $SkipTests) { & npm test; if ($LASTEXITCODE -ne 0) { throw "Testes da interface falharam." } }

    $output = Join-Path $root ".tmp\publish-$Version"
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Recurse -Force }
    & $Dotnet publish (Join-Path $root "host\Loom.csproj") -c Release -r win-x64 --self-contained true `
        -p:Version=$Version -p:DebugType=None -p:DebugSymbols=false -p:SatelliteResourceLanguages=en -o $output --nologo
    if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar o executavel." }

    # Teste do pacote publicado: abre escondido, confere interface, dados e a busca de documentos.
    $smokeConfig = Join-Path $root ".tmp\smoke.config.json"
    $folder = Join-Path (Split-Path $root -Parent) "link_normas\03_PILOTO_40\corpus\normas"
    @{ documentsFolder = $folder; searchSubfolders = $true } | ConvertTo-Json | Set-Content -LiteralPath $smokeConfig -Encoding utf8
    $process = Start-Process -FilePath (Join-Path $output "LOOM.exe") -ArgumentList @("--smoke-test", "--config", "`"$smokeConfig`"") -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Teste do executavel falhou (codigo $($process.ExitCode))." }
    Write-Host "Teste do executavel: OK -" (Get-Content (Join-Path $env:TEMP "loom-smoke.json") -Raw)

    $dist = Join-Path $root "distribution\$Version"
    New-Item -ItemType Directory -Path $dist -Force | Out-Null
    $zip = Join-Path $dist "LOOM-$Version-win-x64.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -Path (Join-Path $output "*") -DestinationPath $zip -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    Set-Content -LiteralPath "$zip.sha256" -Value "$hash  $(Split-Path -Leaf $zip)" -Encoding ascii
    Write-Host "Pacote: $zip"
    Write-Host "SHA-256: $hash"
} finally { Pop-Location }
