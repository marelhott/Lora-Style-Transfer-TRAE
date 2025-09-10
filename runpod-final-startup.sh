#!/bin/bash

# RunPod Final Startup Script
# Opravuje problém s concurrently a používá persistent storage

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - Final Startup (v2.0.0)"
echo "============================================="

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

# Nastav Python environment
if [ -d "$DATA_DIR/python-packages" ]; then
    log "🐍 Using cached Python packages from persistent storage..."
    export PYTHONPATH="$DATA_DIR/python-packages:$PYTHONPATH"
else
    log "⚠️  No cached Python packages found"
fi

# Nastav Node modules - vždy reinstall pro jistotu
log "📦 Installing Node modules (ensuring concurrently is available)..."

# Pokud existuje cache na /data, zkus ji použít
if [ -d "$DATA_DIR/node_modules" ]; then
    log "🔗 Trying to use cached node_modules from /data..."
    rm -rf node_modules 2>/dev/null || true
    ln -sf "$DATA_DIR/node_modules" ./node_modules
    
    # Zkontroluj jestli concurrently existuje
    if [ ! -f "node_modules/.bin/concurrently" ]; then
        log "❌ concurrently not found in cache, reinstalling..."
        rm -f node_modules
        npm install
        # Zkopíruj zpět na /data pro příště
        cp -r node_modules "$DATA_DIR/" 2>/dev/null || true
    else
        log "✅ concurrently found in cached node_modules"
    fi
else
    log "📦 No cached node_modules, installing fresh..."
    npm install
    # Zkopíruj na /data pro příště
    mkdir -p "$DATA_DIR"
    cp -r node_modules "$DATA_DIR/" 2>/dev/null || true
fi

# Ověř že concurrently je dostupný
if [ -f "node_modules/.bin/concurrently" ]; then
    log "✅ concurrently is available"
else
    log "❌ concurrently still not found, installing directly..."
    npm install concurrently
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
log "   Backend API: http://localhost:8000"

# Spusť v development mode
log "🔧 Starting with concurrently..."
npm run dev &
NEXT_PID=$!

# Počkej na spuštění
sleep 15

log "✅ Application started successfully!"
log "🌐 Access your app at the RunPod provided URL"
log "📊 Monitoring processes..."

# Monitor procesů
while true; do
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        log "❌ Application process died, restarting..."
        npm run dev &
        NEXT_PID=$!
    fi
    
    sleep 30
done