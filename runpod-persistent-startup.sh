#!/bin/bash

# RunPod Startup Script - Kopírování z Docker image na persistent /data
# Kombinuje výhody optimalizovaného Docker template s persistent storage

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - Docker to Persistent Migration"
echo "==================================================="

# Nastavení proměnných
REPO_URL="https://github.com/marelhott/Lora-Style-Transfer-TRAE.git"
APP_DIR="/workspace/app"
DATA_DIR="/data"
PYTHON_PACKAGES="$DATA_DIR/python-packages"
NODE_MODULES="$DATA_DIR/node_modules"

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

# Kopírování Python packages z Docker image na persistent disk
log "🐍 Migrating Python packages to persistent storage..."

if [ ! -d "$PYTHON_PACKAGES/torch" ]; then
    log "📦 Copying Python packages from Docker image to /data..."
    mkdir -p "$PYTHON_PACKAGES"
    
    # Kopíruj všechny Python balíčky z Docker image
    if [ -d "/usr/local/lib/python3.10/dist-packages" ]; then
        log "📋 Copying from /usr/local/lib/python3.10/dist-packages..."
        cp -r /usr/local/lib/python3.10/dist-packages/* "$PYTHON_PACKAGES/" 2>/dev/null || true
    fi
    
    # Kopíruj také z site-packages pokud existuje
    if [ -d "/usr/local/lib/python3.10/site-packages" ]; then
        log "📋 Copying from /usr/local/lib/python3.10/site-packages..."
        cp -r /usr/local/lib/python3.10/site-packages/* "$PYTHON_PACKAGES/" 2>/dev/null || true
    fi
    
    # Zkontroluj jestli se PyTorch zkopíroval
    if [ -d "$PYTHON_PACKAGES/torch" ]; then
        log "✅ PyTorch successfully copied to persistent storage"
    else
        log "⚠️  PyTorch not found in Docker image, installing fresh..."
        pip install torch torchvision torchaudio --target "$PYTHON_PACKAGES" --index-url https://download.pytorch.org/whl/cu121
    fi
    
    # Doinstaluj chybějící balíčky z requirements.txt
    if [ -f "backend/requirements.txt" ]; then
        log "📦 Installing missing packages from requirements.txt..."
        pip install -r backend/requirements.txt --target "$PYTHON_PACKAGES" --upgrade-strategy only-if-needed
    fi
    
    log "✅ Python packages migrated to persistent storage"
else
    log "✅ Using cached Python packages from persistent storage"
fi

# Nastavení PYTHONPATH
export PYTHONPATH="$PYTHON_PACKAGES:$PYTHONPATH"

# Setup Node modules
log "📦 Setting up Node.js packages..."

if [ ! -d "$NODE_MODULES" ]; then
    log "📦 Installing Node modules to persistent storage..."
    
    # Instaluj do persistent location
    npm install --prefix "$DATA_DIR"
    
    log "✅ Node modules installed to persistent storage"
else
    log "✅ Using cached Node modules from persistent storage"
fi

# Vytvoř symlink na node_modules
if [ -L "node_modules" ]; then
    rm node_modules
fi
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
ln -sf "$NODE_MODULES" ./node_modules

log "🔗 Node modules symlinked successfully"

# Ověř instalace
log "🔍 Verifying installations..."
node --version
npm --version
python --version

# Zkontroluj klíčové balíčky
if python -c "import torch; print(f'PyTorch {torch.__version__} available')" 2>/dev/null; then
    log "✅ PyTorch is available"
else
    log "❌ PyTorch not found, installation may have failed"
fi

if [ -f "node_modules/.bin/next" ]; then
    log "✅ Next.js is available"
else
    log "❌ Next.js not found, installation may have failed"
fi

# Nastav environment variables
export MODEL_PATH="$DATA_DIR/models"
export NODE_ENV="development"  # Použij dev mode pro spolehlivost

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

# Spusť v development mode (spolehlivější)
log "🔧 Starting in development mode for better reliability..."
npm run dev &
NEXT_PID=$!

# Počkej na spuštění Next.js
sleep 15

# Spusť Python backend pokud existuje
if [ -f "runpod_backend.py" ]; then
    log "🐍 Starting Python backend..."
    python runpod_backend.py &
    PYTHON_PID=$!
fi

log "✅ Application started successfully!"
log "🌐 Access your app at the RunPod provided URL"
log "💾 All dependencies now cached on persistent storage"
log "⚡ Next restart will be super fast (10-20 seconds)"
log "📊 Logs will appear below..."

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