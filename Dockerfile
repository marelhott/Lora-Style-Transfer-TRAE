# Optimalizovaný RunPod template s pre-instalovanými dependencies
# Úspora času a peněz - vše nainstalované v image

FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Nastavení environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Instalace základních systémových závislostí
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && ln -s /usr/bin/python3.10 /usr/bin/python

# Instalace Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN python -m pip install --upgrade pip --no-cache-dir

# Instalace PyTorch s CUDA podporou (největší download)
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Instalace AI/ML dependencies (bez pevných verzí pro kompatibilitu)
RUN pip install --no-cache-dir \
    diffusers \
    transformers \
    accelerate \
    safetensors \
    compel \
    opencv-python \
    huggingface-hub

# Instalace xformers a bitsandbytes samostatně (mohou selhat)
RUN pip install --no-cache-dir xformers || echo "xformers installation failed, continuing..."
RUN pip install --no-cache-dir bitsandbytes || echo "bitsandbytes installation failed, continuing..."

# Instalace základních Python balíčků
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    requests==2.31.0 \
    pillow==10.1.0 \
    numpy==1.24.3 \
    aiofiles==23.2.1 \
    python-dotenv==1.0.0 \
    psutil==5.9.6 \
    pytest==7.4.3 \
    pytest-asyncio==0.21.1 \
    logging-tree==1.9 \
    rich==13.7.0 \
    pydantic-core==2.14.1

# Vytvoření workspace adresáře
RUN mkdir -p /workspace /data/models

# Vytvoření non-root uživatele
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /workspace /data

USER appuser

# Nastavení pracovního adresáře
WORKDIR /workspace

# Exponování portů
EXPOSE 3000 8000

# Startup script se spustí při startu RunPod containeru
CMD ["bash", "-c", "echo 'Optimized RunPod template ready. All dependencies pre-installed!'"]
