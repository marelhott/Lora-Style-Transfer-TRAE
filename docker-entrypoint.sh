#!/bin/bash

# Docker Entrypoint Script pro LoRA Style Transfer - Clean Version
# Podporuje různé módy spuštění

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 LoRA Style Transfer - Clean Docker Entrypoint"
echo "================================================"

# Konfigurace
DATA_PATH="${DATA_PATH:-/data}"
MODELS_PATH="${DATA_PATH}/models"
LORAS_PATH="${DATA_PATH}/loras"

echo "📁 Data path: $DATA_PATH"
echo "📁 Models path: $MODELS_PATH"
echo "📁 LoRAs path: $LORAS_PATH"

# Kontrola persistentního disku
if [ ! -d "$DATA_PATH" ]; then
    echo "❌ ERROR: Persistentní disk nenalezen na $DATA_PATH"
    echo "   Připojte persistentní disk k /data v RunPod template"
    exit 1
fi

# Vytvoření adresářů pro modely
mkdir -p "$MODELS_PATH" "$LORAS_PATH"
echo "✅ Directories created"

# Best-effort nastav čitelnost (nepřerušuj při chybě)
if chmod -R a+rX "$DATA_PATH" 2>/dev/null; then
    echo "🔒 Permissions ensured on $DATA_PATH (a+rX)"
else
    echo "⚠️  WARNING: Could not adjust permissions on $DATA_PATH (non-fatal)"
fi

# Scan modelů
MODEL_COUNT=$(find "$MODELS_PATH" -name "*.safetensors" -o -name "*.ckpt" 2>/dev/null | wc -l)
LORA_COUNT=$(find "$LORAS_PATH" -name "*.safetensors" -o -name "*.pt" 2>/dev/null | wc -l)

echo "📊 Found models: $MODEL_COUNT full models, $LORA_COUNT LoRAs"

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo "⚠️  WARNING: Žádné modely nenalezeny!"
    echo "   Nahrajte .safetensors nebo .ckpt soubory do $MODELS_PATH"
fi

# Kontrola GPU
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "🎮 GPU Info:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "⚠️  WARNING: GPU not detected"
fi

# Spuštění podle módu
case "${1:-full}" in
    "full")
        echo "🌐 Starting Next.js application..."
        
        # Build frontend
        cd /app
        echo "🔨 Building frontend..."
        npm run build
        
        # Start Next.js production server
        echo "🚀 Starting Next.js server..."
        npm start
        ;;
        
    "backend")
        echo "🔧 Starting backend only..."
        cd /app/backend
        exec python main.py
        ;;
        
    "frontend")
        echo "🌐 Starting frontend only..."
        cd /app
        exec npm start
        ;;
        
    "standalone")
        echo "🐍 Starting standalone Python backend..."
        cd /app
        exec python3 runpod_backend.py
        ;;
        
    "test")
        echo "🧪 Running system tests..."
        
        # Test GPU
        echo "Testing GPU..."
        python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
        
        # Test backend
        echo "Testing backend..."
        cd /app/backend
        python -c "import fastapi, diffusers, transformers; print('Backend dependencies OK')"
        
        # Test frontend
        echo "Testing frontend..."
        cd /app
        node --version
        npm --version
        
        echo "✅ All tests passed"
        ;;
        
    *)
        echo "❌ Unknown mode: $1"
        echo "Available modes:"
        echo "  full       - Frontend + Backend (default)"
        echo "  backend    - Backend only"
        echo "  frontend   - Frontend only"
        echo "  standalone - Standalone Python backend"
        echo "  test       - System tests"
        exit 1
        ;;
esac
