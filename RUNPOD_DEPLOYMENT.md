# 🚀 RunPod Deployment Guide

## Přehled

Tento guide popisuje deployment LoRA Style Transfer aplikace na RunPod s AMD64 architekturou a GPU optimalizacemi.

## 📋 Požadavky

### Hardware
- **GPU**: NVIDIA RTX 4090, Tesla V100, A100 nebo podobná (min. 12GB VRAM)
- **RAM**: Minimálně 16GB, doporučeno 32GB+
- **Storage**: 200GB+ pro modely a LoRA
- **Architektura**: AMD64/x86_64

### Software
- Docker
- NVIDIA Container Toolkit
- CUDA 11.8+

## 🔧 Příprava

### 1. Příprava modelů

Nahrajte své modely do persistentního úložiště:

```bash
# Stable Diffusion modely (.safetensors, .ckpt)
/data/models/
├── stable-diffusion-v1-5.safetensors
├── realistic-vision-v5.safetensors
└── dreamshaper-v8.safetensors

# LoRA modely (.safetensors, .pt)
/data/loras/
├── portrait-enhancer.safetensors
├── anime-style.safetensors
└── landscape-master.safetensors
```

### 2. Build Docker Image

```bash
# Clone repository
git clone https://github.com/your-username/lora-style-transfer.git
cd lora-style-transfer

# Build image
docker build -t lora-style-transfer:latest .

# Tag pro registry
docker tag lora-style-transfer:latest your-registry/lora-style-transfer:latest

# Push do registry
docker push your-registry/lora-style-transfer:latest
```

## 🚀 Deployment na RunPod

### Metoda 1: RunPod Template (Doporučeno)

1. **Vytvořte Template**:
   ```bash
   # Upload runpod-config.yaml do RunPod
   runpod template create --config runpod-config.yaml
   ```

2. **Spusťte Pod**:
   - Vyberte template "lora-style-transfer"
   - Zvolte GPU (RTX 4090 nebo lepší)
   - Nastavte persistent storage
   - Spusťte pod

### Metoda 2: Manuální Setup

1. **Vytvořte nový Pod**:
   - Image: `your-registry/lora-style-transfer:latest`
   - GPU: RTX 4090 nebo lepší
   - RAM: 16GB+
   - Storage: 200GB+

2. **Nastavte Volume Mounts**:
   ```
   /data/models -> Persistent storage pro modely
   /data/loras -> Persistent storage pro LoRA
   /tmp/processing -> Temporary storage
   ```

3. **Environment Variables**:
   ```bash
   CUDA_VISIBLE_DEVICES=0
   PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
   OMP_NUM_THREADS=4
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Spouštěcí příkaz**:
   ```bash
   /app/docker-entrypoint.sh backend
   ```

## 🔍 Testování

### 1. Health Check

```bash
# Kontrola API
curl http://your-pod-ip:8000/api/health

# Očekávaná odpověď:
{
  "status": "healthy",
  "gpu_info": {
    "cuda_available": true,
    "device_name": "NVIDIA RTX 4090"
  },
  "models_available": 3
}
```

### 2. Test modelů

```bash
# Seznam dostupných modelů
curl http://your-pod-ip:8000/api/models

# Test zpracování
curl -X POST http://your-pod-ip:8000/api/process \
  -F "image=@test-image.jpg" \
  -F "model_id=model_stable-diffusion-v1-5" \
  -F 'parameters={"strength":0.8,"steps":20}'
```

### 3. Systémový test

```bash
# Spusť v containeru
docker exec -it your-container /app/docker-entrypoint.sh test
```

## 📊 Monitoring

### GPU Utilization

```bash
# V containeru
nvidia-smi -l 1

# Nebo přes API
curl http://your-pod-ip:8000/api/health | jq '.gpu_info'
```

### Memory Usage

```bash
# Celková paměť
free -h

# GPU paměť
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

### Logs

```bash
# Backend logs
docker logs your-container

# Real-time logs
docker logs -f your-container
```

## ⚡ Optimalizace

### 1. GPU Memory

```python
# V kódu jsou již implementovány:
- CPU offload pro úsporu VRAM
- Attention slicing
- Model caching
- Memory cleanup
```

### 2. Performance Tuning

```bash
# Environment variables pro optimalizaci
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
export OMP_NUM_THREADS=4
export CUDA_LAUNCH_BLOCKING=0
```

### 3. Model Quantization

```python
# Povolení v kódu:
- FP16 precision
- Model quantization (volitelné)
- XFormers attention (pokud dostupné)
```

## 🐛 Troubleshooting

### Časté problémy

1. **CUDA Out of Memory**:
   ```bash
   # Snižte batch size nebo povolte CPU offload
   # Zkontrolujte PYTORCH_CUDA_ALLOC_CONF
   ```

2. **Modely se nenačítají**:
   ```bash
   # Zkontrolujte cesty
   ls -la /data/models/
   ls -la /data/loras/
   
   # Zkontrolujte oprávnění
   chmod -R 755 /data/
   ```

3. **Pomalé zpracování**:
   ```bash
   # Zkontrolujte GPU utilization
   nvidia-smi
   
   # Povolte XFormers
   pip install xformers
   ```

### Debug Mode

```bash
# Spusť s debug logováním
docker run -e LOG_LEVEL=debug your-image

# Nebo v containeru
export LOG_LEVEL=debug
python -c "import logging; logging.basicConfig(level=logging.DEBUG)"
```

## 📈 Scaling

### Multi-GPU Setup

```yaml
# V runpod-config.yaml
resources:
  requests:
    nvidia.com/gpu: 2  # Více GPU
  limits:
    nvidia.com/gpu: 2
```

### Load Balancing

```bash
# Spusťte více instancí
# Použijte load balancer před API
```

## 🔒 Security

### API Security

```python
# Přidejte API klíče
# Implementujte rate limiting
# Použijte HTTPS
```

### Network Security

```bash
# Omezte přístup k portům
# Použijte VPN pro přístup
```

## 📞 Support

Pro podporu a dotazy:
- GitHub Issues: [repository-url]
- Email: your-email@domain.com
- Discord: [discord-link]

## 📄 License

MIT License - viz LICENSE soubor