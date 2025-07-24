# API模式自动切换功能

本系统支持根据环境变量配置自动在公共API和私有API之间切换。

## 🌐 公共API模式（默认）

当没有配置API密钥时，系统使用公共API模式：

### 特点：
- ✅ **无需配置** - 开箱即用
- ✅ **基础功能完整** - 实时数据、历史数据、资金费率
- ✅ **免费使用** - 无需API密钥
- ⚠️ **频率限制** - 标准公共API限制
- ❌ **无账户信息** - 无法获取个人账户数据
- ❌ **无高频访问** - 受公共API频率限制

### 适用场景：
- 个人学习和研究
- 基础数据分析
- 策略回测
- 小规模使用

## 🔑 私有API模式（高级）

当配置了API密钥时，系统自动切换到私有API模式：

### 特点：
- ✅ **高频访问** - 更高的请求频率限制
- ✅ **完整功能** - 包含所有公共API功能
- ✅ **账户信息** - 可获取个人账户数据
- ✅ **更稳定** - 专用连接，更少限制
- ✅ **交易功能** - 支持下单等高级功能（如需要）
- ⚠️ **需要配置** - 需要交易所API密钥

### 适用场景：
- 生产环境部署
- 高频数据获取
- 专业交易应用
- 商业用途

## 🔧 配置方法

### 1. 公共API模式（默认）

无需任何配置，系统默认使用公共API。

### 2. 切换到私有API模式

在 `.env` 文件中添加以下配置：

```bash
# Binance API配置
BINANCE_API_KEY=your_actual_api_key_here
BINANCE_SECRET=your_actual_secret_here
```

### 3. 获取Binance API密钥

1. 登录 [Binance](https://www.binance.com)
2. 进入 **API管理** 页面
3. 创建新的API密钥
4. **重要**：只需要 **读取** 权限，无需交易权限
5. 复制API Key和Secret到 `.env` 文件

## 🚀 自动切换机制

系统启动时会自动检测：

```python
# 检查环境变量
api_key = os.getenv('BINANCE_API_KEY')
secret = os.getenv('BINANCE_SECRET')

if api_key and secret:
    # 自动切换到私有API模式
    use_private_api = True
    logger.info("🔑 使用私有API模式 - 高频率访问，完整功能")
else:
    # 使用公共API模式
    use_private_api = False
    logger.info("🌐 使用公共API模式 - 基础功能，无需配置")
```

## 📊 功能对比

| 功能 | 公共API | 私有API |
|------|---------|---------|
| 实时价格数据 | ✅ | ✅ |
| 历史K线数据 | ✅ | ✅ |
| 资金费率 | ✅ | ✅ |
| 技术指标计算 | ✅ | ✅ |
| 高频访问 | ❌ | ✅ |
| 账户信息 | ❌ | ✅ |
| 请求频率 | 1200/min | 1200/min+ |
| 稳定性 | 标准 | 更高 |
| 配置复杂度 | 无 | 简单 |

## 🔍 状态检查

### 前端显示

系统会在前端显示当前API模式：

- **公共API** - 蓝色标识，基础功能
- **私有API** - 绿色标识，高级功能

### 后端日志

启动时会显示当前模式：

```
INFO: 🌐 使用公共API模式 - 基础功能，无需配置
INFO: 💡 提示：在.env文件中配置BINANCE_API_KEY和BINANCE_SECRET可启用私有API模式
```

或

```
INFO: 🔑 使用私有API模式 - 高频率访问，完整功能
INFO: ✅ API密钥已配置
```

### API端点检查

访问 `/api/health` 可查看当前API状态：

```json
{
  "success": true,
  "data": {
    "api_mode": "public",  // 或 "private"
    "api_keys_configured": false,  // 或 true
    "features": {
      "high_frequency": false,  // 私有API为true
      "account_info": false     // 私有API为true
    }
  }
}
```

## ⚠️ 安全注意事项

1. **API密钥安全**：
   - 永远不要将API密钥提交到代码仓库
   - 使用 `.env` 文件存储敏感信息
   - 定期轮换API密钥

2. **权限设置**：
   - 只授予必要的权限（通常只需读取权限）
   - 不要授予交易权限（除非确实需要）
   - 设置IP白名单（如果可能）

3. **监控使用**：
   - 监控API使用情况
   - 注意频率限制
   - 及时发现异常访问

## 🔄 动态切换

要在运行时切换API模式：

1. 修改 `.env` 文件
2. 重启后端服务
3. 系统会自动检测并切换模式

```bash
# 重启后端
cd backend-example
./venv/Scripts/Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 📈 性能优化建议

### 公共API模式
- 合理使用缓存
- 避免频繁请求
- 批量获取数据

### 私有API模式
- 充分利用高频访问
- 实现更精细的数据更新
- 考虑WebSocket连接（如需要）
