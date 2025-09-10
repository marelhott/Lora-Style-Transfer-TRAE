#!/bin/bash

# RunPod Persistent Final Startup Script
# Vše na /data - persistent storage, jen kód z GitHubu

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - Persistent Final (v3.0.0)"
echo "================================================"

# Nastavení proměnných
REPO_URL="https://github.com/marelhott/Lora-Style-Transfer-TRAE.git"
APP_DIR="/data/app"
NODE_MODULES_DIR="/data/node_modules"
PYTHON_PACKAGES_DIR="/data/python-packages"
MODELS_DIR="/data/models"

# Funkce pro logování
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🔄 Setting up persistent application on /data..."

# Vytvoř základní adresáře na /data
mkdir -p "$APP_DIR"
mkdir -p "$NODE_MODULES_DIR"
mkdir -p "$PYTHON_PACKAGES_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "/tmp/processing"

# Clone nebo pull repository na /data
cd /data
if [ -d "$APP_DIR/.git" ]; then
    log "📂 Repository exists on /data, pulling latest changes..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
    git pull origin main
else
    log "📥 Cloning repository to /data..."
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

log "✅ Repository updated successfully on /data"

# Nastav Python environment
if [ -d "$PYTHON_PACKAGES_DIR" ]; then
    log "🐍 Using cached Python packages from /data..."
    export PYTHONPATH="$PYTHON_PACKAGES_DIR:$PYTHONPATH"
else
    log "⚠️  No cached Python packages found on /data"
fi

# Nastav Node modules - použij persistent cache nebo reinstall
log "📦 Setting up Node modules on /data..."

# Zkontroluj jestli máme validní node_modules na /data
if [ -d "$NODE_MODULES_DIR" ] && [ -f "$NODE_MODULES_DIR/.bin/next" ]; then
    log "🔗 Using cached node_modules from /data..."
    rm -rf node_modules
    ln -sf "$NODE_MODULES_DIR" ./node_modules
    
    # Ověř že všechno funguje
    if [ ! -f "node_modules/.bin/next" ] || [ ! -f "node_modules/.bin/tailwindcss" ]; then
        log "❌ Cache is broken, reinstalling..."
        rm -f node_modules
        npm install
        rm -rf "$NODE_MODULES_DIR"
        cp -r node_modules "$NODE_MODULES_DIR"
        rm -rf node_modules
        ln -sf "$NODE_MODULES_DIR" ./node_modules
    fi
else
    log "📦 Installing fresh node_modules to /data..."
    npm install
    rm -rf "$NODE_MODULES_DIR"
    cp -r node_modules "$NODE_MODULES_DIR"
    rm -rf node_modules
    ln -sf "$NODE_MODULES_DIR" ./node_modules
fi

# Aktualizuj browserslist pokud je potřeba
log "🌐 Updating browserslist database..."
npx update-browserslist-db@latest --yes 2>/dev/null || true

# Ověř že všechny tools jsou dostupné
log "🔍 Verifying tools availability..."
if [ -f "node_modules/.bin/next" ]; then
    log "✅ Next.js is available"
else
    log "❌ Next.js missing - critical error!"
    exit 1
fi

if [ -f "node_modules/.bin/tailwindcss" ]; then
    log "✅ Tailwind CSS is available"
else
    log "❌ Tailwind CSS missing - installing..."
    npm install -D tailwindcss postcss autoprefixer
fi

# Nastav environment variables
export MODEL_PATH="$MODELS_DIR"
export NODE_ENV="development"
export PYTHONPATH="$PYTHON_PACKAGES_DIR:$PYTHONPATH"

log "🌍 Environment variables set:"
log "   APP_DIR=$APP_DIR"
log "   MODEL_PATH=$MODEL_PATH"
log "   NODE_ENV=$NODE_ENV"
log "   PYTHONPATH=$PYTHONPATH"

# Vyčisti cache pro jistotu
log "🧹 Cleaning build cache..."
rm -rf .next 2>/dev/null || true

# Spusť aplikaci
log "🚀 Starting LoRA Style Transfer application..."
log "   Frontend: http://localhost:3000"
log "   All data persistent on /data"

# Spusť Next.js
log "🔧 Starting Next.js development server..."
npm run dev &
NEXT_PID=$!

# Počkej na spuštění
sleep 15

log "✅ Application started successfully on /data!"
log "🌐 Access your app at the RunPod provided URL"
log "📊 Monitoring processes..."

# Monitor procesů
while true; do
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        log "❌ Next.js process died, restarting..."
        npm run dev &
        NEXT_PID=$!
    fi
    
    sleep 30
done