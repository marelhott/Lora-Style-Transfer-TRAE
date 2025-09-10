#!/bin/bash

# RunPod Simple Startup Script
# Bez curl problémů, jen základní git + npm

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - Simple Startup"
echo "====================================="

# Nastavení proměnných
REPO_URL="https://github.com/marelhott/Lora-Style-Transfer-TRAE.git"
APP_DIR="/workspace/app"
DATA_DIR="/data"

# Funkce pro logování
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🔄 Setting up application..."

# Clone nebo pull repository
cd /workspace
if [ -d "$APP_DIR" ]; then
    log "📂 Application directory exists, pulling latest changes..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
    git pull origin main
else
    log "📥 Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

log "✅ Repository updated successfully"

# Použij persistent storage pokud existuje
if [ -d "$DATA_DIR/python-packages" ]; then
    log "🐍 Using cached Python packages from persistent storage..."
    export PYTHONPATH="$DATA_DIR/python-packages:$PYTHONPATH"
else
    log "⚠️  No cached Python packages found, will install fresh"
fi

if [ -d "$DATA_DIR/node_modules" ]; then
    log "📦 Using cached Node modules from persistent storage..."
    if [ -L "node_modules" ]; then
        rm node_modules
    fi
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi
    ln -sf "$DATA_DIR/node_modules" ./node_modules
else
    log "📦 Installing Node modules..."
    npm install
fi

# Nastav environment variables
export MODEL_PATH="$DATA_DIR/models"
export NODE_ENV="development"

log "🌍 Environment variables set:"
log "   PYTHONPATH=$PYTHONPATH"
log "   MODEL_PATH=$MODEL_PATH"
log "   NODE_ENV=$NODE_ENV"

# Vytvoř potřebné adresáře
mkdir -p "$DATA_DIR/models"
mkdir -p "/tmp/processing"

# Spusť aplikaci
log "🚀 Starting LoRA Style Transfer application..."
log "   Frontend: http://localhost:3000"

# Spusť v development mode
log "🔧 Starting in development mode..."
npm run dev &
NEXT_PID=$!

# Počkej na spuštění Next.js
sleep 10

# Spusť Python backend pokud existuje
if [ -f "runpod_backend.py" ]; then
    log "🐍 Starting Python backend..."
    python runpod_backend.py &
    PYTHON_PID=$!
fi

log "✅ Application started successfully!"
log "🌐 Access your app at the RunPod provided URL"
log "📊 Monitoring processes..."

# Monitor procesů
while true; do
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        log "❌ Next.js process died, restarting..."
        npm run dev &
        NEXT_PID=$!
    fi
    
    if [ ! -z "$PYTHON_PID" ] && ! kill -0 $PYTHON_PID 2>/dev/null; then
        log "❌ Python backend died, restarting..."
        python runpod_backend.py &
        PYTHON_PID=$!
    fi
    
    sleep 30
done