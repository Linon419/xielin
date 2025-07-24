# Docker 部署指南 (ARM64)

本项目支持通过 Docker 在 ARM64 架构设备上部署，包括 Apple Silicon Mac、ARM 服务器等。

## 🚀 快速开始

### 1. 使用预构建镜像（推荐）

```bash
# 克隆项目
git clone https://github.com/Linon419/xielin.git
cd xielin

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 TELEGRAM_BOT_TOKEN 等

# 启动服务
docker-compose up -d
```

### 2. 本地构建镜像

```bash
# 构建镜像
./build-docker.sh

# 启动服务
docker-compose -f docker-compose.dev.yml up -d
```

## 📦 Docker 镜像

项目包含两个 Docker 镜像：

- **前端镜像**: `ghcr.io/linon419/xielin-frontend:latest`
- **后端镜像**: `ghcr.io/linon419/xielin-backend:latest`

所有镜像都针对 ARM64 架构优化。

## 🔧 配置说明

### 环境变量

在 `.env` 文件中配置以下变量：

```bash
# Telegram Bot Token（必需）
TELEGRAM_BOT_TOKEN=your_bot_token_here

# JWT 密钥（可选）
JWT_SECRET_KEY=your-secret-key

# 其他前端配置
REACT_APP_API_BASE_URL=/api
REACT_APP_APP_NAME=加密货币合约谢林点交易策略平台
```

### 端口配置

- **前端**: http://localhost:80
- **后端**: http://localhost:8000
- **API**: http://localhost/api

## 🛠️ 开发环境

```bash
# 开发环境启动（支持热重载）
docker-compose -f docker-compose.dev.yml up --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📊 监控和维护

### 健康检查

```bash
# 检查服务状态
docker-compose ps

# 检查后端健康状态
curl http://localhost:8000/health

# 检查前端状态
curl http://localhost/health
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 数据备份

```bash
# 备份数据库
docker-compose exec backend cp /app/crypto_platform.db /app/data/backup_$(date +%Y%m%d_%H%M%S).db

# 备份整个数据目录
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz data/
```

## 🔄 自动部署

项目配置了 GitHub Actions，每次推送到 main 分支时会自动构建 ARM64 Docker 镜像。

### 部署流程

1. 推送代码到 GitHub
2. GitHub Actions 自动构建镜像
3. 在服务器上拉取最新镜像
4. 重启服务

```bash
# 在服务器上更新
docker-compose pull
docker-compose up -d
```

## 🐛 故障排除

### 常见问题

1. **镜像拉取失败**
   ```bash
   # 检查网络连接
   docker pull ghcr.io/linon419/xielin-frontend:latest
   ```

2. **服务启动失败**
   ```bash
   # 查看详细日志
   docker-compose logs backend
   ```

3. **端口冲突**
   ```bash
   # 修改 docker-compose.yml 中的端口映射
   ports:
     - "8080:80"  # 将前端端口改为 8080
   ```

4. **权限问题**
   ```bash
   # 确保数据目录权限正确
   sudo chown -R $USER:$USER data/
   ```

## 📱 ARM 设备支持

本项目专门为 ARM64 架构优化，支持：

- Apple Silicon Mac (M1/M2/M3)
- ARM 服务器 (AWS Graviton, 阿里云倚天等)
- Raspberry Pi 4 (64位系统)
- 其他 ARM64 Linux 设备

## 🔐 安全建议

1. **生产环境**：
   - 修改默认的 JWT 密钥
   - 使用 HTTPS
   - 配置防火墙规则

2. **数据保护**：
   - 定期备份数据库
   - 限制数据目录访问权限

3. **监控**：
   - 设置日志轮转
   - 监控容器资源使用情况
