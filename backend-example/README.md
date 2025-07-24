# 后端API服务

这是一个基于FastAPI和CCXT的加密货币合约数据API服务。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或者使用uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口

### 获取合约市场数据
```
GET /api/contracts/{symbol}/market
```

### 获取ATR数据
```
GET /api/contracts/{symbol}/atr
```

### 搜索合约
```
GET /api/contracts/search?q={query}
```

### 获取历史数据
```
GET /api/contracts/{symbol}/history?timeframe=1h&limit=100
```

### 健康检查
```
GET /api/health
```

## 支持的交易所

- Binance (永续合约)
- OKX (永续合约)
- Bybit (线性合约)

## 注意事项

1. 默认使用永续合约数据
2. 数据缓存30秒，避免频繁请求
3. 支持多交易所容错机制
4. 所有时间使用UTC时区
5. 价格数据保留原始精度

## 环境变量

可以通过环境变量配置：

```bash
export API_PORT=8000
export CACHE_DURATION=30
export LOG_LEVEL=INFO
```

## Docker部署

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

构建和运行：

```bash
docker build -t contract-api .
docker run -p 8000:8000 contract-api
```
