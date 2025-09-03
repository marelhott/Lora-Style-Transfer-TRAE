# 🚀 RunPod Deployment Guide v2.0

**Konečné řešení pro spolehlivé fungování na RunPod s persistentním diskem**

## 🎯 **Co je nového v v2.0:**

✅ **Standalone Python backend** - funguje bez Docker problémů  
✅ **Správné volume mapping** - opraveno pro `/data` persistentní disk  
✅ **Automatická detekce** - adaptuje se na RunPod prostředí  
✅ **Robustní error handling** - jasné chybové hlášky  
✅ **Multiple deployment módy** - vyberte si co potřebujete  

---

## 🚀 **Rychlý start - 3 způsoby:**

### **Způsob 1: Standalone (DOPORUČENO)**
```bash
# V RunPod terminálu
git clone https://github.com/marelhott/Lora-Style-Transfer.git
cd Lora-Style-Transfer
chmod +x deploy-runpod.sh
./deploy-runpod.sh standalone
```

### **Způsob 2: Docker (opravený)**
```bash
# RunPod template s volume mapping
docker run -d \
  --gpus all \
  -p 3000:3000 \
  -p 8000:8000 \
  -v /data:/data \
  -e DATA_PATH=/data \
  mulenmara1505/lora-style-transfer:latest
```

### **Způsob 3: Hybrid**
```bash
# Spustit jen backend, frontend lokálně
./deploy-runpod.sh backend-only
```

---

## 📁 **Setup persistentního disku:**

### **1. Struktura adresářů**
Vaše modely musí být v těchto cestách:
```
/data/
├── models/           # Stable Diffusion modely
│   ├── sd-v1-5.safetensors
│   ├── realistic-vision.safetensors
│   └── dreamshaper.ckpt
└── loras/            # LoRA modely
    ├── portrait.safetensors
    ├── anime-style.pt
    └── landscape.safetensors
```

### **2. RunPod Template konfigurace**
```yaml
# V runpod-template.yaml (vytvořeno)
volumeMounts:
  - name: "persistent-data"
    mountPath: "/data"    # KRITICKÉ!
    subPath: ""

# Porty
ports:
  - containerPort: 3000  # Frontend
    public: true
  - containerPort: 8000  # Backend API
    public: true
```

---

## 🛠️ **Deployment módy:**

### **Standalone Mode (Nejjednodušší)**
```bash
# Jeden Python script, všechno v sobě
python3 runpod_backend.py

# Automaticky:
# ✅ Detekuje /data disk
# ✅ Skenuje modely
# ✅ Spustí API na port 8000
# ✅ Servíruje frontend ze build/
```

### **Docker Mode (Původní)**  
```bash
# Přes docker-entrypoint.sh
docker run mulenmara1505/lora-style-transfer:latest full

# Módy:
# - full: frontend + backend
# - backend: pouze API
# - frontend: pouze web
# - standalone: jeden Python script
# - test: systémové testy
```

### **Manual Mode**
```bash
# Backend
cd backend && python main.py

# Frontend (jiný terminál)
npm run build && npm start
```

---

## 🔧 **Troubleshooting:**

### **Problém: "Persistentní disk nenalezen"**
```bash
# Zkontrolujte mount
ls -la /data

# Pokud neexistuje, v RunPod template:
volumeMounts:
  - mountPath: "/data"
    
# Nebo nastavte jiný path:
export DATA_PATH=/workspace
```

### **Problém: "Žádné modely nenalezeny"**
```bash
# Zkontrolujte strukturu
find /data -name "*.safetensors"

# Nahrajte modely do správných složek:
# /data/models/     - pro Stable Diffusion
# /data/loras/      - pro LoRA modely
```

### **Problém: "Backend se nespustí"**
```bash
# Zkontrolujte logs
./deploy-runpod.sh test

# Nebo debug mode:
python3 runpod_backend.py
```

### **Problém: "Frontend nemůže volat backend"**
```bash
# Backend běží na:
curl http://localhost:8000/api/health

# Frontend automaticky detekuje RunPod proxy URL
# Zkontrolujte v browser console:
# "🔧 getApiBaseUrl() called"
```

---

## 📊 **Porovnání metod:**

| Metoda | Spolehlivost | Setup čas | Flexibilita |
|--------|-------------|-----------|-------------|
| **Standalone** | ⭐⭐⭐⭐⭐ | 2 min | ⭐⭐⭐⭐ |
| **Docker (opravený)** | ⭐⭐⭐⭐ | 5 min | ⭐⭐⭐⭐⭐ |
| **Hybrid** | ⭐⭐⭐⭐ | 3 min | ⭐⭐⭐ |
| **Manual** | ⭐⭐⭐ | 10 min | ⭐⭐⭐⭐⭐ |

---

## 🎮 **Hardware requirements:**

### **Minimální:**
- GPU: RTX 4090, Tesla V100 (12GB+ VRAM)
- RAM: 16GB
- Storage: 50GB+ pro aplikaci + modely

### **Doporučené:**
- GPU: RTX 4090, A100 (24GB+ VRAM)
- RAM: 32GB
- Storage: 200GB+ (persistentní disk pro modely)

---

## 🔍 **Diagnostika:**

### **Automatický test**
```bash
# Spustí kompletní diagnostiku
./deploy-runpod.sh help
```

### **Manuální checks**
```bash
# GPU
nvidia-smi

# Python dependencies  
python3 -c "import torch, diffusers; print('OK')"

# Disk space
df -h /data

# Models
find /data -name "*.safetensors" | wc -l

# API health
curl http://localhost:8000/api/health
```

---

## 🎯 **Production Tips:**

### **Environment Variables**
```bash
# V RunPod template
env:
  - name: "DATA_PATH"
    value: "/data"
  - name: "PYTORCH_CUDA_ALLOC_CONF"
    value: "max_split_size_mb:512"
  - name: "OMP_NUM_THREADS" 
    value: "4"
```

### **Memory Optimization**
```python
# Už implementováno v kódu:
# - Model CPU offload
# - Attention slicing  
# - Memory cleanup
# - Batch processing
```

### **Monitoring**
```bash
# GPU utilization
watch -n 1 nvidia-smi

# Memory usage
htop

# API logs
tail -f /tmp/api.log
```

---

## 📞 **Support**

### **Nejčastější problémy:**
1. **Volume mapping** - zkontrolujte `/data` mount
2. **Model cesty** - musí být v `/data/models/` a `/data/loras/`
3. **GPU memory** - zvyšte VRAM nebo snižte batch size
4. **Frontend komunikace** - používá automatickou detekci RunPod URL

### **Debug příkazy:**
```bash
# Kompletní test
./deploy-runpod.sh test

# Standalone mode test
python3 runpod_backend.py

# Docker test  
docker run --rm -it mulenmara1505/lora-style-transfer:latest test
```

### **Logy:**
```bash
# Backend logs
tail -f /app/backend/logs/

# Frontend logs  
npm run dev

# System logs
dmesg | tail
```

---

## 🎉 **Výsledek:**

Po správném setup budete mít:

✅ **Spolehlivě fungující aplikaci** na RunPod  
✅ **Automatické napojení** na persistentní disk  
✅ **Rychlé loading** vašich modelů  
✅ **Webové rozhraní** pro generování  
✅ **Real-time progress** tracking  

**URL struktura:**
- Frontend: `https://xxx-3000.proxy.runpod.net`
- Backend API: `https://xxx-8000.proxy.runpod.net`

**Automaticky detekuje a funguje!** 🚀
