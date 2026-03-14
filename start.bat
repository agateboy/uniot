@echo off
setlocal

cd /d "%~dp0"

echo =========================================
echo Uniot Windows Starter
echo =========================================
echo [1/2] Installing dependencies (npm install)...
call npm install
if errorlevel 1 (
    echo.
    echo npm install gagal. Periksa koneksi internet atau error log di atas.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting application (npm start)...
call npm start
if errorlevel 1 (
    echo.
    echo npm start gagal. Periksa error log di atas.
    pause
    exit /b 1
)

endlocal
