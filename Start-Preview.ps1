[CmdletBinding()]
param([switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
$taskPackage = Join-Path $PSScriptRoot 'distribution\0.1.0\Fractal-VisualPreview-0.1.0-win-x64.zip'
$taskExe = $null

if (Test-Path -LiteralPath $taskPackage) {
    $taskChecksumFile = "$taskPackage.sha256"
    if (!(Test-Path -LiteralPath $taskChecksumFile)) { throw 'Checksum ausente. Baixe e extraia novamente o repositorio completo.' }
    $taskExpected = [regex]::Match((Get-Content -LiteralPath $taskChecksumFile -Raw), '^[A-Fa-f0-9]{64}').Value
    $taskHash = (Get-FileHash -LiteralPath $taskPackage -Algorithm SHA256).Hash
    if ($taskExpected.Length -ne 64 -or $taskHash -ne $taskExpected) { throw 'O pacote esta incompleto ou foi alterado. Baixe novamente o ZIP completo do GitHub.' }
    $taskCacheBase = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MAHLE\FractalPreview\packages'
    $taskInstall = Join-Path $taskCacheBase ('0.1.0-' + $taskHash.Substring(0, 16))
    $taskExe = Join-Path $taskInstall 'Fractal.Preview.exe'
    $taskReady = Join-Path $taskInstall '.complete'
    New-Item -ItemType Directory -Path $taskCacheBase -Force | Out-Null
    $taskGate = $null
    try {
        try { $taskGate = [IO.File]::Open((Join-Path $taskCacheBase ($taskHash + '.lock')), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch { throw 'Outra abertura esta preparando este pacote. Aguarde alguns segundos e tente novamente.' }
        if (!(Test-Path -LiteralPath $taskReady) -or !(Test-Path -LiteralPath $taskExe)) {
            Write-Host 'Preparando o prototipo completo. A primeira abertura pode levar alguns segundos...'
            New-Item -ItemType Directory -Path $taskInstall -Force | Out-Null
            Expand-Archive -LiteralPath $taskPackage -DestinationPath $taskInstall -Force
            foreach ($taskRequired in @('Fractal.Preview.exe','Fractal.Preview.dll','coreclr.dll','WebView2Loader.dll','frontend\index.html','frontend\js\workspace.js')) {
                if (!(Test-Path -LiteralPath (Join-Path $taskInstall $taskRequired))) { throw "Arquivo obrigatorio ausente: $taskRequired" }
            }
            New-Item -ItemType File -Path $taskReady -Force | Out-Null
        }
    } finally { if ($taskGate) { $taskGate.Dispose() } }
} else {
    # Development checkout before publication; never downloads dependencies.
    $taskArtifacts = Join-Path $PSScriptRoot 'artifacts'
    $taskLatest = if (Test-Path -LiteralPath $taskArtifacts) { Get-ChildItem -LiteralPath $taskArtifacts -Directory -Filter 'preview-win-x64-*' | Sort-Object Name -Descending | Select-Object -First 1 }
    if ($taskLatest) { $taskExe = Join-Path $taskLatest.FullName 'Fractal.Preview.exe' }
}

if ($taskExe -and (Test-Path -LiteralPath $taskExe)) {
    if ($SmokeTest) {
        $taskProcess = Start-Process -FilePath $taskExe -ArgumentList '--smoke-test' -WindowStyle Hidden -PassThru
        if (!$taskProcess.WaitForExit(30000)) { $taskProcess.Kill(); throw 'O teste de inicializacao WebView2 excedeu o limite.' }
        $taskProcess.Refresh()
        if ($taskProcess.ExitCode -ne 0) { throw "Falha ao iniciar o prototipo WebView2: $($taskProcess.ExitCode)" }
        Write-Output "PASS prototipo distribuido e WebView2: $taskExe"
    } else { Start-Process -FilePath $taskExe }
} elseif ($SmokeTest) { throw 'O pacote executavel nao foi encontrado.' }
else { Start-Process -FilePath (Join-Path $PSScriptRoot 'frontend\index.html') }
