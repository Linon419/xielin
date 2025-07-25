# CCXT私有API配置指南

## 🚀 概述

您的加密货币策略平台现在支持多个交易所的CCXT私有API，可以获得更高的访问频率和完整功能。

## 📋 支持的交易所

| 交易所 | 环境变量 | 说明 |
|--------|----------|------|
| **币安 (Binance)** | `BINANCE_API_KEY`<br>`BINANCE_SECRET` | 全球最大交易所 |
| **OKX** | `OKEX_API_KEY`<br>`OKEX_SECRET`<br>`OKEX_PASSPHRASE` | 需要三个参数 |
| **Bybit** | `BYBIT_API_KEY`<br>`BYBIT_SECRET` | 衍生品交易所 |

## ⚙️ 配置方法

### 1. 创建 `.env` 文件

```bash
# 复制示例文件
cp .env.example .env
```

### 2. 配置API密钥

编辑 `.env` 文件，添加您的API密钥：

```env
# 币安 (Binance)
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET=your_binance_secret_here

# OKX (原OKEx)
OKEX_API_KEY=your_okx_api_key_here
OKEX_SECRET=your_okx_secret_here
OKEX_PASSPHRASE=your_okx_passphrase_here

# Bybit
BYBIT_API_KEY=your_bybit_api_key_here
BYBIT_SECRET=your_bybit_secret_here
```

### 3. 重启Docker容器

```bash
docker-compose down
docker-compose up -d
```

## 🔑 获取API密钥

### 币安 (Binance)
1. 登录 [Binance](https://www.binance.com)
2. 进入 API管理 → 创建API
3. 设置权限：**只需要"读取"权限**
4. 复制 API Key 和 Secret Key

### OKX
1. 登录 [OKX](https://www.okx.com)
2. 进入 API → 创建API密钥
3. 设置权限：**只需要"读取"权限**
4. 复制 API Key、Secret Key 和 Passphrase

### Bybit
1. 登录 [Bybit](https://www.bybit.com)
2. 进入 API管理 → 创建API密钥
3. 设置权限：**只需要"读取"权限**
4. 复制 API Key 和 Secret Key

## 🛡️ 安全建议

⚠️ **重要安全提示**：

1. **只设置读取权限**：不要给API密钥交易权限
2. **IP白名单**：在交易所设置IP白名单限制
3. **定期更换**：定期更换API密钥
4. **不要分享**：永远不要分享您的API密钥
5. **环境隔离**：生产和测试使用不同的API密钥

## 📊 私有API优势

| 功能 | 公共API | 私有API |
|------|---------|---------|
| **访问频率** | 1200/分钟 | 6000/分钟 |
| **数据稳定性** | 一般 | 优秀 |
| **账户信息** | ❌ | ✅ |
| **实时余额** | ❌ | ✅ |
| **交易历史** | ❌ | ✅ |
| **高频访问** | ❌ | ✅ |

## 🔍 验证配置

### 1. 检查健康状态

访问：`http://your-server/api/health`

成功配置后会显示：
```json
{
  "success": true,
  "data": {
    "private_api_exchanges": ["binance", "okx", "bybit"],
    "api_mode": "mixed",
    "exchange_status": {
      "binance": {"api_mode": "private", "configured": true},
      "okx": {"api_mode": "private", "configured": true},
      "bybit": {"api_mode": "private", "configured": true}
    }
  }
}
```

### 2. 查看Docker日志

```bash
docker logs xielin-app
```

成功配置会显示：
```
🔑 私有API模式 - 已配置3个交易所: binance, okx, bybit
✅ 享受高频率访问和完整功能
```

## 🚨 故障排除

### 常见问题

1. **API密钥无效**
   - 检查密钥是否正确复制
   - 确认API密钥未过期
   - 验证权限设置

2. **连接失败**
   - 检查网络连接
   - 验证IP白名单设置
   - 确认交易所API服务正常

3. **权限错误**
   - 确保API密钥有读取权限
   - 检查是否设置了不必要的限制

### 调试命令

```bash
# 查看容器日志
docker logs xielin-app -f

# 进入容器调试
docker exec -it xielin-app bash

# 检查环境变量
docker exec xielin-app env | grep -E "(BINANCE|OKEX|BYBIT)"
```

## 🎯 最佳实践

1. **渐进配置**：先配置一个交易所，确认工作后再添加其他
2. **监控使用**：定期检查API使用情况和限制
3. **备份配置**：保存API配置的备份（安全存储）
4. **测试环境**：在测试环境先验证配置

## 📞 支持

如果遇到问题，请检查：
1. Docker容器日志
2. API健康检查端点
3. 交易所API文档
4. 网络连接状态

配置完成后，您将享受到更快、更稳定的数据访问体验！🚀
