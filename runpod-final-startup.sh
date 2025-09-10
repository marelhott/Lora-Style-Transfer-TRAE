#!/bin/bash

# RunPod Final Startup Script
# Opravuje problém s concurrently a Tailwind CSS

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
log "📦 Installing Node modules with all required dependencies..."

# Vždy reinstall pro jistotu že máme všechny dependencies
log "📦 Fresh npm install to ensure all dependencies..."
npm install

# Zkontroluj a doinstaluj chybějící Tailwind dependencies
log "🎨 Ensuring Tailwind CSS dependencies..."
if [ ! -f "node_modules/.bin/tailwindcss" ]; then
    log "📦 Installing missing Tailwind CSS..."
    npm install -D tailwindcss postcss autoprefixer
fi

# Zkontroluj concurrently
if [ ! -f "node_modules/.bin/concurrently" ]; then
    log "📦 Installing missing concurrently..."
    npm install -D concurrently
fi

# Ověř že všechny tools jsou dostupné
log "🔍 Verifying tools availability..."
if [ -f "node_modules/.bin/concurrently" ]; then
    log "✅ concurrently is available"
else
    log "❌ concurrently still missing"
fi

if [ -f "node_modules/.bin/tailwindcss" ]; then
    log "✅ tailwindcss is available"
else
    log "❌ tailwindcss still missing"
fi

if [ -f "node_modules/.bin/next" ]; then
    log "✅ next is available"
else
    log "❌ next still missing"
fi

# Zkopíruj node_modules na /data pro příště (pokud se podařilo)
if [ -f "node_modules/.bin/concurrently" ] && [ -f "node_modules/.bin/tailwindcss" ]; then
    log "💾 Caching node_modules to persistent storage..."
    mkdir -p "$DATA_DIR"
    cp -r node_modules "$DATA_DIR/" 2>/dev/null || true
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