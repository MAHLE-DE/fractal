@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Loom.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel abrir o LOOM. Consulte README.md e config\loom.config.json.
  pause
)
