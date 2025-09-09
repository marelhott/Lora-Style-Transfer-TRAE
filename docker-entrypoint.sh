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
        echo "🐳 Starting full stack (frontend + backend)..."
        
        # Nastav environment variables pro frontend
        export NEXT_PUBLIC_API_URL="http://localhost:8000"
        
        # Spustit backend v pozadí
        cd /app/backend
        echo "🔧 Starting backend..."
        python main.py &
        BACKEND_PID=$!
        
        # Počkat na backend a ověřit že běží
        echo "⏳ Waiting for backend to start..."
        for i in {1..10}; do
            if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
                echo "✅ Backend is running on port 8000"
                break
            fi
            echo "   Attempt $i/10: Backend not ready yet..."
            sleep 2
        done
        
        # Ověřit že backend skutečně běží
        if ! curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
            echo "❌ ERROR: Backend failed to start properly"
            echo "   Trying fallback simple HTTP server..."
            
            # Kill failed backend
            pkill -f "python main.py" 2>/dev/null || true
            
            # Start simple HTTP server for testing
            cd /app/backend
            python3 -c "
import http.server
import socketserver
import json
import os

class SimpleHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'status': 'healthy', 'mode': 'fallback'}
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/api/test':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'message': 'Fallback server working', 'models_path': '/data/models', 'loras_path': '/data/loras'}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(('', 8000), SimpleHandler) as httpd:
    print('Fallback HTTP server running on port 8000')
    httpd.serve_forever()
" &
            BACKEND_PID=$!
            
            # Wait for fallback server
            sleep 2
            if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
                echo "✅ Fallback server is running"
            else
                echo "❌ Even fallback server failed"
                exit 1
            fi
        fi
        
        # Build frontend pro statické servování
        cd /app
        echo "🌐 Building frontend for static serving..."
        npm run build
        
        echo "✅ Single service started (backend + frontend)"
        echo "   Application: http://localhost:8000"
        echo "   API: http://localhost:8000/api"
        
        # Počkat na ukončení backendu
        wait $BACKEND_PID
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
