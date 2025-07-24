#!/bin/bash

# 部署脚本 - 用于ARM服务器
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署 Xielin 加密货币交易策略平台..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose 未安装，请先安装 docker-compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建数据目录..."
mkdir -p ./data
mkdir -p ./logs

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从模板创建..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑其中的配置"
        echo "📝 特别注意设置 TELEGRAM_BOT_TOKEN"
    else
        echo "❌ .env.example 文件不存在"
        exit 1
    fi
fi

# 拉取最新镜像
echo "📥 拉取最新的 Docker 镜像..."
docker-compose pull

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查应用健康状态
echo "🏥 检查应用健康状态..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ 前端服务正常"
else
    echo "❌ 前端服务异常，请检查日志"
    docker-compose logs xielin
fi

if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ 后端API正常"
else
    echo "❌ 后端API异常，请检查日志"
    docker-compose logs xielin
fi

echo ""
echo "🎉 部署完成！"
echo "📱 应用访问地址: http://localhost"
echo "🔧 后端API地址: http://localhost/api"
echo "📊 查看日志: docker-compose logs -f xielin"
echo "🛑 停止服务: docker-compose down"
