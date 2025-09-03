#!/bin/bash

# 🚀 LoRA Style Transfer - RunPod Quick Start
# Jednoduché spuštění pro RunPod

set -e

echo "🚀 LoRA Style Transfer - RunPod Quick Start"
echo "=========================================="

# Detekce prostředí
if [ -f "/.dockerenv" ]; then
    echo "📦 Running in Docker container"
    ENVIRONMENT="docker"
else
    echo "🖥️  Running on bare metal RunPod"
    ENVIRONMENT="standalone"
fi

# Kontrola data disku
DATA_PATH="${DATA_PATH:-/data}"
if [ ! -d "$DATA_PATH" ]; then
    echo "⚠️  Warning: $DATA_PATH not found, trying /workspace..."
    DATA_PATH="/workspace"
fi

if [ ! -d "$DATA_PATH" ]; then
    echo "❌ No persistent storage found. Creating temporary directories..."
    DATA_PATH="/tmp/data"
    mkdir -p "$DATA_PATH/models" "$DATA_PATH/loras"
fi

echo "📁 Using data path: $DATA_PATH"

# Export pro aplikace
export DATA_PATH="$DATA_PATH"
export MODELS_PATH="$DATA_PATH/models"
export LORAS_PATH="$DATA_PATH/loras"

# Quick model check
MODEL_COUNT=$(find "$DATA_PATH/models" -name "*.safetensors" -o -name "*.ckpt" 2>/dev/null | wc -l)
LORA_COUNT=$(find "$DATA_PATH/loras" -name "*.safetensors" -o -name "*.pt" 2>/dev/null | wc -l)

echo "📊 Models found: $MODEL_COUNT full, $LORA_COUNT LoRA"

# GPU check
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "🎮 GPU available: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
else
    echo "⚠️  No GPU detected"
fi

# Spuštění podle argumentu
MODE="${1:-auto}"

case "$MODE" in
    "auto")
        echo "🤖 Auto mode - detecting best option..."
        
        # Pokud máme Python a dependencies, použij standalone
        if python3 -c "import torch, diffusers, fastapi" 2>/dev/null; then
            echo "✅ Python dependencies OK - using standalone mode"
            exec python3 runpod_backend.py
        # Pokud máme Docker, použij Docker
        elif [ "$ENVIRONMENT" = "docker" ]; then
            echo "✅ Docker environment - using container mode"
            exec /app/docker-entrypoint.sh full
        else
            echo "❌ No suitable runtime found"
            echo "Install dependencies: pip install torch diffusers fastapi uvicorn"
            exit 1
        fi
        ;;
        
    "standalone")
        echo "🐍 Starting standalone Python backend..."
        exec python3 runpod_backend.py
        ;;
        
    "docker")
        echo "🐳 Starting Docker mode..."
        exec /app/docker-entrypoint.sh full
        ;;
        
    "install")
        echo "📦 Installing dependencies..."
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
        pip install diffusers transformers fastapi uvicorn pillow
        echo "✅ Dependencies installed"
        echo "Run: ./start-runpod.sh to start the application"
        ;;
        
    "help"|"-h"|"--help")
        echo "Usage: $0 [mode]"
        echo ""
        echo "Modes:"
        echo "  auto       - Automatically detect best mode (default)"
        echo "  standalone - Run standalone Python backend"
        echo "  docker     - Run Docker container mode"
        echo "  install    - Install Python dependencies"
        echo "  help       - Show this help"
        echo ""
        echo "Requirements:"
        echo "  - GPU: RTX 4090+ (12GB+ VRAM)"
        echo "  - Models in: $DATA_PATH/models/"
        echo "  - LoRAs in: $DATA_PATH/loras/"
        ;;
        
    *)
        echo "❌ Unknown mode: $MODE"
        echo "Use '$0 help' for usage"
        exit 1
        ;;
esac
