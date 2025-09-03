#!/bin/bash

# RunPod Deployment Script pro LoRA Style Transfer
# Podporuje jak Docker tak standalone deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 LoRA Style Transfer - RunPod Deployment"
echo "=========================================="

# Detekce prostředí
if [ -f "/.dockerenv" ]; then
    ENVIRONMENT="docker"
    echo "📦 Detected: Docker container"
else
    ENVIRONMENT="standalone"
    echo "🖥️  Detected: Standalone RunPod"
fi

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

# Scan modelů
MODEL_COUNT=$(find "$MODELS_PATH" -name "*.safetensors" -o -name "*.ckpt" 2>/dev/null | wc -l)
LORA_COUNT=$(find "$LORAS_PATH" -name "*.safetensors" -o -name "*.pt" 2>/dev/null | wc -l)

echo "📊 Found models: $MODEL_COUNT full models, $LORA_COUNT LoRAs"

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo "⚠️  WARNING: Žádné modely nenalezeny!"
    echo "   Nahrajte .safetensors nebo .ckpt soubory do $MODELS_PATH"
fi

# Deployment podle prostředí
case "$1" in
    "standalone")
        echo "🐍 Starting standalone Python backend..."
        export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"
        
        # Instalace závislostí pokud potřeba
        if ! python3 -c "import fastapi" 2>/dev/null; then
            echo "📦 Installing Python dependencies..."
            pip install fastapi uvicorn torch torchvision diffusers transformers pillow
        fi
        
        # Spuštění standalone backendu
        python3 runpod_backend.py
        ;;
        
    "docker"|"")
        echo "🐳 Starting Docker mode..."
        
        # Kontrola GPU
        if command -v nvidia-smi >/dev/null 2>&1; then
            echo "🎮 GPU Info:"
            nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
        fi
        
        # Spuštění přes docker-entrypoint.sh
        exec /app/docker-entrypoint.sh
        ;;
        
    "frontend-only")
        echo "🌐 Starting frontend only..."
        cd "$SCRIPT_DIR"
        
        if [ ! -d "node_modules" ]; then
            echo "📦 Installing Node.js dependencies..."
            npm install
        fi
        
        if [ ! -d ".next" ]; then
            echo "🔨 Building frontend..."
            npm run build
        fi
        
        echo "🚀 Starting Next.js frontend on port 3000..."
        npm start
        ;;
        
    "backend-only")
        echo "🔧 Starting backend only..."
        cd "$SCRIPT_DIR/backend"
        
        # Instalace Python závislostí
        if [ -f "requirements.txt" ]; then
            pip install -r requirements.txt
        fi
        
        echo "🚀 Starting Python backend on port 8000..."
        python main.py
        ;;
        
    "help"|"-h"|"--help")
        echo "Usage: $0 [mode]"
        echo ""
        echo "Modes:"
        echo "  standalone    - Spustí standalone Python backend (doporučeno)"
        echo "  docker        - Spustí přes Docker setup (výchozí)"
        echo "  frontend-only - Spustí pouze Next.js frontend"
        echo "  backend-only  - Spustí pouze Python backend"
        echo "  help          - Zobrazí tuto nápovědu"
        echo ""
        echo "Environment variables:"
        echo "  DATA_PATH     - Cesta k persistentnímu disku (výchozí: /data)"
        exit 0
        ;;
        
    *)
        echo "❌ Unknown mode: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
