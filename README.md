# 🎨 LoRA Style Transfer

[![Build and Push Docker Image](https://github.com/marelhott/Lora-Style-Transfer/actions/workflows/docker-build.yml/badge.svg)](https://github.com/marelhott/Lora-Style-Transfer/actions/workflows/docker-build.yml)

AI style transfer aplikace postavená na Next.js API Routes + Python workeru. Optimalizováno pro RunPod s persistentním diskem `/data`.

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
  # Používá se pouze Next.js server (API Routes). 8000 není potřeba.

env:
  - name: "DATA_PATH"
    value: "/data"
```

### **3. Deploy to RunPod**
```bash
# Option A: Docker (recommended)
docker run -d \
  --gpus all \
  -p 3000:3000 \
  -v /data:/data \
  -e DATA_PATH=/data \
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

### ✅ **Next.js API (server-side)**
- **`/api/models`** - listuje dostupné modely a LoRA přímo z `/data`
- **`/api/scan-disk`** - ruční scan disků (volitelně)
- **`/api/process`** - spustí Python worker (backend/process_image.py)
- **`/api/status/{jobId}`** - vrací stav jobu z in-memory storage

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

### **Development**
```bash
npm install
npm run dev
# http://localhost:3000
```

## 🐳 Docker Build

### **Build Image**
```bash
docker build -t ghcr.io/<user>/lora-style-transfer:latest .
docker push ghcr.io/<user>/lora-style-transfer:latest
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
Zkontrolujte, že jsou soubory v `/data/models` a `/data/loras` a že RunPod mountuje `/data` do kontejneru.

### **"Frontend can't connect to backend"**
V této verzi není samostatný backend server; vše běží na portu 3000.

### **"CUDA not available"**
```bash
# Check GPU
nvidia-smi

# Test PyTorch
python3 -c "import torch; print(torch.cuda.is_available())"
```

## 📊 Hardware Requirements

### **Minimum**
- GPU: RTX 4000 Ada (12GB+ VRAM)
- RAM: 16GB
- Storage: 50GB+ for app + models

### **Recommended**
- GPU: RTX 4090, A100 (24GB+ VRAM)
- RAM: 32GB
- Storage: 200GB+ (persistent disk for models)

## 🎯 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List available models |
| `/api/process` | POST | Start image processing |
| `/api/status/{job_id}` | GET | Get job status |
| `/api/scan-disk` | POST | Scan disk for models |

## 🔗 URLs

Po nasazení:
- **Aplikace**: `https://<RUNPOD_ID>-3000.proxy.runpod.net`

## 📝 License

MIT License - see LICENSE file for details.

---

**Ready to deploy!** 🚀
