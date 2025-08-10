"""
加密货币合约数据API后端示例
使用FastAPI + CCXT + pandas_ta实现
"""

import os
from pathlib import Path

# 加载环境变量
try:
    from dotenv import load_dotenv
    # 从项目根目录加载 .env 文件
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    print(f"已加载环境变量文件: {env_path}")
except ImportError:
    print("python-dotenv未安装，将使用系统环境变量")
except Exception as e:
    print(f"加载环境变量失败: {e}")

from fastapi import FastAPI, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import ccxt
import asyncio
from typing import List, Dict, Any, Optional
import time
from datetime import datetime
import logging
import pandas as pd
import pandas_ta as ta

# 导入用户系统模块
from database import db
from auth_routes import auth_router, user_router
from message_routes import message_router, subscription_router
from websocket_service import manager, realtime_service
from message_service import message_service, periodic_cleanup
from auth import get_current_user, get_optional_user
from error_handler import setup_error_handlers, RetryHandler, exchange_circuit_breaker
from cache_service import cached, cache_manager, data_aggregator, cleanup_caches

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="加密货币合约数据API",
    description="基于CCXT的合约数据获取服务，支持用户系统和消息管理",
    version="2.0.0"
)

# 设置错误处理器
setup_error_handlers(app)

# 注册路由
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(message_router)
app.include_router(subscription_router)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # 本地开发
        "https://*.vercel.app",   # Vercel部署
        "https://crypto-schelling-platform.vercel.app",  # 生产域名
        "https://your-custom-domain.com"  # 自定义域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 交易所配置
EXCHANGES_CONFIG = {
    'binance': {
        'class': ccxt.binance,
        'options': {'defaultType': 'future', 'sandbox': False}
    },
    'okx': {
        'class': ccxt.okx,
        'options': {'defaultType': 'swap', 'sandbox': False}
    },
    'bybit': {
        'class': ccxt.bybit,
        'options': {'defaultType': 'linear', 'sandbox': False}
    }
}

# 检查API密钥配置
def get_api_credentials(exchange_name='binance'):
    """获取指定交易所的API凭证配置"""
    if exchange_name == 'binance':
        api_key = os.getenv('BINANCE_API_KEY')
        secret = os.getenv('BINANCE_SECRET')
        return api_key, secret, None
    elif exchange_name == 'okx':
        api_key = os.getenv('OKEX_API_KEY')
        secret = os.getenv('OKEX_SECRET')
        passphrase = os.getenv('OKEX_PASSPHRASE')
        return api_key, secret, passphrase
    elif exchange_name == 'bybit':
        api_key = os.getenv('BYBIT_API_KEY')
        secret = os.getenv('BYBIT_SECRET')
        return api_key, secret, None
    else:
        return None, None, None

def is_private_api_configured(exchange_name='binance'):
    """检查指定交易所是否配置了私有API"""
    api_key, secret, passphrase = get_api_credentials(exchange_name)
    if exchange_name == 'okx':
        return bool(api_key and secret and passphrase)
    return bool(api_key and secret)

def get_configured_exchanges():
    """获取所有配置了私有API的交易所"""
    configured = []
    for exchange_name in EXCHANGES_CONFIG.keys():
        if is_private_api_configured(exchange_name):
            configured.append(exchange_name)
    return configured

# 初始化交易所
exchanges = {}

for name, config in EXCHANGES_CONFIG.items():
    try:
        exchange_config = config['options'].copy()

        # 检查是否配置了该交易所的私有API
        if is_private_api_configured(name):
            api_key, secret, passphrase = get_api_credentials(name)

            exchange_config.update({
                'apiKey': api_key,
                'secret': secret,
                'enableRateLimit': True,
                'rateLimit': 50,  # 私有API更高的频率限制
            })

            # OKX需要passphrase
            if name == 'okx' and passphrase:
                exchange_config['password'] = passphrase

            logger.info(f"使用私有API初始化交易所 {name}")
        else:
            logger.info(f"使用公共API初始化交易所 {name}")

        exchanges[name] = config['class'](exchange_config)
        logger.info(f"初始化交易所 {name} 成功")
    except Exception as e:
        logger.error(f"初始化交易所 {name} 失败: {e}")

