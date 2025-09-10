# Minimální RunPod template pro Git pull deployment
# AMD64 optimalizovaný pro rychlé starty

FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Nastavení environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Instalace pouze základních runtime závislostí
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

# Instalace pouze základních Python balíčků (PyTorch se nainstaluje při startu)
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    requests \
    pillow \
    numpy

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
CMD ["bash", "-c", "echo 'RunPod template ready. Use startup script to deploy app.'"]
