#!/bin/bash

set -e
cd "$(dirname "$0")"

if [ "$(id -u)" -eq 0 ]; then
    echo "❌ Jangan jalankan start.sh dengan sudo di macOS. Colima tidak bisa dijalankan sebagai root."
    echo "   Jalankan saja: ./start.sh"
    exit 1
fi

echo "========================================="
echo " UNIOT Server Starter (MySQL + Node.js)"
echo "========================================="
echo ""

# ===== DETECT OS =====
OS_TYPE=$(uname -s)
case "$OS_TYPE" in
    Darwin)
        OS_NAME="macOS"
        ;;
    Linux)
        OS_NAME="Linux"
        ;;
    *)
        OS_NAME="Unknown"
        ;;
esac

echo "🖥️  OS Detected: $OS_NAME"
echo ""

# ===== KILL EXISTING PROCESS ON PORT 3001 =====
echo "🧹 Checking for existing processes on port 3001..."
if command -v lsof &> /dev/null; then
    # macOS / Linux with lsof
    PIDS=$(lsof -ti :3001 2>/dev/null || true)
    if [ ! -z "$PIDS" ]; then
        echo "   Found process(es). Killing..."
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 1
        echo "   ✓ Process killed"
    else
        echo "   ✓ Port 3001 is free"
    fi
elif command -v fuser &> /dev/null; then
    # Fallback untuk Linux dengan fuser
    if fuser 3001/tcp &> /dev/null; then
        echo "   Found process. Killing..."
        fuser -k 3001/tcp 2>/dev/null || true
        sleep 1
        echo "   ✓ Process killed"
    else
        echo "   ✓ Port 3001 is free"
    fi
else
    echo "   ⊘ Cannot check port (lsof/fuser not available)"
fi
echo ""
if [ "$OS_NAME" = "macOS" ]; then
    if ! command -v brew &> /dev/null; then
        echo "📦 Homebrew tidak ditemukan. Installing..."
        echo ""
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Setup PATH after brew install
        if [ -d "/opt/homebrew/bin" ]; then
            export PATH="/opt/homebrew/bin:$PATH"
        fi
        
        echo ""
        echo "✓ Homebrew installed successfully"
        echo ""
    else
        echo "✓ Homebrew found: $(brew --version | head -n 1)"
        echo ""
    fi
    
    # ===== macOS: INSTALL/CHECK COLIMA + DOCKER =====
    echo "📦 Checking Docker & Colima..."
    
    # Install colima if not present
    if ! command -v colima &> /dev/null; then
        echo "   Installing colima..."
        brew install colima
    else
        echo "   ✓ colima found"
    fi
    
    # Install docker if not present
    if ! command -v docker &> /dev/null; then
        echo "   Installing docker CLI..."
        brew install docker
    else
        echo "   ✓ docker found"
    fi
    
    # Install docker-compose if not present
    if ! command -v docker-compose &> /dev/null; then
        echo "   Installing docker-compose..."
        brew install docker-compose
    else
        echo "   ✓ docker-compose found"
    fi
    
    echo ""
    
    # ===== macOS: START COLIMA =====
    echo "Starting Colima daemon..."
    if ! colima running &> /dev/null; then
        colima start
        echo "✓ Colima started"
    else
        echo "✓ Colima already running"
    fi
    echo ""

    # ===== macOS: ALLOW INBOUND NODE.JS =====
    if command -v sudo &> /dev/null && [ -x /usr/libexec/ApplicationFirewall/socketfilterfw ]; then
        NODE_PATH=$(command -v node || true)
        if [ ! -z "$NODE_PATH" ]; then
            echo "🔓 Ensuring macOS firewall allows Node.js inbound connections..."
            sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH" >/dev/null 2>&1 || true
            sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_PATH" >/dev/null 2>&1 || true
            echo "✓ macOS firewall checked for Node.js"
            echo ""
        fi
    fi
    
else
    # ===== LINUX/OTHER: CHECK DOCKER INSTALLATION =====
    if ! command -v docker &> /dev/null; then
        echo "❌ ERROR: Docker tidak ditemukan!"
        echo ""
        
        if [ "$OS_NAME" = "Linux" ]; then
            echo "📦 Install Docker for Linux:"
            echo ""
            echo "   Ubuntu/Debian:"
            echo "   $ sudo apt update"
            echo "   $ sudo apt install -y docker.io docker-compose"
            echo "   $ sudo usermod -aG docker \$USER"
            echo ""
            echo "   Fedora/RHEL:"
            echo "   $ sudo dnf install -y docker docker-compose"
            echo "   $ sudo usermod -aG docker \$USER"
            echo ""
            echo "   Lalu restart atau: $ newgrp docker"
        fi
        
        exit 1
    fi

    echo "✓ Docker found: $(docker --version)"
    echo ""

    # ===== CHECK DOCKER-COMPOSE =====
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ ERROR: docker-compose tidak ditemukan!"
        echo ""
        
        if [ "$OS_NAME" = "Linux" ]; then
            echo "Install docker-compose:"
            echo "   $ sudo apt install -y docker-compose"
            echo "   atau"
            echo "   $ pip install docker-compose"
        fi
        
        exit 1
    fi

    echo "✓ docker-compose found: $(docker-compose --version)"
    echo ""

    # ===== CHECK DOCKER DAEMON =====
    if ! docker ps &> /dev/null; then
        echo "❌ ERROR: Docker daemon tidak running!"
        echo ""
        
        if [ "$OS_NAME" = "Linux" ]; then
            echo "Start Docker:"
            echo "   $ sudo systemctl start docker"
            echo "   $ sudo systemctl enable docker"
        fi
        
        exit 1
    fi

    echo "✓ Docker daemon running"
    echo ""
fi

# ===== VERIFY DOCKER DAEMON (ALL OS) =====
if ! docker ps &> /dev/null; then
    echo "❌ ERROR: Docker daemon tidak responding!"
    echo "Pastikan Docker/Colima sedang berjalan, lalu coba lagi."
    exit 1
fi

echo ""

# ===== START MYSQL =====
echo "[1/4] Starting MySQL Docker container..."
docker-compose up -d mysql

echo ""
echo "[2/4] Waiting for MySQL to be ready (max 60 detik)..."
for i in {1..60}; do
    if docker exec uniot_mysql mysqladmin ping -h localhost -u root -proot123 &> /dev/null; then
        echo "✓ MySQL is ready!"
        break
    fi
    echo "  Waiting... ($i/60)"
    sleep 1
done

echo ""
echo "[3/4] Installing dependencies (npm install)..."
npm install

echo ""
echo "[4/4] Starting application (npm start)..."
echo ""
echo "========================================="
echo "✓ Server running! Open http://localhost:3001"
echo "========================================="
npm start
