@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo =========================================
echo UNIOT Server Starter (MySQL + Node.js)
echo =========================================
echo.
echo 🖥️  OS Detected: Windows
echo.

REM ===== KILL EXISTING PROCESS ON PORT 3001 =====
echo 🧹 Checking for existing processes on port 3001...

REM Try using netstat to find PID on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    set PID=%%a
)

if defined PID (
    echo   Found process (PID: !PID!). Killing...
    taskkill /PID !PID! /F >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo   ✓ Process killed
) else (
    echo   ✓ Port 3001 is free
)
echo.

REM ===== CHECK DOCKER INSTALLATION =====
where docker >nul 2>nul
if errorlevel 1 (
    echo ❌ ERROR: Docker tidak ditemukan!
    echo.
    echo 📦 Install Docker for Windows:
    echo.
    echo   Download Docker Desktop dari:
    echo   https://www.docker.com/products/docker-desktop
    echo.
    echo   Langkah instalasi:
    echo   1. Download Docker Desktop installer
    echo   2. Run installer (Docker Desktop Installer.exe^)
    echo   3. Follow installation wizard
    echo   4. Restart komputer
    echo   5. Open Docker Desktop dari Start Menu
    echo   6. Run script ini lagi
    echo.
    pause
    exit /b 1
)

echo ✓ Docker found: 
docker --version
echo.

REM ===== CHECK DOCKER-COMPOSE =====
where docker-compose >nul 2>nul
if errorlevel 1 (
    echo ❌ ERROR: docker-compose tidak ditemukan!
    echo.
    echo Solusi: docker-compose biasanya sudah included dengan Docker Desktop
    echo Pastikan Docker Desktop sudah fully installed.
    echo.
    pause
    exit /b 1
)

echo ✓ docker-compose found: 
docker-compose --version
echo.

REM ===== CHECK DOCKER DAEMON =====
docker ps >nul 2>nul
if errorlevel 1 (
    echo ❌ ERROR: Docker daemon tidak running!
    echo.
    echo 📌 Solusi:
    echo   1. Open Docker Desktop dari Start Menu / Taskbar
    echo   2. Wait sampai Docker icon stabil di taskbar
    echo   3. Run script ini lagi
    echo.
    pause
    exit /b 1
)

echo ✓ Docker daemon running
echo.

REM ===== START MYSQL =====
echo [1/4] Starting MySQL Docker container...
call docker-compose up -d mysql
if errorlevel 1 (
    echo.
    echo ❌ docker-compose up gagal. Pastikan Docker daemon sedang berjalan.
    pause
    exit /b 1
)

echo.
echo [2/4] Waiting for MySQL to be ready (max 60 detik)...
setlocal
for /L %%i in (1,1,60) do (
    docker exec uniot_mysql mysqladmin ping -h localhost -u root -proot123 >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ MySQL is ready!
        goto mysql_ready
    )
    echo   Waiting... (%%i/60)
    timeout /t 1 /nobreak >nul
)
:mysql_ready
endlocal

echo.
echo [3/4] Installing dependencies (npm install)...
call npm install
if errorlevel 1 (
    echo.
    echo ❌ npm install gagal. Periksa koneksi internet atau error log di atas.
    pause
    exit /b 1
)

echo.
echo [4/4] Starting application (npm start)...
echo.
echo =========================================
echo ✓ Server running! Open http://localhost:3001
echo =========================================
call npm start
if errorlevel 1 (
    echo.
    echo ❌ npm start gagal. Periksa error log di atas.
    pause
    exit /b 1
)

endlocal
