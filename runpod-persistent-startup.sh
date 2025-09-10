#!/bin/bash

# RunPod Startup Script s Persistent Storage
# Optimalizovaný pro rychlé starty s /data persistent diskem

set -e  # Exit on any error

echo "🚀 LoRA Style Transfer - Persistent Storage Startup"
echo "================================================"

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

# Setup persistent Python packages
log "🐍 Setting up Python packages..."
export PYTHONPATH="$PYTHON_PACKAGES:$PYTHONPATH"

if [ ! -d "$PYTHON_PACKAGES/torch" ]; then
    log "📦 Installing Python packages to persistent storage..."
    mkdir -p "$PYTHON_PACKAGES"
    
    # Install PyTorch with CUDA support
    pip install torch torchvision torchaudio --target "$PYTHON_PACKAGES" --index-url https://download.pytorch.org/whl/cu121
    
    # Install backend requirements
    if [ -f "backend/requirements.txt" ]; then
        pip install -r backend/requirements.txt --target "$PYTHON_PACKAGES"
    fi
    
    log "✅ Python packages installed to persistent storage"
else
    log "✅ Using cached Python packages from persistent storage"
fi

# Setup persistent Node modules
log "📦 Setting up Node.js packages..."

if [ ! -d "$NODE_MODULES" ]; then
    log "📦 Installing Node modules to persistent storage..."
    
    # Install to persistent location
    npm install --prefix "$DATA_DIR"
    
    log "✅ Node modules installed to persistent storage"
else
    log "✅ Using cached Node modules from persistent storage"
fi

# Create symlink to node_modules
if [ -L "node_modules" ]; then
    rm node_modules
fi
ln -sf "$NODE_MODULES" ./node_modules

log "🔗 Node modules symlinked successfully"

# Verify installations
log "🔍 Verifying installations..."
node --version
npm --version
python --version

# Check if key packages are available
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

# Set environment variables
export MODEL_PATH="$DATA_DIR/models"
export NODE_ENV="production"

log "🌍 Environment variables set:"
log "   PYTHONPATH=$PYTHONPATH"
log "   MODEL_PATH=$MODEL_PATH"
log "   NODE_ENV=$NODE_ENV"

# Create necessary directories
mkdir -p "$DATA_DIR/models"
mkdir -p "/tmp/processing"

# Start the application
log "🚀 Starting LoRA Style Transfer application..."
log "   Frontend: http://localhost:3000"
log "   Backend API: http://localhost:8000"

# Try production build first, fallback to dev mode
if npm run build 2>/dev/null; then
    log "✅ Production build successful, starting server..."
    npm start &
    NEXT_PID=$!
else
    log "⚠️  Production build failed, starting in development mode..."
    npm run dev &
    NEXT_PID=$!
fi

# Wait for Next.js to start
sleep 10

# Start Python backend if available
if [ -f "runpod_backend.py" ]; then
    log "🐍 Starting Python backend..."
    python runpod_backend.py &
    PYTHON_PID=$!
fi

log "✅ Application started successfully!"
log "🌐 Access your app at the RunPod provided URL"
log "📊 Logs will appear below..."

# Monitor processes
while true; do
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        log "❌ Next.js process died, restarting..."
        if npm run build 2>/dev/null; then
            npm start &
        else
            npm run dev &
        fi
        NEXT_PID=$!
    fi
    
    if [ ! -z "$PYTHON_PID" ] && ! kill -0 $PYTHON_PID 2>/dev/null; then
        log "❌ Python backend died, restarting..."
        python runpod_backend.py &
        PYTHON_PID=$!
    fi
    
    sleep 30
done