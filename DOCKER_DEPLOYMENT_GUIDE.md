# Docker部署指南

## 🚀 快速部署

### 1. 准备环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，配置必要的参数
nano .env
```

### 2. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 访问应用

- **前端界面**: http://localhost
- **API文档**: http://localhost/docs
- **健康检查**: http://localhost/api/health

## 📋 环境变量配置

### 必需配置

```env
# JWT密钥（生产环境请更改）
JWT_SECRET_KEY=your-secret-key-for-production

# Telegram Bot Token（可选）
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### CCXT私有API配置（可选）

```env
# 币安
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret

# OKX
OKEX_API_KEY=your_okx_api_key
OKEX_SECRET=your_okx_secret
OKEX_PASSPHRASE=your_okx_passphrase

# Bybit
BYBIT_API_KEY=your_bybit_api_key
BYBIT_SECRET=your_bybit_secret
```

## 🔧 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps

# 查看资源使用
docker-compose top
```

### 日志查看

```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs xielin

# 查看最近100行日志
docker-compose logs --tail=100
```

### 数据管理

```bash
# 查看数据卷
docker volume ls

# 备份数据
docker run --rm -v xielin_xielin-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data

# 恢复数据
docker run --rm -v xielin_xielin-data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /
```

## 🛠️ 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 检查端口使用
   netstat -tlnp | grep :80
   
   # 修改docker-compose.yml中的端口映射
   ports:
     - "8080:80"  # 改为8080端口
   ```

2. **容器启动失败**
   ```bash
   # 查看详细错误
   docker-compose logs xielin
   
   # 检查配置
   docker-compose config
   ```

3. **健康检查失败**
   ```bash
   # 手动测试健康检查
   curl http://localhost/health
   curl http://localhost/api/health
   ```

### 调试命令

```bash
# 进入容器
docker-compose exec xielin bash

# 检查进程
docker-compose exec xielin ps aux

# 检查网络
docker-compose exec xielin netstat -tlnp

# 检查环境变量
docker-compose exec xielin env
```

## 🔒 生产环境部署

### 安全配置

1. **更改默认密钥**
   ```env
   JWT_SECRET_KEY=your-very-secure-random-key-here
   ```

2. **使用HTTPS**
   - 配置反向代理（Nginx/Traefik）
   - 申请SSL证书

3. **限制访问**
   - 配置防火墙
   - 使用VPN或内网访问

### 性能优化

1. **资源限制**
   ```yaml
   services:
     xielin:
       deploy:
         resources:
           limits:
             memory: 1G
             cpus: '0.5'
   ```

2. **日志轮转**
   ```yaml
   services:
     xielin:
       logging:
         driver: "json-file"
         options:
           max-size: "10m"
           max-file: "3"
   ```

## 📊 监控

### 健康检查

```bash
# 检查容器健康状态
docker-compose ps

# 详细健康信息
curl http://localhost/api/health | jq
```

### 性能监控

```bash
# 查看资源使用
docker stats xielin-app

# 查看系统信息
docker-compose exec xielin df -h
docker-compose exec xielin free -h
```

## 🔄 更新部署

### 更新应用

```bash
# 拉取最新镜像
docker-compose pull

# 重新创建容器
docker-compose up -d --force-recreate

# 清理旧镜像
docker image prune
```

### 回滚版本

```bash
# 使用特定版本
docker-compose down
# 修改docker-compose.yml中的镜像标签
docker-compose up -d
```

## 📞 支持

如果遇到问题：

1. 检查日志：`docker-compose logs -f`
2. 验证配置：`docker-compose config`
3. 测试连接：`curl http://localhost/api/health`
4. 查看资源：`docker stats`

部署成功后，您将拥有一个完整的加密货币策略平台！🎉
