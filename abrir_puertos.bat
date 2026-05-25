@echo off
:: Comprobamos si el script se está ejecutando como administrador con net session
net session >nul 2>&1
if %errorLevel% neq 0 goto :NO_ADMIN

echo.
echo ============================================================
echo   Abriendo puertos de GDD-T2 en el Firewall de Windows
echo ============================================================
echo.
echo 1. Abriendo puerto 8081 para Expo Metro...
powershell -Command "New-NetFirewallRule -DisplayName 'Expo Metro Bundler' -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow -Force" >nul

echo 2. Abriendo puerto 8000 para el Backend FastAPI...
powershell -Command "New-NetFirewallRule -DisplayName 'GDD-T2 Backend API' -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Force" >nul

echo.
echo ============================================================
echo   [EXITO] ¡Puertos 8081 y 8000 abiertos correctamente!
echo.
echo   Ya puedes conectar tu telefono en modo LAN local sin Ngrok.
echo ============================================================
echo.
pause
goto :eof

:NO_ADMIN
echo ============================================================
echo   [ERROR] Debes ejecutar este archivo como Administrador.
echo.
echo   Instrucciones:
echo   1. Haz clic derecho sobre "abrir_puertos.bat".
echo   2. Selecciona "Ejecutar como administrador".
echo ============================================================
echo.
pause
