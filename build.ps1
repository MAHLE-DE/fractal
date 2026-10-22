[CmdletBinding()]
param([ValidateSet('win-x64','win-x86','win-arm64')][string]$Runtime = "win-x64", [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = "0.2.1")
$ErrorActionPreference = "Stop"
$taskRoot = $PSScriptRoot
$taskBundledSdk = Join-Path $taskRoot "..\_app\.tools\dotnet\dotnet.exe"
$taskDotnet = if (Test-Path -LiteralPath $taskBundledSdk) { $taskBundledSdk } else { "dotnet" }
& $taskDotnet --version
if ($LASTEXITCODE -ne 0) { throw "Building requires .NET SDK 10 on the DEVELOPMENT computer. Running the packaged preview does not." }
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if ($taskNode) {
    & $taskNode --test (Join-Path $taskRoot "tests\graph.test.cjs")
    if ($LASTEXITCODE -ne 0) { throw "Graph regression checks failed." }
}
& $taskDotnet run --project (Join-Path $taskRoot 'tests\data\Fractal.Data.Tests.csproj') -c Release
if ($LASTEXITCODE -ne 0) { throw 'JSON persistence and concurrency checks failed.' }
$taskStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$taskOutput = Join-Path $taskRoot "artifacts\preview-$Runtime-$taskStamp"
$taskProject = Join-Path $taskRoot "desktop\Fractal.Preview.csproj"
& $taskDotnet publish $taskProject -c Release -r $Runtime --self-contained true -p:Version=$Version -p:DebugType=None -p:DebugSymbols=false -o $taskOutput --nologo
if ($LASTEXITCODE -ne 0) { throw "Preview publication failed." }
Copy-Item -LiteralPath (Join-Path $taskRoot "README.md") -Destination $taskOutput
Copy-Item -LiteralPath (Join-Path $taskRoot "docs") -Destination (Join-Path $taskOutput 'docs') -Recurse
Copy-Item -LiteralPath (Join-Path $taskRoot "docs\pc-comercial.md") -Destination (Join-Path $taskOutput 'LEIA-ME-PC-COMERCIAL.md')
$taskZip = Join-Path $taskRoot "artifacts\Fractal-Workspace-$Version-$Runtime-$taskStamp.zip"
Compress-Archive -Path (Join-Path $taskOutput "*") -DestinationPath $taskZip -CompressionLevel Optimal
$taskHash = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash
Set-Content -LiteralPath "$taskZip.sha256" -Value "$taskHash  $(Split-Path -Leaf $taskZip)" -Encoding ascii
Write-Host "Preview executable: $taskOutput\Fractal.Preview.exe"
Write-Host "Standalone package: $taskZip"
Write-Host "SHA-256: $taskHash"
