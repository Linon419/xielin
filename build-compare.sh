#!/bin/bash

# Docker镜像大小比较脚本

echo "=== Docker镜像体积优化对比 ==="
echo ""

# 构建原始版本
echo "1. 构建原始版本..."
docker build -f Dockerfile -t xielin-app:original . --quiet

# 构建优化版本
echo "2. 构建优化版本..."
docker build -f Dockerfile.optimized -t xielin-app:optimized . --quiet

# 构建极简版本
echo "3. 构建极简版本..."
docker build -f Dockerfile.minimal -t xielin-app:minimal . --quiet

echo ""
echo "=== 镜像大小对比 ==="
echo ""

# 获取镜像大小
original_size=$(docker images xielin-app:original --format "table {{.Size}}" | tail -1)
optimized_size=$(docker images xielin-app:optimized --format "table {{.Size}}" | tail -1)
minimal_size=$(docker images xielin-app:minimal --format "table {{.Size}}" | tail -1)

echo "原始版本 (Dockerfile):       $original_size"
echo "优化版本 (Dockerfile.optimized): $optimized_size"
echo "极简版本 (Dockerfile.minimal):   $minimal_size"

echo ""
echo "=== 详细信息 ==="
docker images xielin-app --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "=== 优化建议 ==="
echo "1. 使用 Dockerfile.minimal 获得最小镜像体积"
echo "2. 使用 Dockerfile.optimized 获得平衡的功能和大小"
echo "3. 使用多阶段构建和alpine基础镜像"
echo "4. 合并RUN指令减少层数"
echo "5. 清理缓存和临时文件"