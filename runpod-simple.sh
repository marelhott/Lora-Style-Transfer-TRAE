#!/bin/bash

# RunPod Simple Startup Script
# Žádné cache problémy, jen fungující aplikace

set -e

echo "🚀 LoRA Style Transfer - Simple Start (v4.0.0)"
echo "============================================"

# Funkce pro logování
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🔄 Starting simple setup..."

# Přejdi na /data pro persistence
cd /data

# Clone nebo pull repository
if [ -d "app/.git" ]; then
    log "📂 Updating repository..."
    cd app
    git pull
else
    log "📥 Cloning repository..."
    rm -rf app
    git clone https://github.com/marelhott/Lora-Style-Transfer-TRAE.git app
    cd app
fi

log "✅ Repository ready"

# Nastav environment
export NODE_ENV="development"
export MODEL_PATH="/data/models"

log "🌍 Environment: NODE_ENV=$NODE_ENV, MODEL_PATH=$MODEL_PATH"

# Vytvoř adresáře
mkdir -p /data/models
mkdir -p /tmp/processing

# Vyčisti vše
log "🧹 Cleaning old builds..."
rm -rf node_modules 2>/dev/null || true
rm -rf .next 2>/dev/null || true
rm -rf package-lock.json 2>/dev/null || true

# Fresh install
log "📦 Installing dependencies..."
npm install

# Ověř instalaci
if [ -f "node_modules/.bin/next" ]; then
    log "✅ Next.js installed successfully"
else
    log "❌ Next.js installation failed"
    exit 1
fi

# Spusť aplikaci
log "🚀 Starting application on port 3000..."
log "🌐 Will be available at RunPod URL"

npm run dev