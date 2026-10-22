@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Preview.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel abrir o prototipo. Consulte README.md.
  echo Alternativa: extraia o ZIP em distribution\0.1.0 e abra Fractal.Preview.exe.
  pause
)
