# 🎨 LoRA Style Transfer - Clean Version

[![Build and Push Docker Image](https://github.com/marelhott/Lora-Style-Transfer/actions/workflows/docker-build.yml/badge.svg)](https://github.com/marelhott/Lora-Style-Transfer/actions/workflows/docker-build.yml)

**AI-powered LoRA style transfer application** built with Next.js, FastAPI, and Convex. Optimized for RunPod deployment with persistent disk support.

## 🚀 Quick Start - RunPod Deployment

### **1. Clone & Setup**
```bash
git clone https://github.com/mulenmara1505/lora-style-transfer-new.git
cd lora-style-transfer-new
```

### **2. RunPod Template Configuration**
```yaml
# runpod-template.yaml
volumeMounts:
  - name: "persistent-data"
    mountPath: "/data"
    subPath: ""

ports:
  - containerPort: 3000  # Frontend
    public: true
  - containerPort: 8000  # Backend API
    public: true

env:
  - name: "DATA_PATH"
    value: "/data"
  - name: "NEXT_PUBLIC_API_URL"
    value: "https://<RUNPOD_ID>-8000.proxy.runpod.net"
```

### **3. Deploy to RunPod**
```bash
# Option A: Docker (recommended)
docker run -d \
  --gpus all \
  -p 3000:3000 \
  -p 8000:8000 \
  -v /data:/data \
  -e DATA_PATH=/data \
  -e NEXT_PUBLIC_API_URL=https://<RUNPOD_ID>-8000.proxy.runpod.net \
  mulenmara1505/lora-style-transfer-new:latest

# Option B: Standalone
./deploy-runpod.sh standalone
```

## 📁 Model Structure

Place your models in the persistent disk:
```
/data/
├── models/           # Stable Diffusion models
│   ├── sd-v1-5.safetensors
│   ├── realistic-vision.safetensors
│   └── dreamshaper.ckpt
└── loras/            # LoRA models
    ├── portrait.safetensors
    ├── anime-style.pt
    └── landscape.safetensors
```

## 🔧 Features

### ✅ **Frontend (Next.js)**
- **Parameter Controls** - strength, CFG, steps, sampler
- **Image Upload** - drag & drop, file picker
- **Model Manager** - select from available models
- **Progress Tracker** - real-time processing status
- **Results Gallery** - view, download, favorites
- **Preset Manager** - save/load parameter presets

### ✅ **Backend (FastAPI)**
- **`/api/models`** - list available models
- **`/api/process`** - start AI processing
- **`/api/status/{job_id}`** - track job progress
- **`/api/health`** - health check + GPU info
- **`/api/rescan`** - rescan model directories

### ✅ **Database (Convex)**
- **Results** - store generated images
- **Presets** - store parameter presets
- **Real-time updates** - automatic UI refresh

## 🛠️ Local Development

### **Frontend Only**
```bash
npm install
npm run dev:frontend-only
# http://localhost:3000
```

### **Full Stack**
```bash
# Terminal 1: Frontend
npm run dev:frontend-only

# Terminal 2: Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
# http://localhost:8000
```

## 🐳 Docker Build

### **Build Image**
```bash
chmod +x scripts/docker-build-and-push.sh
./scripts/docker-build-and-push.sh latest
```

### **Test Locally**
```bash
docker run --rm -it \
  -p 3000:3000 \
  -p 8000:8000 \
  mulenmara1505/lora-style-transfer-new:latest
```

## 🔍 Troubleshooting

### **"No models found"**
```bash
# Check model paths
curl http://localhost:8000/api/debug/paths

# Rescan models
curl -X GET http://localhost:8000/api/rescan
```

### **"Frontend can't connect to backend"**
```bash
# Check backend health
curl http://localhost:8000/api/health

# Set explicit API URL
export NEXT_PUBLIC_API_URL=http://localhost:8000
```

### **"CUDA not available"**
```bash
# Check GPU
nvidia-smi

# Test PyTorch
python3 -c "import torch; print(torch.cuda.is_available())"
```

## 📊 Hardware Requirements

### **Minimum**
- GPU: RTX 4090, Tesla V100 (12GB+ VRAM)
- RAM: 16GB
- Storage: 50GB+ for app + models

### **Recommended**
- GPU: RTX 4090, A100 (24GB+ VRAM)
- RAM: 32GB
- Storage: 200GB+ (persistent disk for models)

## 🎯 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + GPU info |
| `/api/models` | GET | List available models |
| `/api/process` | POST | Start image processing |
| `/api/status/{job_id}` | GET | Get job status |
| `/api/rescan` | GET | Rescan model directories |
| `/api/debug/paths` | GET | Debug model paths |

## 🔗 URLs

After deployment:
- **Frontend**: `https://<RUNPOD_ID>-3000.proxy.runpod.net`
- **Backend API**: `https://<RUNPOD_ID>-8000.proxy.runpod.net`

## 📝 License

MIT License - see LICENSE file for details.

---

**Ready to deploy!** 🚀
