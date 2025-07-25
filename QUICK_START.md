# 🚀 快速开始指南

## 立即部署（推荐）

### 方法1：智能部署脚本（最简单）

```bash
# 1. 克隆项目
git clone https://github.com/Linon419/xielin.git
cd xielin

# 2. 运行智能部署脚本
chmod +x deploy-smart.sh
./deploy-smart.sh
```

脚本会自动：
- ✅ 检查Docker环境
- ✅ 创建.env配置文件
- ✅ 自动选择最佳部署方式（远程镜像 or 本地构建）
- ✅ 启动服务并验证健康状态

### 方法2：手动部署

如果智能脚本不可用，可以手动选择：

#### 选项A：使用远程镜像（更快）
```bash
# 检查镜像是否可用
docker pull ghcr.io/linon419/xielin:latest

# 如果成功，使用远程镜像
docker-compose -f docker-compose.remote.yml up -d
```

#### 选项B：本地构建（总是可用）
```bash
# 本地构建部署
docker-compose -f docker-compose.local.yml up -d --build
```

## 📋 基础配置

### 1. 环境变量设置

编辑 `.env` 文件：

```env
# 必需配置
JWT_SECRET_KEY=your-secure-secret-key-here

# 可选配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# CCXT私有API（可选，用于高频访问）
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
```

### 2. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 测试健康检查
curl http://localhost/api/health

# 查看日志
docker-compose logs -f
```

## 🌐 访问应用

部署成功后，访问：

- **前端界面**: http://localhost
- **API文档**: http://localhost/docs  
- **健康检查**: http://localhost/api/health

## 🛠️ 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新服务
docker-compose pull && docker-compose up -d
```

## 🔧 故障排除

### 问题1：端口被占用
```bash
# 修改端口（编辑docker-compose.yml）
ports:
  - "8080:80"  # 改为8080端口
```

### 问题2：镜像拉取失败
```bash
# 使用本地构建
docker-compose -f docker-compose.local.yml up -d --build
```

### 问题3：服务启动失败
```bash
# 查看详细日志
docker-compose logs xielin

# 检查配置
docker-compose config
```

## 📚 进阶配置

### CCXT私有API配置

详细配置请参考：[CCXT_PRIVATE_API_GUIDE.md](CCXT_PRIVATE_API_GUIDE.md)

### Docker部署详细指南

完整部署指南请参考：[DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)

## 🎯 功能特性

- ✅ **实时数据**：支持多个交易所的实时价格数据
- ✅ **用户系统**：完整的用户注册、登录、订阅管理
- ✅ **WebSocket**：实时数据推送
- ✅ **私有API**：支持Binance、OKX、Bybit私有API
- ✅ **Telegram集成**：消息通知功能
- ✅ **缓存系统**：高效的数据缓存
- ✅ **健康监控**：完整的服务健康检查

## 🆘 获取帮助

如果遇到问题：

1. 查看日志：`docker-compose logs -f`
2. 检查健康状态：`curl http://localhost/api/health`
3. 参考详细文档：`DOCKER_DEPLOYMENT_GUIDE.md`
4. 检查GitHub Issues

---

🎉 **恭喜！您的加密货币策略平台已经准备就绪！**
