# 后端API接口规范

## 基础信息

- **基础URL**: `http://localhost:8000/api`
- **数据格式**: JSON
- **编码**: UTF-8

## 通用响应格式

```json
{
  "success": true,
  "data": {},
  "error": null,
  "message": "操作成功"
}
```

错误响应：
```json
{
  "success": false,
  "data": null,
  "error": "错误代码",
  "message": "错误描述"
}
```

## API接口列表

### 1. 获取合约市场数据

**接口**: `GET /contracts/{symbol}/market`

**参数**:
- `symbol`: 合约币种名称 (如: BTC, ETH, UXLINK)

**响应数据**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "price": 43250.50,
    "change24h": 2.45,
    "volume24h": 1234567890.12,
    "high24h": 44000.00,
    "low24h": 42500.00,
    "openInterest": 987654321.00,
    "fundingRate": 0.0001,
    "lastUpdated": "2024-01-15T10:30:00Z",
    "contractType": "perpetual",
    "exchange": "binance"
  }
}
```

### 2. 获取合约ATR数据

**接口**: `GET /contracts/{symbol}/atr`

**参数**:
- `symbol`: 合约币种名称

**响应数据**:
```json
{
  "success": true,
  "data": {
    "atr4h": 1250.75,
    "atr15m": 425.30,
    "atr1h": 850.60
  }
}
```

### 3. 搜索合约币种

**接口**: `GET /contracts/search`

**参数**:
- `q`: 搜索关键词

**响应数据**:
```json
{
  "success": true,
  "data": ["BTC", "ETH", "UXLINK", "SWARMS"]
}
```

### 4. 获取合约历史数据

**接口**: `GET /contracts/{symbol}/history`

**参数**:
- `symbol`: 合约币种名称
- `timeframe`: 时间周期 (1h, 4h, 15m, 1d)
- `limit`: 数据条数 (默认100)

**响应数据**:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1705320000000,
      "open": 43000.00,
      "high": 43500.00,
      "low": 42800.00,
      "close": 43250.00,
      "volume": 1234567.89
    }
  ]
}
```

## Python后端实现示例

### 依赖包

```bash
pip install fastapi uvicorn ccxt python-dotenv
```

### 基础结构

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import ccxt
import asyncio
from typing import List, Dict, Any

app = FastAPI(title="合约数据API", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 交易所配置
exchanges = {
    'binance': ccxt.binance({'options': {'defaultType': 'future'}}),
    'okx': ccxt.okx({'options': {'defaultType': 'swap'}}),
    'bybit': ccxt.bybit({'options': {'defaultType': 'linear'}})
}

@app.get("/api/contracts/{symbol}/market")
async def get_contract_market_data(symbol: str):
    # 实现获取合约市场数据的逻辑
    pass

@app.get("/api/contracts/{symbol}/atr")
async def get_contract_atr_data(symbol: str):
    # 实现获取ATR数据的逻辑
    pass

@app.get("/api/contracts/search")
async def search_contracts(q: str):
    # 实现搜索合约的逻辑
    pass

@app.get("/api/contracts/{symbol}/history")
async def get_contract_history(symbol: str, timeframe: str = "1h", limit: int = 100):
    # 实现获取历史数据的逻辑
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 错误处理

常见错误代码：
- `SYMBOL_NOT_FOUND`: 币种不存在
- `EXCHANGE_ERROR`: 交易所API错误
- `RATE_LIMIT`: 请求频率限制
- `NETWORK_ERROR`: 网络连接错误
- `INVALID_PARAMS`: 参数错误

## 注意事项

1. 所有价格数据保留6位小数
2. 时间戳使用毫秒级Unix时间戳
3. 百分比数据使用小数形式 (如: 2.45 表示 2.45%)
4. 建议实现请求缓存机制，避免频繁调用交易所API
5. 需要处理交易所API的限流和错误重试
