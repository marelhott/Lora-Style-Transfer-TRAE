#!/bin/bash

# RunPod Startup Script pro LoRA Style Transfer
# Tento script se spustí při každém startu RunPod containeru

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - RunPod Startup"
echo "======================================"

# Nastavení proměnných
REPO_URL="https://github.com/marelhott/Lora-Style-Transfer-TRAE.git"
APP_DIR="/workspace/lora-app"
DATA_DIR="/data"

# Funkce pro logování
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🔄 Checking for existing application..."

# Clone nebo pull repository
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

# Zkontroluj a vytvoř potřebné adresáře
log "📁 Setting up directories..."
mkdir -p "$DATA_DIR/models"
mkdir -p "/tmp/processing"

# Instalace Python závislostí
log "🐍 Installing Python dependencies..."
if [ -f "backend/requirements.txt" ]; then
    pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
    pip install --no-cache-dir -r backend/requirements.txt
else
    log "⚠️  No requirements.txt found, skipping Python dependencies"
fi

# Instalace Node.js závislostí
log "📦 Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install --production
else
    log "⚠️  No package.json found, skipping Node.js dependencies"
fi

# Build Next.js aplikace
log "🏗️  Building Next.js application..."
if [ -f "package.json" ] && npm run build; then
    log "✅ Next.js build completed successfully"
else
    log "⚠️  Next.js build failed or not available"
fi

# Nastavení environment variables
export MODEL_PATH="$DATA_DIR/models"
export PYTHONPATH="$APP_DIR:$PYTHONPATH"
export NODE_ENV="production"

log "🌍 Environment variables set:"
log "   MODEL_PATH=$MODEL_PATH"
log "   PYTHONPATH=$PYTHONPATH"
log "   NODE_ENV=$NODE_ENV"

# Spuštění aplikace
log "🚀 Starting LoRA Style Transfer application..."
log "   Frontend: http://localhost:3000"
log "   Backend API: http://localhost:8000"

# Spuštění v background a sledování logů
npm start &
NEXT_PID=$!

# Čekání na spuštění Next.js
sleep 10

# Spuštění Python backend (pokud existuje)
if [ -f "runpod_backend.py" ]; then
    log "🐍 Starting Python backend..."
    python runpod_backend.py &
    PYTHON_PID=$!
fi

log "✅ Application started successfully!"
log "🌐 Access your app at the RunPod provided URL"
log "📊 Logs will appear below..."

# Sledování procesů
while true; do
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        log "❌ Next.js process died, restarting..."
        npm start &
        NEXT_PID=$!
    fi
    
    if [ ! -z "$PYTHON_PID" ] && ! kill -0 $PYTHON_PID 2>/dev/null; then
        log "❌ Python backend died, restarting..."
        python runpod_backend.py &
        PYTHON_PID=$!
    fi
    
    sleep 30
done