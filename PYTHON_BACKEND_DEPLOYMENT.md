# 🐍 Python后端部署指南

## 📋 部署方案对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **Vercel Serverless** | 零配置、自动扩容、与前端集成 | 冷启动、依赖限制、执行时间限制 | 轻量级API、原型开发 |
| **Railway** | 支持完整Python、数据库集成 | 需要额外配置 | 中小型项目 |
| **Render** | 免费套餐、支持Docker | 冷启动问题 | 个人项目 |
| **DigitalOcean App** | 性价比高、稳定性好 | 需要付费 | 生产环境 |
| **Heroku** | 成熟稳定、插件丰富 | 价格较高 | 企业级应用 |

## 🚀 方案一：Vercel Serverless Functions

### 优势
- ✅ **零配置部署**：与前端在同一个项目中
- ✅ **自动扩容**：根据请求量自动扩展
- ✅ **全球CDN**：边缘计算，低延迟
- ✅ **成本效益**：按使用量付费

### 限制
- ⚠️ **执行时间**：最大10秒（Hobby）/ 60秒（Pro）
- ⚠️ **内存限制**：最大1GB
- ⚠️ **依赖大小**：压缩后最大50MB
- ⚠️ **冷启动**：首次请求可能较慢

### 实现方式

#### 1. 基础Python API
```python
# api/market-data.py
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 您的API逻辑
        pass
```

#### 2. 使用CCXT的高级API
```python
# api/crypto-data.py
import ccxt
import os

class handler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.exchange = ccxt.binance({
            'apiKey': os.getenv('BINANCE_API_KEY'),
            'secret': os.getenv('BINANCE_SECRET'),
        })
        super().__init__(*args, **kwargs)
```

#### 3. 环境变量配置

**选项A：无需API密钥（推荐开始）**
- 使用 `api/public-crypto-data.py`
- 无需配置任何API密钥
- 使用交易所公开API端点
- 适合演示和测试

**选项B：使用API密钥（生产环境）**
在Vercel控制台中配置：
- `BINANCE_API_KEY` (可选)
- `BINANCE_SECRET` (可选)
- `OKX_API_KEY` (可选)
- `OKX_SECRET` (可选)
- `OKX_PASSPHRASE` (可选)

## 🚀 方案二：Railway部署（推荐）

### 为什么选择Railway？
- ✅ **完整Python支持**：支持所有Python库
- ✅ **数据库集成**：内置PostgreSQL、Redis
- ✅ **简单部署**：Git推送即部署
- ✅ **合理价格**：$5/月起

### 部署步骤

#### 1. 准备Railway配置
```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

#### 2. 修改CORS配置
```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # 添加Vercel域名
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 3. 环境变量配置
```bash
# Railway环境变量
BINANCE_API_KEY=your_api_key
BINANCE_SECRET=your_secret
OKX_API_KEY=your_okx_key
OKX_SECRET=your_okx_secret
OKX_PASSPHRASE=your_passphrase
```

#### 4. 前端API配置
```bash
# .env.production
REACT_APP_API_BASE_URL=https://your-app.railway.app/api
```

## 🚀 方案三：Render部署

### 优势
- ✅ **免费套餐**：每月750小时免费
- ✅ **Docker支持**：完全控制运行环境
- ✅ **自动SSL**：免费HTTPS证书

### 部署配置

#### 1. 创建render.yaml
```yaml
# render.yaml
services:
  - type: web
    name: crypto-api
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: PYTHON_VERSION
        value: 3.10.0
```

#### 2. Dockerfile（可选）
```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE $PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]
```

## 🚀 方案四：DigitalOcean App Platform

### 优势
- ✅ **高性能**：专用资源，无冷启动
- ✅ **可扩展**：支持水平扩展
- ✅ **数据库**：托管数据库服务
- ✅ **监控**：内置监控和日志

### 部署配置

#### 1. 应用规格文件
```yaml
# .do/app.yaml
name: crypto-api
services:
- name: api
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: uvicorn main:app --host 0.0.0.0 --port $PORT
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: BINANCE_API_KEY
    scope: RUN_TIME
    type: SECRET
  - key: BINANCE_SECRET
    scope: RUN_TIME
    type: SECRET
```

## 🎯 推荐部署架构

### 开发/测试环境
```
前端: Vercel
后端: Vercel Serverless Functions (Python)
数据库: 模拟数据
```

### 生产环境
```
前端: Vercel
后端: Railway/DigitalOcean
数据库: PostgreSQL (托管)
缓存: Redis (托管)
监控: Sentry + 平台内置监控
```

## 🔧 迁移步骤

### 1. 立即可用（Vercel Serverless）
1. 使用我创建的Python API文件
2. 配置环境变量
3. 部署到Vercel

### 2. 生产就绪（Railway）
1. 在Railway创建项目
2. 连接GitHub仓库
3. 配置环境变量
4. 更新前端API地址

### 3. 企业级（DigitalOcean）
1. 创建DigitalOcean App
2. 配置应用规格
3. 设置数据库和缓存
4. 配置监控和告警

## 📊 成本对比

| 方案 | 免费额度 | 付费价格 | 适用规模 |
|------|----------|----------|----------|
| Vercel Serverless | 100GB-hours/月 | $20/月起 | 小型项目 |
| Railway | $5信用额度 | $5/月起 | 中小型项目 |
| Render | 750小时/月 | $7/月起 | 个人项目 |
| DigitalOcean | $200信用额度 | $12/月起 | 生产环境 |

## 🎯 最终推荐

### 快速原型 → Vercel Serverless
- 使用我创建的Python API文件
- 零配置，立即可用
- 适合演示和测试

### 生产部署 → Railway + Vercel
- 前端：Vercel（性能最佳）
- 后端：Railway（Python完整支持）
- 数据库：Railway PostgreSQL
- 总成本：~$5-10/月

这种架构既保持了Vercel前端的优势，又解决了Python后端的限制问题。
