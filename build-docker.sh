#!/bin/bash

# 本地Docker镜像构建脚本 - ARM64架构
# 使用方法: ./build-docker.sh

set -e

echo "🐳 开始构建 ARM64 Docker 镜像..."

# 检查Docker是否支持buildx
if ! docker buildx version &> /dev/null; then
    echo "❌ Docker buildx 不可用，请更新 Docker 到最新版本"
    exit 1
fi

# 创建并使用buildx构建器
echo "🔧 设置 Docker buildx..."
docker buildx create --name xielin-builder --use --bootstrap 2>/dev/null || docker buildx use xielin-builder

# 构建前端镜像
echo "🎨 构建前端镜像 (ARM64)..."
docker buildx build \
    --platform linux/arm64 \
    -f Dockerfile.frontend \
    -t xielin-frontend:latest \
    -t xielin-frontend:arm64 \
    --load \
    .

# 构建后端镜像
echo "⚙️  构建后端镜像 (ARM64)..."
docker buildx build \
    --platform linux/arm64 \
    -f Dockerfile.backend \
    -t xielin-backend:latest \
    -t xielin-backend:arm64 \
    --load \
    .

# 显示构建的镜像
echo "📋 构建完成的镜像:"
docker images | grep xielin

echo ""
echo "✅ 构建完成！"
echo "🚀 启动服务: docker-compose up -d"
echo "🔍 查看镜像: docker images | grep xielin"
echo "🗑️  清理构建器: docker buildx rm xielin-builder"
