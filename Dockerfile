# RunPod Dockerfile pro LoRA Style Transfer
# Optimalizováno pro AMD64 architekturu s CUDA podporou

FROM nvidia/cuda:12.1.0-devel-ubuntu22.04

# Nastavení environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}

# Nastavení pracovního adresáře
WORKDIR /app

# Instalace systémových závislostí
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    wget \
    curl \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgoogle-perftools4 \
    libtcmalloc-minimal4 \
    && rm -rf /var/lib/apt/lists/*

# Vytvoření symbolického odkazu pro python
RUN ln -s /usr/bin/python3.10 /usr/bin/python

# Upgrade pip
RUN python -m pip install --upgrade pip

# Instalace PyTorch s CUDA 12.1 podporou
RUN pip install torch==2.1.0+cu121 torchvision==0.16.0+cu121 torchaudio==2.1.0+cu121 \
    --index-url https://download.pytorch.org/whl/cu121

# Kopírování requirements a instalace Python závislostí
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

# Instalace dodatečných optimalizací
RUN pip install xformers==0.0.22.post7 --index-url https://download.pytorch.org/whl/cu121
RUN pip install bitsandbytes==0.41.2.post2

# Kopírování aplikace
COPY backend/ /app/backend/
COPY app/ /app/app/
COPY components/ /app/components/
COPY convex/ /app/convex/
COPY lib/ /app/lib/
COPY hooks/ /app/hooks/
COPY package.json /app/
COPY next.config.js /app/
COPY tailwind.config.ts /app/
COPY tsconfig.json /app/
COPY postcss.config.js /app/
COPY components.json /app/
COPY .env /app/

# Vytvoření dočasných adresářů (data budou namountována z persistentního disku)
RUN mkdir -p /tmp/processing
# NOTE: /data bude namountován z RunPod persistentního disku

# Nastavení oprávnění
RUN chmod +x /app/backend/main.py

# Instalace Node.js 18 a npm z oficiálního tarballu (bez APT update)
RUN curl -fsSLO https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz && \
    tar -xJf node-v18.20.4-linux-x64.tar.xz -C /usr/local --strip-components=1 && \
    rm node-v18.20.4-linux-x64.tar.xz && \
    ln -sf /usr/local/bin/node /usr/bin/node && \
    ln -sf /usr/local/bin/npm /usr/bin/npm && \
    node --version && npm --version

# Instalace frontend závislostí a build
WORKDIR /app
RUN npm ci || npm install
RUN npm run build

# Zpět do backend adresáře
WORKDIR /app/backend

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Exponování portů
EXPOSE 8000 3000

# Spouštěcí skript
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Spuštění
CMD ["/app/docker-entrypoint.sh"]
