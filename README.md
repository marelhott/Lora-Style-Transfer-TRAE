# 🎨 LoRA Style Transfer

**AI-powered style transfer aplikace s LoRA modely, Next.js frontend a Python backend optimalizovaná pro RunPod.**

![LoRA Style Transfer](https://img.shields.io/badge/AI-Style%20Transfer-blue) ![RunPod](https://img.shields.io/badge/Platform-RunPod-green) ![Next.js](https://img.shields.io/badge/Frontend-Next.js-black) ![Python](https://img.shields.io/badge/Backend-Python-yellow)

## ✨ **Funkce**

- 🎨 **AI Style Transfer** pomocí Stable Diffusion + LoRA modelů
- 🖼️ **Real-time preview** s progress tracking
- 📱 **Responzivní UI** postavené na Next.js a Tailwind CSS
- 🔥 **GPU optimalizace** pro rychlé generování
- 💾 **Persistentní storage** pro modely a výsledky
- 🚀 **RunPod ready** - jednoduchý deployment

## 🚀 **Quick Start**

### **Pro vývojáře v Cursor IDE**
📖 **[CURSOR_SETUP.md](CURSOR_SETUP.md)** - kompletní 1-minute setup guide

### **Pro RunPod deployment**

### **Způsob 1: Standalone (DOPORUČENO)**
```bash
# V RunPod terminálu
git clone https://github.com/marelhott/Lora-Style-Transfer.git
cd Lora-Style-Transfer
chmod +x start-runpod.sh
./start-runpod.sh install  # Jednou
./start-runpod.sh auto     # Spuštění
```

### **Způsob 2: Docker Template**
```bash
# RunPod template image
mulenmara1505/lora-style-transfer:latest

# Volume mapping
/data -> /data  # KRITICKÉ pro modely!

# Porty
3000 (frontend), 8000 (backend)
```

### **Způsob 3: Manual Setup**
```bash
# Backend
python runpod_backend.py

# Frontend (jiný terminál)  
npm run build && npm start
```

## 📁 **Struktura modelů**

Vaše modely musí být v persistentním disku:

```
/data/
├── models/              # Stable Diffusion modely
│   ├── sd-v1-5.safetensors
│   ├── realistic-vision.safetensors
│   └── dreamshaper.ckpt
└── loras/               # LoRA modely
    ├── portrait.safetensors
    ├── anime-style.pt
    └── landscape.safetensors
```

## 🎮 **Hardware požadavky**

### **Minimální:**
- **GPU:** RTX 4090, Tesla V100 (12GB+ VRAM)
- **RAM:** 16GB
- **Storage:** 50GB+ pro aplikaci + modely

### **Doporučené:**
- **GPU:** RTX 4090, A100 (24GB+ VRAM)  
- **RAM:** 32GB
- **Storage:** 200GB+ persistentní disk

## 🛠️ **Development**

### **Local Setup**
```bash
# Clone repository
git clone https://github.com/marelhott/Lora-Style-Transfer.git
cd Lora-Style-Transfer

# Backend setup
cd backend
pip install -r requirements.txt
python main.py

# Frontend setup (nový terminál)
npm install
npm run dev
```

### **Environment Variables**
```bash
# Optional - automatická detekce je preferovaná
NEXT_PUBLIC_API_URL=http://localhost:8000
DATA_PATH=/data
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

## 📚 **Deployment módy**

| Mód | Popis | Vhodné pro |
|-----|-------|------------|
| **Standalone** | Jeden Python script | RunPod, jednoduchost |
| **Docker** | Kontejner s oběma | Produkce, izolace |
| **Hybrid** | Backend + frontend samostatně | Development, flexibilita |
| **Manual** | Ruční setup | Customizace, debugging |

## 🔧 **Troubleshooting**

### **Nejčastější problémy:**

**"Persistentní disk nenalezen"**
```bash
# Zkontrolujte mount v RunPod template:
volumeMounts:
  - mountPath: "/data"
```

**"Žádné modely nenalezeny"**
```bash
# Nahrajte modely do správných složek
ls -la /data/models/     # .safetensors, .ckpt
ls -la /data/loras/      # .safetensors, .pt
```

**"Backend se nespustí"**
```bash
# Test závislostí
./start-runpod.sh install
python -c "import torch, diffusers; print('OK')"
```

### **Debug příkazy:**
```bash
# Kompletní diagnostika
./start-runpod.sh help

# Test systému
curl http://localhost:8000/api/health

# GPU status
nvidia-smi
```

## 📖 **Dokumentace**

- 💻 [Cursor IDE Setup](CURSOR_SETUP.md) - rychlý start pro vývojáře
- 📋 [RunPod Deployment v2.0](RUNPOD_DEPLOYMENT_V2.md) - produkční nasazení
- 🎮 [Hardware Requirements & Troubleshooting](RUNPOD_DEPLOYMENT_V2.md#troubleshooting)

## 🏗️ **Architektura**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI       │    │   GPU Processing│
│   Frontend      │◄──►│   Backend       │◄──►│   Pipeline      │
│   (Port 3000)   │    │   (Port 8000)   │    │   (CUDA)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Convex DB     │    │   Model Manager │    │   /data Storage │
│   (Results)     │    │   (Load/Cache)  │    │   (Models)      │
└─────────────────┘    └────────────���────┘    └─────────────────┘
```

## 🤝 **Contributing**

1. Fork repository
2. Vytvoř feature branch (`git checkout -b feature/nova-funkce`)
3. Commit změny (`git commit -am 'Přidání nové funkce'`)
4. Push branch (`git push origin feature/nova-funkce`)
5. Vytvoř Pull Request

## 📄 **License**

MIT License - viz [LICENSE](LICENSE) soubor.

## 🙏 **Acknowledgments**

- [Diffusers](https://github.com/huggingface/diffusers) - Stable Diffusion pipeline
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [RunPod](https://runpod.io/) - GPU cloud platform
- [Convex](https://convex.dev/) - Backend-as-a-Service

---

**🚀 Ready for RunPod deployment! Nahrajte svoje modely a začněte generovat!**