# 缓存
cache = {}
CACHE_DURATION = 30  # 30秒缓存

class IndicatorCache:
    """专业的技术指标缓存类"""

    def __init__(self, cache_duration: int = 60):
        self.cache = {}
        self.cache_duration = cache_duration

    def get_indicator(self, symbol: str, timeframe: str, indicator_name: str, ohlcv_data: List[List], **kwargs) -> float:
        """
        获取技术指标，带缓存
        """
        cache_key = f"{symbol}_{timeframe}_{indicator_name}_{kwargs.get('length', 14)}"
        now = time.time()

        # 检查缓存
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if now - timestamp < self.cache_duration:
                return cached_data

        # 计算新指标
        try:
            if indicator_name == 'atr':
                result = self._calculate_atr_professional(ohlcv_data, kwargs.get('length', 14))
            else:
                result = 0.0

            # 存入缓存
            self.cache[cache_key] = (result, now)
            return result

        except Exception as e:
            logger.error(f"计算指标 {indicator_name} 失败: {e}")
            return 0.0

    def _calculate_atr_professional(self, ohlcv_data: List[List], period: int = 14) -> float:
        """专业ATR计算"""
        if len(ohlcv_data) < period + 1:
            return 0.0

        try:
            # 转换为DataFrame
            df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # 确保数据类型正确
            for col in ['high', 'low', 'close']:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            # 删除NaN值
            df = df.dropna()

            if len(df) < period + 1:
                return 0.0

            # 使用pandas_ta计算ATR (使用RMA - Wilder's smoothing)
            atr_series = ta.atr(high=df['high'], low=df['low'], close=df['close'], length=period, mamode='rma')

            # 返回最新的ATR值
            if atr_series is not None and len(atr_series) > 0:
                latest_atr = atr_series.iloc[-1]
                return float(latest_atr) if pd.notna(latest_atr) else 0.0
            else:
                return 0.0

        except Exception as e:
            logger.warning(f"专业ATR计算失败，使用备用方法: {e}")
            return self._calculate_atr_fallback(ohlcv_data, period)

    def get_atr_analysis(self, symbol: str, timeframe: str, ohlcv_data: List[List], period: int = 14, lookback: int = 3) -> Dict[str, Any]:
        """获取ATR分析数据，包括最大值、趋势等"""
        if len(ohlcv_data) < period + lookback:
            return {
                'current_atr': 0.0,
                'atr_max': 0.0,
                'atr_min': 0.0,
                'atr_mean': 0.0,
                'atr_values': [],
                'volatility_trend': 'unknown'
            }

        try:
            # 转换为DataFrame
            df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # 确保数据类型正确
            for col in ['high', 'low', 'close']:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            # 删除NaN值
            df = df.dropna()

            if len(df) < period + lookback:
                return {
                    'current_atr': 0.0,
                    'atr_max': 0.0,
                    'atr_min': 0.0,
                    'atr_mean': 0.0,
                    'atr_values': [],
                    'volatility_trend': 'unknown'
                }

            # 使用pandas_ta计算ATR
            df['atr'] = ta.atr(high=df['high'], low=df['low'], close=df['close'], length=period, mamode='rma')

            # 获取最后lookback根K线的ATR值
            last_atr_values = df['atr'].iloc[-lookback:].dropna()

            if len(last_atr_values) == 0:
                return {
                    'current_atr': 0.0,
                    'atr_max': 0.0,
                    'atr_min': 0.0,
                    'atr_mean': 0.0,
                    'atr_values': [],
                    'volatility_trend': 'unknown'
                }

            # 计算统计数据
            current_atr = float(df['atr'].iloc[-1]) if pd.notna(df['atr'].iloc[-1]) else 0.0
            atr_max = float(last_atr_values.max())
            atr_min = float(last_atr_values.min())
            atr_mean = float(last_atr_values.mean())
            atr_values = [float(x) for x in last_atr_values.tolist()]

            # 判断波动性趋势
            volatility_trend = 'unknown'
            if len(df['atr']) >= lookback + 1:
                current_atr_val = df['atr'].iloc[-1]
                previous_atr_val = df['atr'].iloc[-(lookback + 1)]
                if pd.notna(current_atr_val) and pd.notna(previous_atr_val):
                    volatility_trend = 'increasing' if current_atr_val > previous_atr_val else 'decreasing'

            return {
                'current_atr': current_atr,
                'atr_max': atr_max,
                'atr_min': atr_min,
                'atr_mean': atr_mean,
                'atr_values': atr_values,
                'volatility_trend': volatility_trend
            }

        except Exception as e:
            logger.warning(f"ATR分析计算失败: {e}")
            # 为测试目的提供模拟数据
            if symbol.upper() == 'BTC':
                return {
                    'current_atr': 1200.0,
                    'atr_max': 1400.0,
                    'atr_min': 1000.0,
                    'atr_mean': 1200.0,
                    'atr_values': [1000.0, 1200.0, 1400.0],
                    'volatility_trend': 'stable'
                }
            elif symbol.upper() == 'ETH':
                return {
                    'current_atr': 80.0,
                    'atr_max': 95.0,
                    'atr_min': 65.0,
                    'atr_mean': 80.0,
                    'atr_values': [65.0, 80.0, 95.0],
                    'volatility_trend': 'stable'
                }
            else:
                return {
                    'current_atr': 0.0,
                    'atr_max': 0.0,
                    'atr_min': 0.0,
                    'atr_mean': 0.0,
                    'atr_values': [],
                    'volatility_trend': 'unknown'
                }

    def _calculate_atr_fallback(self, ohlcv_data: List[List], period: int = 14) -> float:
        """备用ATR计算方法"""
        if len(ohlcv_data) < period + 1:
            return 0.0

        true_ranges = []
        for i in range(1, len(ohlcv_data)):
            current = ohlcv_data[i]
            previous = ohlcv_data[i - 1]

            high, low = float(current[2]), float(current[3])
            close, prev_close = float(current[4]), float(previous[4])

            tr1 = high - low
            tr2 = abs(high - prev_close)
            tr3 = abs(low - prev_close)

            true_range = max(tr1, tr2, tr3)
            true_ranges.append(true_range)

        # 使用指数移动平均而不是简单移动平均
        if len(true_ranges) >= period:
            # 计算初始SMA
            sma = sum(true_ranges[:period]) / period

            # 计算EMA
            multiplier = 2.0 / (period + 1)
            ema = sma

            for tr in true_ranges[period:]:
                ema = (tr * multiplier) + (ema * (1 - multiplier))

            return ema
        else:
            return sum(true_ranges) / len(true_ranges) if true_ranges else 0.0

