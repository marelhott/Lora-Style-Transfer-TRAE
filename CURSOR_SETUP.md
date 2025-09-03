# 🚀 Cursor Quick Setup - LoRA Style Transfer

**Rychlý start pro vývojáře v Cursor IDE**

## ⚡ 1-Minute Setup

### **1. Clone & Install**
```bash
git clone https://github.com/marelhott/Lora-Style-Transfer.git
cd Lora-Style-Transfer
npm install
```

### **2. Start Development**
```bash
# Frontend dev server
npm run dev
# Spustí frontend na http://localhost:3000

# Backend (jiný terminál)
cd backend
pip install -r requirements.txt
python main.py
# Spustí backend na http://localhost:8000
```

### **3. Open in Browser**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/health

---

## 🧭 **Architektura projektu**

```
┌─ app/
│  ├─ page.tsx           # Main page - AI generování
│  ├─ layout.tsx         # Root layout s Convex provider
│  └─ globals.css        # Tailwind styles
│
├─ components/
│  ├─ parameter-controls.tsx    # ✅ Ovládání parametrů (síla, CFG, kroky...)
│  ├─ progress-tracker.tsx      # ✅ Real-time progress
│  ├─ image-upload.tsx          # ✅ Drag & drop upload
│  ├─ model-manager.tsx         # ✅ Výběr AI modelů
│  ├─ results-gallery.tsx       # ✅ Galerie výsledků
│  ├─ preset-manager.tsx        # ✅ Uložené předvolby
│  └─ ui/                       # Shadcn UI komponenty
│
├─ backend/
│  ├─ main.py              # ✅ FastAPI server
│  ├─ model_manager.py     # �� Model scanning & loading
│  ├─ ai_pipeline.py       # ✅ AI processing pipeline
│  └─ requirements.txt     # Python dependencies
│
├─ convex/
│  ├─ results.ts           # ✅ Databáze výsledků
│  ├─ presets.ts           # ✅ Databáze předvoleb
│  └─ schema.ts            # Databázové schéma
│
└─ runpod_backend.py       # ✅ Standalone RunPod server
```

---

## 🔧 **Funkční komponenty (100% živé)**

### ✅ **Frontend (Next.js)**
- **Parameter Controls** - všechny slidery a selecty fungují
- **Image Upload** - drag & drop, file picker
- **Model Manager** - výběr modelů z backend API  
- **Progress Tracker** - real-time sledování zpracování
- **Results Gallery** - zobrazení, download, favorites
- **Preset Manager** - uložení/načtení nastavení do Convex DB

### ✅ **Backend (Python FastAPI)**
- **`/api/models`** - vrací seznam dostupných modelů
- **`/api/process`** - spouští AI generování
- **`/api/status/{job_id}`** - sleduje progress jobu
- **`/api/health`** - health check + GPU info

### ✅ **Databáze (Convex)**
- **Results** - ukládání vygenerovaných obrázků
- **Presets** - ukládání předvoleb parametrů
- **Real-time updates** - automatické refresh UI

---

## 🎯 **Co funguje hned po instalaci**

### **Frontend pouze**
```bash
npm run dev
```
**Funkční:** UI komponenty, lokální state, Convex databáze
**Nefunkční:** Generování (potřebuje backend)

### **Frontend + Backend**
```bash
# Terminal 1
npm run dev

# Terminal 2  
cd backend && python main.py
```
**Funkční:** Kompletní AI generování pipeline
**Potřebuje:** GPU s CUDA pro rychlé zpracování

---

## 🐛 **Common Issues & Solutions**

### **"No models found"**
```bash
# Vytvořte testovací modely:
mkdir -p backend/test_models
# Nahrajte .safetensors soubory do backend/test_models/

# Nebo nastavte cestu:
export MODELS_PATH="/path/to/your/models"
```

### **"Convex not connected"**
```bash
# Setup Convex:
npx convex dev
# Postupujte podle instrukcí pro login a deploy
```

### **"CUDA not available"**
```bash
# Test CUDA:
python -c "import torch; print(torch.cuda.is_available())"

# Pokud False:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

---

## 📝 **Development Workflow**

### **1. Frontend changes**
- Edit komponenty v `components/`
- UI se automaticky reloaduje
- Tailwind styles v `app/globals.css`

### **2. Backend changes**  
- Edit `backend/*.py`
- Restart `python main.py`
- Test API na http://localhost:8000/docs

### **3. Database changes**
- Edit `convex/*.ts`
- Deploy: `npx convex dev`
- Schema changes automaticky migrovány

### **4. Testing**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/health
- Upload test image → spustit generování

---

## 🚀 **Deployment**

### **RunPod (doporučeno)**
```bash
# Standalone mode
./start-runpod.sh auto

# Docker mode
docker run --gpus all -p 3000:3000 -p 8000:8000 -v /data:/data mulenmara1505/lora-style-transfer:latest
```

### **Local Production**
```bash
npm run build
npm start

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 🔑 **Environment Variables**

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000  # Optional - auto-detects

# Backend (.env)  
MODELS_PATH=/data/models                   # Path to Stable Diffusion models
LORAS_PATH=/data/loras                     # Path to LoRA models
CUDA_VISIBLE_DEVICES=0                     # GPU selection

# Convex (.env.local)
CONVEX_DEPLOYMENT=...                      # Auto-generated by npx convex dev
```

---

## 📚 **Key Files to Know**

| File | Purpose | Edit for |
|------|---------|----------|
| `app/page.tsx` | Main UI logic | Add new features, API calls |
| `components/parameter-controls.tsx` | Parameters UI | New parameters, validation |
| `backend/main.py` | API endpoints | New API routes |
| `backend/ai_pipeline.py` | AI processing | Model loading, generation logic |
| `convex/schema.ts` | Database schema | New data structures |
| `convex/results.ts` | Results API | Database operations |

---

## 🎯 **Next Steps**

1. **Run setup** - `npm install && npm run dev`
2. **Test frontend** - localhost:3000
3. **Add backend** - `cd backend && python main.py`  
4. **Test AI generation** - upload image → generate
5. **Deploy to RunPod** - Follow RUNPOD_DEPLOYMENT_V2.md

**🎉 Ready to code! Vše je funkční a připravené k rozvoji.**
