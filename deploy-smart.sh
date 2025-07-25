#!/bin/bash

# 智能部署脚本 - 自动选择最佳部署方式

echo "🚀 加密货币策略平台智能部署脚本"
echo "================================"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 确定使用的Docker Compose命令
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "✅ Docker环境检查通过"

# 检查.env文件
if [ ! -f .env ]; then
    echo "📋 创建.env文件..."
    cp .env.example .env
    echo "⚠️  请编辑.env文件配置必要的环境变量"
    echo "   - JWT_SECRET_KEY（必需）"
    echo "   - TELEGRAM_BOT_TOKEN（可选）"
    echo "   - 交易所API密钥（可选，用于私有API）"
    echo ""
    read -p "是否现在编辑.env文件？(y/n): " edit_env
    if [ "$edit_env" = "y" ] || [ "$edit_env" = "Y" ]; then
        ${EDITOR:-nano} .env
    fi
fi

# 智能选择部署方式
echo ""
echo "🔍 检查远程镜像可用性..."

# 尝试拉取远程镜像
if docker pull ghcr.io/linon419/xielin:latest > /dev/null 2>&1; then
    echo "✅ 远程镜像可用，使用远程镜像部署（推荐）"
    COMPOSE_FILE="docker-compose.remote.yml"
    DEPLOY_METHOD="remote"
else
    echo "⚠️  远程镜像不可用，使用本地构建"
    COMPOSE_FILE="docker-compose.local.yml"
    DEPLOY_METHOD="local"
fi

# 停止现有服务
echo "🛑 停止现有服务..."
$DOCKER_COMPOSE down > /dev/null 2>&1 || true
$DOCKER_COMPOSE -f docker-compose.local.yml down > /dev/null 2>&1 || true
$DOCKER_COMPOSE -f docker-compose.remote.yml down > /dev/null 2>&1 || true

# 部署服务
echo "🚀 开始部署..."
if [ "$DEPLOY_METHOD" = "remote" ]; then
    $DOCKER_COMPOSE -f $COMPOSE_FILE up -d
else
    echo "🔨 本地构建中，请耐心等待..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE up -d --build
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "📊 检查服务状态..."
$DOCKER_COMPOSE -f $COMPOSE_FILE ps

# 测试健康检查
echo "🏥 测试服务健康状态..."
for i in {1..6}; do
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        echo "✅ 服务启动成功！"
        break
    else
        if [ $i -eq 6 ]; then
            echo "⚠️  服务启动可能有问题，请检查日志"
            echo "查看日志: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
            exit 1
        else
            echo "⏳ 等待服务启动... ($i/6)"
            sleep 10
        fi
    fi
done

# 显示部署结果
echo ""
echo "🎉 部署完成！"
echo "================================"
echo "部署方式: $DEPLOY_METHOD"
echo "配置文件: $COMPOSE_FILE"
echo ""
echo "🌐 访问地址:"
echo "前端界面: http://localhost"
echo "API文档:  http://localhost/docs"
echo "健康检查: http://localhost/api/health"
echo ""
echo "🛠️  常用命令:"
echo "查看日志: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "停止服务: $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "重启服务: $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "查看状态: $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
echo ""
echo "📚 更多帮助请查看 DOCKER_DEPLOYMENT_GUIDE.md"