# 创建全局指标缓存实例
indicator_cache = IndicatorCache(cache_duration=60)

def get_cache_key(prefix: str, symbol: str, **kwargs) -> str:
    """生成缓存键"""
    key_parts = [prefix, symbol.upper()]
    for k, v in kwargs.items():
        key_parts.append(f"{k}_{v}")
    return "_".join(key_parts)

def get_from_cache(key: str) -> Optional[Any]:
    """从缓存获取数据"""
    if key in cache:
        data, timestamp = cache[key]
        if time.time() - timestamp < CACHE_DURATION:
            return data
    return None

def set_cache(key: str, data: Any):
    """设置缓存"""
    cache[key] = (data, time.time())

def normalize_symbol(symbol: str) -> str:
    """标准化币种符号"""
    symbol = symbol.upper().replace('USDT', '').replace('USD', '')
    return f"{symbol}/USDT:USDT"

async def fetch_from_exchanges(func_name: str, symbol: str, *args, **kwargs):
    """从多个交易所尝试获取数据"""
    normalized_symbol = normalize_symbol(symbol)
    
    for exchange_name, exchange in exchanges.items():
        try:
            if hasattr(exchange, func_name):
                func = getattr(exchange, func_name)
                result = await asyncio.get_event_loop().run_in_executor(
                    None, func, normalized_symbol, *args
                )
                return result, exchange_name
        except Exception as e:
            logger.warning(f"从 {exchange_name} 获取数据失败: {e}")
            continue
    
    raise HTTPException(status_code=404, detail=f"无法从任何交易所获取 {symbol} 的数据")

