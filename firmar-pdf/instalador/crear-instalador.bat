@echo off
rem Compila PepePDF y arma ..\descargar\PepePDF-Setup.exe
cd /d "%~dp0"
dotnet publish ..\src -c Release || goto error
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" PepePDF.iss || goto error
echo.
echo Listo: ..\descargar\PepePDF-Setup.exe
pause
exit /b 0
:error
echo.
echo Algo fallo. Revise los mensajes de arriba.
pause
exit /b 1
