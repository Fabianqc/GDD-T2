@echo off
rem ============================================================
rem   Iniciando Servicios de GDD-T2 - Backend y Frontend
rem ============================================================
rem.

rem Verificacion de entorno virtual en Backend
if not exist "Backend\venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual en Backend\venv.
    echo Por favor, crea el entorno virtual e instala las dependencias primero:
    echo.
    echo   cd Backend
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

rem Verificacion de node_modules en Frontend
if not exist "Frontend\node_modules\" (
    echo [ADVERTENCIA] No se encontro la carpeta node_modules en Frontend.
    echo Es probable que no hayas instalado las dependencias de Node.js.
    echo Recuerda ejecutar npm install dentro de la carpeta Frontend.
    echo.
)

rem 1. Iniciar el Backend (FastAPI) en una ventana aparte
echo [1/2] Iniciando Backend FastAPI en el puerto 8000...
start "GDD-T2 Backend" cmd /k "Backend\venv\Scripts\python.exe -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload"

rem 2. Iniciar el Frontend (Expo Metro) en una ventana aparte
echo [2/2] Iniciando Frontend Expo Metro Bundler...
start "GDD-T2 Frontend" cmd /k "cd Frontend && npm start"

echo.
echo ============================================================
echo   Servicios iniciados en ventanas independientes.
echo.
echo   - Backend: http://localhost:8000/docs
echo   - Frontend: Usa la terminal de Expo o escanea el codigo QR.
echo ============================================================
echo.
pause
