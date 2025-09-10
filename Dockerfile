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

# Instalace zjednodušených AI dependencies
RUN pip install --no-cache-dir \
    diffusers>=0.21.0 \
    transformers>=4.25.0 \
    safetensors>=0.3.0 \
    fastapi>=0.100.0 \
    uvicorn>=0.20.0 \
    python-multipart>=0.0.6 \
    pillow>=9.0.0

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
