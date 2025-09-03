#!/bin/bash

# Docker entrypoint pro LoRA Style Transfer - v2.0
# Podporuje správné volume mapping a různé módy spuštění

set -e

echo "🚀 LoRA Style Transfer - Docker Entrypoint v2.0"
echo "=============================================="

# Konfigurace
DATA_PATH="${DATA_PATH:-/data}"
MODE="${1:-full}"

echo "📁 Data path: $DATA_PATH"
echo "🎯 Mode: $MODE"

# Kontrola GPU
if command -v nvidia-smi >/dev/null 2>&1; then
    echo "🎮 GPU Info:"
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
    
    # CUDA test
    if python3 -c "import torch; print(f'🔥 CUDA Available: {torch.cuda.is_available()}')" 2>/dev/null; then
        python3 -c "import torch; print(f'🎯 Device: {torch.cuda.get_device_name() if torch.cuda.is_available() else \"CPU\"}')" 2>/dev/null
    fi
else
    echo "⚠️  No GPU detected"
fi

# KRITICKÉ: Kontrola persistentního disku
echo "🔍 Checking persistent disk mapping..."
if [ ! -d "$DATA_PATH" ]; then
    echo "❌ CHYBA: Persistentní disk nenalezen na $DATA_PATH"
    echo ""
    echo "🔧 ŘEŠENÍ: V RunPod template přidejte:"
    echo "volumeMounts:"
    echo "  - name: 'persistent-data'"
    echo "    mountPath: '/data'"
    echo ""
    echo "Pokud používáte jiný path, nastavte DATA_PATH environment variable"
    exit 1
else
    echo "✅ Persistentní disk nalezen: $DATA_PATH"
fi

# Vytvoření adresářů v persistentním disku (pokud neexistují)
mkdir -p "$DATA_PATH/models" "$DATA_PATH/loras" /tmp/processing

echo "📁 Directory structure:"
echo "   Models: $DATA_PATH/models"
echo "   LoRAs: $DATA_PATH/loras"  
echo "   Temp: /tmp/processing"

# Scan modelů a LoRA
MODEL_COUNT=$(find "$DATA_PATH/models" -name "*.safetensors" -o -name "*.ckpt" 2>/dev/null | wc -l)
LORA_COUNT=$(find "$DATA_PATH/loras" -name "*.safetensors" -o -name "*.pt" 2>/dev/null | wc -l)

echo "📊 Found: $MODEL_COUNT models, $LORA_COUNT LoRAs"

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo "⚠️  UPOZORNĚNÍ: Žádné modely nenalezeny!"
    echo "   Nahrajte .safetensors nebo .ckpt soubory do:"
    echo "   $DATA_PATH/models/"
    echo ""
    echo "   Podporované formáty:"
    echo "   - Stable Diffusion modely: .safetensors, .ckpt"
    echo "   - LoRA modely: .safetensors, .pt"
fi

# Export environment variables pro aplikace
export DATA_PATH="$DATA_PATH"
export MODELS_PATH="$DATA_PATH/models"
export LORAS_PATH="$DATA_PATH/loras"

# GPU optimalizace
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"
export PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:512"
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4

# Spuštění podle módu
case "$MODE" in
    "standalone")
        echo "🐍 Starting standalone mode..."
        echo "   Používá: runpod_backend.py"
        cd /app
        exec python3 runpod_backend.py
        ;;
        
    "backend"|"backend-only")
        echo "🔧 Starting backend only..."
        echo "   Používá: backend/main.py"
        cd /app/backend
        exec python3 main.py
        ;;
        
    "frontend"|"frontend-only")
        echo "🌐 Starting frontend only..."
        cd /app
        exec npm start
        ;;
        
    "full"|"")
        echo "🔄 Starting full application (frontend + backend)..."
        
        # Spuštění backendu na pozadí
        echo "🔧 Starting Python backend..."
        cd /app/backend
        python3 main.py &
        BACKEND_PID=$!
        
        # Čekání na backend
        echo "⏳ Waiting for backend to start..."
        sleep 15
        
        # Kontrola backend health
        echo "🏥 Backend health check..."
        for i in {1..5}; do
            if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
                echo "✅ Backend is healthy"
                break
            else
                echo "   Attempt $i/5: Backend not ready yet..."
                sleep 5
            fi
        done
        
        # Spuštění frontendu
        echo "🌐 Starting Next.js frontend..."
        cd /app
        npm start &
        FRONTEND_PID=$!
        
        echo ""
        echo "🎉 Application started successfully!"
        echo "================================================"
        echo "   📱 Frontend: http://localhost:3000"
        echo "   🔧 Backend API: http://localhost:8000"
        echo "   📊 Health: http://localhost:8000/api/health"
        echo "   📁 Models: $DATA_PATH/models"
        echo "   🎨 LoRAs: $DATA_PATH/loras"
        echo ""
        echo "   🌐 RunPod proxy URLs budou automaticky přiřazeny"
        echo "================================================"
        
        # Čekání na procesy
        wait $BACKEND_PID $FRONTEND_PID
        ;;
        
    "test")
        echo "🧪 Running system tests..."
        
        # Test Python dependencies
        echo "🔍 Testing Python dependencies..."
        python3 -c "
import sys
print(f'Python: {sys.version}')

try:
    import torch
    print(f'✅ PyTorch: {torch.__version__}')
    print(f'✅ CUDA: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'✅ GPU: {torch.cuda.get_device_name()}')
except Exception as e:
    print(f'❌ PyTorch: {e}')

try:
    import diffusers
    print(f'✅ Diffusers: {diffusers.__version__}')
except Exception as e:
    print(f'❌ Diffusers: {e}')

try:
    import fastapi
    print(f'✅ FastAPI: {fastapi.__version__}')
except Exception as e:
    print(f'❌ FastAPI: {e}')
"
        
        # Test model scanning
        echo "🔍 Testing model scanning..."
        python3 -c "
import sys
sys.path.append('/app/backend')
try:
    from model_manager import ModelManager
    mm = ModelManager()
    models = mm.get_available_models()
    print(f'✅ Model Manager: Found {len(models)} models')
    for model in models[:3]:  # Show first 3
        print(f'   - {model[\"name\"]} ({model[\"type\"]})')
except Exception as e:
    print(f'❌ Model Manager: {e}')
"
        
        echo "✅ Tests completed!"
        ;;
        
    *)
        echo "❌ Unknown mode: $MODE"
        echo ""
        echo "Usage: docker run [options] image [mode]"
        echo ""
        echo "Available modes:"
        echo "  full       - Frontend + Backend (výchozí)"
        echo "  standalone - Standalone Python backend"
        echo "  backend    - Pouze backend API"
        echo "  frontend   - Pouze frontend"
        echo "  test       - Systémové testy"
        echo ""
        echo "Environment variables:"
        echo "  DATA_PATH  - Cesta k persistentnímu disku (výchozí: /data)"
        exit 1
        ;;
esac
