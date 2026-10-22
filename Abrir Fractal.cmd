@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Preview.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel abrir o Fractal. Consulte README.md e config\appsettings.json.
  echo Alternativa: extraia o ZIP em distribution\0.2.1 e abra Fractal.Preview.exe.
  pause
)