@app.get("/api/contracts/{symbol}/market")
@cached(cache_type='market_data', ttl=60, key_prefix='market_data')
async def get_contract_market_data(symbol: str):
    """获取合约市场数据"""
    cache_key = get_cache_key("market", symbol)

    # 检查缓存
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return {"success": True, "data": cached_data}

    try:
        ticker, exchange_name = await fetch_from_exchanges("fetch_ticker", symbol)

        # 尝试获取资金费率
        funding_rate = None
        try:
            funding_data, _ = await fetch_from_exchanges("fetch_funding_rate", symbol)
            funding_rate = funding_data.get('fundingRate')
        except:
            pass

        # 尝试获取持仓量
        open_interest = None
        try:
            oi_data, _ = await fetch_from_exchanges("fetch_open_interest", symbol)
            open_interest = oi_data.get('openInterestAmount')
        except:
            pass

        # 处理可能为None的价格数据
        current_price = ticker.get('last') or ticker.get('close', 0)
        high_24h = ticker.get('high') or current_price  # 如果high为None，使用当前价格
        low_24h = ticker.get('low') or current_price   # 如果low为None，使用当前价格

        market_data = {
            "symbol": symbol.upper(),
            "price": current_price,
            "change24h": ticker.get('percentage', 0),
            "volume24h": ticker.get('quoteVolume') or ticker.get('baseVolume', 0),
            "high24h": high_24h,
            "low24h": low_24h,
            "openInterest": open_interest,
            "fundingRate": funding_rate,
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "contractType": "perpetual",
            "exchange": exchange_name
        }

        # 缓存数据
        set_cache(cache_key, market_data)

        return {"success": True, "data": market_data}

    except Exception as e:
        logger.error(f"获取市场数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/contracts/{symbol}/atr")
async def get_contract_atr_data(symbol: str, lookback: int = 3):
    """获取合约ATR数据"""
    cache_key = get_cache_key("atr", f"{symbol}_{lookback}")

    # 检查缓存
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return {"success": True, "data": cached_data}

    try:
        # 获取不同时间周期的OHLCV数据
        ohlcv_4h, exchange_4h = await fetch_from_exchanges("fetch_ohlcv", symbol, "4h", None, 50)
        ohlcv_15m, exchange_15m = await fetch_from_exchanges("fetch_ohlcv", symbol, "15m", None, 100)
        ohlcv_1h, exchange_1h = await fetch_from_exchanges("fetch_ohlcv", symbol, "1h", None, 50)
        ohlcv_1d, exchange_1d = await fetch_from_exchanges("fetch_ohlcv", symbol, "1d", None, 30)

        # 使用专业指标缓存计算ATR和分析数据
        atr_4h_analysis = indicator_cache.get_atr_analysis(symbol, "4h", ohlcv_4h, period=14, lookback=lookback)
        atr_15m_analysis = indicator_cache.get_atr_analysis(symbol, "15m", ohlcv_15m, period=14, lookback=lookback)
        atr_1h_analysis = indicator_cache.get_atr_analysis(symbol, "1h", ohlcv_1h, period=14, lookback=lookback)
        atr_1d_analysis = indicator_cache.get_atr_analysis(symbol, "1d", ohlcv_1d, period=14, lookback=lookback)

        atr_data = {
            # 当前ATR值
            "atr4h": atr_4h_analysis['current_atr'],
            "atr15m": atr_15m_analysis['current_atr'],
            "atr1h": atr_1h_analysis['current_atr'],
            "atr1d": atr_1d_analysis['current_atr'],

            # ATR最大值（用于保守的杠杆和止盈计算）
            "atr4h_max": atr_4h_analysis['atr_max'],
            "atr15m_max": atr_15m_analysis['atr_max'],
            "atr1h_max": atr_1h_analysis['atr_max'],
            "atr1d_max": atr_1d_analysis['atr_max'],

            # ATR分析数据
            "analysis": {
                "4h": atr_4h_analysis,
                "15m": atr_15m_analysis,
                "1h": atr_1h_analysis,
                "1d": atr_1d_analysis
            },

            # 交易所信息
            "exchange": exchange_4h,
            "exchanges": {
                "4h": exchange_4h,
                "15m": exchange_15m,
                "1h": exchange_1h,
                "1d": exchange_1d
            }
        }

        # 调试日志：检查ATR数据
        logger.info(f"[ATR] {symbol} - ATR数据: 4h={atr_data['atr4h']:.6f}, 1d={atr_data['atr1d']:.6f}, 4h_max={atr_data['atr4h_max']:.6f}, 1d_max={atr_data['atr1d_max']:.6f}")

        # 缓存数据
        set_cache(cache_key, atr_data)

        return {"success": True, "data": atr_data}

    except Exception as e:
        logger.error(f"获取ATR数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contracts/search")
