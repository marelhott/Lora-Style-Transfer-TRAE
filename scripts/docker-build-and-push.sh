#!/bin/bash

# Docker Build and Push script pro LoRA Style Transfer
# Použití: ./scripts/docker-build-and-push.sh [tag]

set -e

# Konfigurace
DOCKER_HUB_USERNAME="${DOCKER_HUB_USERNAME:-mulenmara1505}"
IMAGE_NAME="lora-style-transfer"
TAG="${1:-latest}"
FULL_IMAGE_NAME="${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:${TAG}"

echo "🚀 Building Docker image: ${FULL_IMAGE_NAME}"

# Kontrola jestli jsme v root adresáři projektu
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found. Run this script from the project root."
    exit 1
fi

# Build multi-platform image (AMD64 pro RunPod)
echo "📦 Building image..."
docker build \
    --platform linux/amd64 \
    --tag "${FULL_IMAGE_NAME}" \
    --tag "${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest" \
    --progress=plain \
    .

echo "✅ Build completed: ${FULL_IMAGE_NAME}"

# Login do Docker Hub (pokud není už přihlášený)
if ! docker info | grep -q "Username:"; then
    echo "🔐 Logging into Docker Hub..."
    echo "Enter your Docker Hub password:"
    docker login --username "${DOCKER_HUB_USERNAME}"
fi

# Push image na Docker Hub
echo "📤 Pushing to Docker Hub..."
docker push "${FULL_IMAGE_NAME}"

if [ "${TAG}" != "latest" ]; then
    docker push "${DOCKER_HUB_USERNAME}/${IMAGE_NAME}:latest"
fi

echo "🎉 Successfully pushed: ${FULL_IMAGE_NAME}"
echo "📋 Image can be used as: docker pull ${FULL_IMAGE_NAME}"

# Ukázat velikost image
echo "📊 Image size:"
docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "🚀 RunPod template command:"
echo "docker run -d --gpus all -p 3000:3000 -p 8000:8000 -v /workspace:/data ${FULL_IMAGE_NAME}"
