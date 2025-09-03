# 🐳 Docker Build & Deploy Guide

## Rychlý start

### 1. Manuální build a push

```bash
# Nastavte svůj Docker Hub username
export DOCKER_HUB_USERNAME="your-username"

# Build image
docker build --platform linux/amd64 -t ${DOCKER_HUB_USERNAME}/lora-style-transfer:latest .

# Login do Docker Hub
docker login

# Push na Docker Hub  
docker push ${DOCKER_HUB_USERNAME}/lora-style-transfer:latest
```

### 2. Použití build skriptu

```bash
# Spusťte build skript (který jsem vytvořil)
chmod +x scripts/docker-build-and-push.sh
./scripts/docker-build-and-push.sh

# Nebo s custom tagem
./scripts/docker-build-and-push.sh v1.0.0
```

## GitHub Actions (automatické buildy)

Vytvořte soubor `.github/workflows/docker-build.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

env:
  DOCKER_HUB_USERNAME: your-username
  IMAGE_NAME: lora-style-transfer

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ env.DOCKER_HUB_USERNAME }}
        password: ${{ secrets.DOCKER_HUB_TOKEN }}
        
    - name: Build and push
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64
        push: true
        tags: |
          ${{ env.DOCKER_HUB_USERNAME }}/${{ env.IMAGE_NAME }}:latest
          ${{ env.DOCKER_HUB_USERNAME }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

### Nastavení secrets v GitHub:

1. Jděte do Settings → Secrets and variables → Actions
2. Přidejte: `DOCKER_HUB_TOKEN` (vaš Docker Hub access token)

## RunPod deployment

Po push na Docker Hub můžete použít:

```bash
# RunPod template
docker run -d \
  --name lora-style-transfer \
  --gpus all \
  -p 3000:3000 \
  -p 8000:8000 \
  -v /workspace:/data \
  your-username/lora-style-transfer:latest
```

## Optimalizace

### Multi-stage build
Dockerfile už obsahuje optimalizace pro velikost image.

### Cache layers
```bash
# Použijte BuildKit pro lepší cache
export DOCKER_BUILDKIT=1
docker build --cache-from your-username/lora-style-transfer:latest .
```

## Troubleshooting

### Build fails
```bash
# Zkontrolujte Docker daemon
docker info

# Vyčistěte cache
docker system prune -a
```

### Push fails
```bash
# Login znovu
docker logout
docker login

# Zkontrolujte tag
docker images | grep lora-style-transfer
```