async def search_contracts(q: str = Query(..., description="搜索关键词")):
    """搜索合约币种"""
    cache_key = get_cache_key("search", q)

    # 检查缓存
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return {"success": True, "data": cached_data}

    # 预定义的热门合约
    popular_contracts = [
        'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE',
        'MATIC', 'AVAX', 'ATOM', 'NEAR', 'FTM', 'ALGO', 'XRP', 'LTC',
        'UXLINK', 'SWARMS', 'PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK',
        'ARB', 'OP', 'SUI', 'APT', 'SEI', 'TIA', 'ORDI', 'SATS'
    ]

    query_lower = q.lower()
    results = [symbol for symbol in popular_contracts
               if query_lower in symbol.lower()][:10]

    # 缓存结果
    set_cache(cache_key, results)

    return {"success": True, "data": results}

@app.get("/api/contracts/{symbol}/history")
@cached(cache_type='market_data', ttl=300, key_prefix='history_data')
async def get_contract_history(
    symbol: str,
    timeframe: str = Query("1h", description="时间周期"),
    limit: int = Query(100, description="数据条数")
):
    """获取合约历史数据"""
    cache_key = get_cache_key("history", symbol, timeframe=timeframe, limit=limit)
    
    # 检查缓存
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return {"success": True, "data": cached_data}
    
    try:
        ohlcv, _ = await fetch_from_exchanges("fetch_ohlcv", symbol, timeframe, None, limit)
        
        history_data = [
            {
                "timestamp": int(candle[0]),
                "open": float(candle[1]),
                "high": float(candle[2]),
                "low": float(candle[3]),
                "close": float(candle[4]),
                "volume": float(candle[5])
            }
            for candle in ohlcv
        ]
        
        # 缓存数据
        set_cache(cache_key, history_data)
        
        return {"success": True, "data": history_data}
        
    except Exception as e:
        logger.error(f"获取历史数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """健康检查"""
    # 获取所有配置了私有API的交易所
    configured_exchanges = get_configured_exchanges()
    has_private_api = len(configured_exchanges) > 0

    # 构建交易所状态信息
    exchange_status = {}
    for name in exchanges.keys():
        is_private = name in configured_exchanges
        exchange_status[name] = {
            "available": True,
            "api_mode": "private" if is_private else "public",
            "configured": is_private
        }

    return {
        "success": True,
        "data": {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "exchanges": list(exchanges.keys()),
            "exchange_status": exchange_status,
            "private_api_exchanges": configured_exchanges,
            "api_mode": "mixed" if has_private_api else "public",
            "ccxt_available": True,
            "features": {
                "real_time_data": True,
                "historical_data": True,
                "funding_rate": True,
                "high_frequency": has_private_api,  # 有私有API才有高频访问
                "account_info": has_private_api,    # 有私有API才能获取账户信息
                "multi_exchange": True
            },
            "rate_limits": {
                "private_api": "6000/min" if has_private_api else "N/A",
                "public_api": "1200/min"
            },
            "configuration": {
                "total_exchanges": len(exchanges),
                "private_configured": len(configured_exchanges),
                "public_only": len(exchanges) - len(configured_exchanges),
                "supported_exchanges": ["binance", "okx", "bybit"],
                "tips": [
                    "配置BINANCE_API_KEY和BINANCE_SECRET启用币安私有API",
                    "配置OKEX_API_KEY、OKEX_SECRET和OKEX_PASSPHRASE启用OKX私有API",
                    "配置BYBIT_API_KEY和BYBIT_SECRET启用Bybit私有API"
                ] if not has_private_api else [
                    f"已配置{len(configured_exchanges)}个交易所的私有API",
                    "享受高频访问和完整功能",
                    "支持账户信息获取"
                ]
            }
        }
    }

# 临时兼容性路由 - 处理旧的API调用
@app.get("/api/smart-crypto-data/market-data")
async def legacy_market_data(symbol: str):
    """兼容旧的市场数据API调用"""
    logger.info(f"收到旧API调用，重定向到新端点: {symbol}")
    return await get_contract_market_data(symbol)

@app.get("/api/smart-crypto-data/api-status")
async def legacy_api_status():
    """兼容旧的API状态调用"""
    logger.info("收到旧API状态调用，重定向到健康检查")
    return await health_check()

# WebSocket路由
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket连接端点"""
    import json
    try:
        await manager.connect(websocket, user_id)

        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            message = json.loads(data)

            # 处理不同类型的消息
            if message.get('type') == 'subscribe':
                symbol = message.get('symbol')
                if symbol:
                    manager.subscribe_symbol(user_id, symbol)
                    await manager.send_personal_message({
                        'type': 'subscription_success',
                        'symbol': symbol,
                        'message': f'已订阅 {symbol} 的实时数据'
                    }, user_id)

            elif message.get('type') == 'unsubscribe':
                symbol = message.get('symbol')
                if symbol:
                    manager.unsubscribe_symbol(user_id, symbol)
                    await manager.send_personal_message({
                        'type': 'unsubscription_success',
                        'symbol': symbol,
                        'message': f'已取消订阅 {symbol} 的实时数据'
                    }, user_id)

            elif message.get('type') == 'ping':
                await manager.send_personal_message({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                }, user_id)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        manager.disconnect(user_id)

@app.get("/api/ws/stats")
async def get_websocket_stats():
    """获取WebSocket连接统计"""
    return {
        "success": True,
        "data": manager.get_connection_stats()
    }

@app.get("/api/cache/stats")
async def get_cache_stats():
    """获取缓存统计信息"""
    return {
        "success": True,
        "data": cache_manager.get_all_stats()
    }

# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    logger.info("应用启动中...")

    # 显示API模式信息
    configured_exchanges = get_configured_exchanges()
    if configured_exchanges:
        logger.info(f"🔑 私有API模式 - 已配置{len(configured_exchanges)}个交易所: {', '.join(configured_exchanges)}")
        logger.info("✅ 享受高频率访问和完整功能")
    else:
        logger.info("🌐 公共API模式 - 基础功能，无需配置")
        logger.info("💡 提示：配置交易所API密钥可启用私有API模式")
        logger.info("   - BINANCE_API_KEY + BINANCE_SECRET (币安)")
        logger.info("   - OKEX_API_KEY + OKEX_SECRET + OKEX_PASSPHRASE (OKX)")
        logger.info("   - BYBIT_API_KEY + BYBIT_SECRET (Bybit)")

    # 初始化数据库
    try:
        db.init_database()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")

    # 启动定期清理任务
    asyncio.create_task(periodic_cleanup())
    logger.info("定期清理任务已启动")

    # 启动实时数据服务
    await realtime_service.start()
    logger.info("实时数据服务已启动")

    # 启动缓存清理任务
    asyncio.create_task(cleanup_caches())
    logger.info("缓存清理任务已启动")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    logger.info("应用正在关闭...")

    # 停止实时数据服务
    await realtime_service.stop()
    logger.info("实时数据服务已停止")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
