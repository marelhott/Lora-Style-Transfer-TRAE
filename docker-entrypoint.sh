#!/bin/bash

# RunPod Docker Entrypoint Script
# Spouští backend API a frontend současně

set -e

echo "🚀 Starting LoRA Style Transfer on RunPod..."

# Kontrola GPU dostupnosti
if command -v nvidia-smi &> /dev/null; then
    echo "📊 GPU Information:"
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits
else
    echo "⚠️  Warning: nvidia-smi not found, GPU may not be available"
fi

# Kontrola CUDA
if python -c "import torch; print(f'🔥 CUDA Available: {torch.cuda.is_available()}')" 2>/dev/null; then
    python -c "import torch; print(f'🎯 CUDA Device: {torch.cuda.get_device_name() if torch.cuda.is_available() else "None"}')"
else
    echo "⚠️  Warning: Could not check CUDA availability"
fi

# Kontrola dostupnosti modelů a LoRA
echo "📁 Checking data directories..."
if [ -d "/data/models" ]; then
    MODEL_COUNT=$(find /data/models -name "*.safetensors" -o -name "*.ckpt" | wc -l)
    echo "📦 Found $MODEL_COUNT Stable Diffusion models in /data/models"
else
    echo "⚠️  Warning: /data/models directory not found"
    mkdir -p /data/models
fi

if [ -d "/data/loras" ]; then
    LORA_COUNT=$(find /data/loras -name "*.safetensors" -o -name "*.pt" | wc -l)
    echo "🎨 Found $LORA_COUNT LoRA models in /data/loras"
else
    echo "⚠️  Warning: /data/loras directory not found"
    mkdir -p /data/loras
fi

# Vytvoření temp adresářů
mkdir -p /tmp/processing

# Nastavení environment variables
export PYTHONPATH="/app/backend:$PYTHONPATH"
export CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES:-0}
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# Optimalizace pro RunPod
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4
export NUMEXPR_NUM_THREADS=4

# Funkce pro spuštění backend API
start_backend() {
    echo "🔧 Starting Backend API on port 8000..."
    cd /app/backend
    
    # Kontrola závislostí
    python -c "import torch, diffusers, transformers; print('✅ All AI dependencies loaded successfully')"
    
    # Spuštění s optimalizacemi
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 1 \
        --log-level info \
        --access-log \
        --use-colors
}

# Funkce pro spuštění frontend (volitelné)
start_frontend() {
    echo "🌐 Starting Frontend on port 3000..."
    cd /app
    
    # Nastavení environment pro frontend - nechej automatickou detekci
    # export NEXT_PUBLIC_API_URL="http://localhost:8000"  # Zakázáno - používá se automatická detekce
    
    # Spuštění Next.js
    exec npm start
}

# Kontrola argumentů
case "${1:-full}" in
    "backend")
        start_backend
        ;;
    "frontend")
        start_frontend
        ;;
    "full")
        echo "🚀 Starting both backend and frontend..."
         
         # Spuštění backend na pozadí
         start_backend &
         BACKEND_PID=$!
         
         # Čekání na spuštění backend
         echo "⏳ Waiting for backend to start..."
         sleep 10
         
         # Kontrola backend health
         if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
             echo "✅ Backend is healthy"
         else
             echo "❌ Backend health check failed"
         fi
         
         # Spuštění frontend
         start_frontend &
         FRONTEND_PID=$!
         
         # Čekání na oba procesy
         wait $BACKEND_PID $FRONTEND_PID
        ;;
    "test")
        echo "🧪 Running tests..."
        cd /app/backend
        python -c "
print('🔍 Testing imports...')
try:
    import torch
    print(f'✅ PyTorch: {torch.__version__}')
    print(f'✅ CUDA Available: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'✅ CUDA Device: {torch.cuda.get_device_name()}')
except Exception as e:
    print(f'❌ PyTorch error: {e}')

try:
    import diffusers
    print(f'✅ Diffusers: {diffusers.__version__}')
except Exception as e:
    print(f'❌ Diffusers error: {e}')

try:
    import transformers
    print(f'✅ Transformers: {transformers.__version__}')
except Exception as e:
    print(f'❌ Transformers error: {e}')

try:
    from model_manager import model_manager
    models = model_manager.get_available_models()
    print(f'✅ Model Manager: Found {len(models)} models')
except Exception as e:
    print(f'❌ Model Manager error: {e}')

try:
    from ai_pipeline import ai_processor
    stats = ai_processor.get_performance_stats()
    print(f'✅ AI Pipeline: {stats["device"]}')
except Exception as e:
    print(f'❌ AI Pipeline error: {e}')

print('🎉 Test completed!')
"
        ;;
    *)
        echo "Usage: $0 {backend|frontend|full|test}"
        echo "  backend  - Start only backend API (default)"
        echo "  frontend - Start only frontend"
        echo "  full     - Start both backend and frontend"
        echo "  test     - Run system tests"
        exit 1
        ;;
esac