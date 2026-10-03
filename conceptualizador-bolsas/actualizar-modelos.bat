@echo off
echo Actualizando "Mis modelos" desde referencias\modelos ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar-modelos.ps1"
pause
