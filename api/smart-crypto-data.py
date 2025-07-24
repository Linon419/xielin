"""
Vercel Serverless Function - 智能加密货币数据API
根据API密钥配置自动选择数据源：
- 有API密钥：使用CCXT私有API（高频率、完整功能）
- 无API密钥：使用公开API（基础功能、免费使用）
"""

from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import os
import sys
import random
from datetime import datetime, timedelta

# 尝试导入CCXT
try:
    import ccxt
    CCXT_AVAILABLE = True
except ImportError:
    CCXT_AVAILABLE = False

class handler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 检查API密钥配置
        self.api_keys_configured = self._check_api_keys()
        self.exchanges = {}
        
        # 如果有API密钥且CCXT可用，初始化交易所
        if self.api_keys_configured and CCXT_AVAILABLE:
            try:
                self.exchanges = self._init_exchanges()
                self.api_mode = "private"  # 私有API模式
            except Exception as e:
                print(f"私有API初始化失败，切换到公开API: {e}")
                self.api_mode = "public"   # 公开API模式
        else:
            self.api_mode = "public"       # 公开API模式
        
        super().__init__(*args, **kwargs)

    def _check_api_keys(self):
        """检查是否配置了API密钥"""
        binance_key = os.getenv('BINANCE_API_KEY')
        binance_secret = os.getenv('BINANCE_SECRET')
        
        return bool(binance_key and binance_secret)

    def _init_exchanges(self):
        """初始化交易所（仅在有API密钥时）"""
        exchanges = {}
        
        # Binance
        binance_key = os.getenv('BINANCE_API_KEY')
        binance_secret = os.getenv('BINANCE_SECRET')
        if binance_key and binance_secret:
            exchanges['binance'] = ccxt.binance({
                'apiKey': binance_key,
                'secret': binance_secret,
                'sandbox': False,
                'options': {'defaultType': 'future'}
            })
        
        # OKX
        okx_key = os.getenv('OKX_API_KEY')
        okx_secret = os.getenv('OKX_SECRET')
        okx_passphrase = os.getenv('OKX_PASSPHRASE')
        if okx_key and okx_secret and okx_passphrase:
            exchanges['okx'] = ccxt.okx({
                'apiKey': okx_key,
                'secret': okx_secret,
                'password': okx_passphrase,
                'sandbox': False,
                'options': {'defaultType': 'swap'}
            })
        
        return exchanges

    def do_GET(self):
        # 设置CORS头
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        try:
            # 解析URL参数
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            endpoint = parsed_url.path.split('/')[-1]
            symbol = query_params.get('symbol', [None])[0]
            
            # 添加API模式信息到响应头
            print(f"API模式: {self.api_mode}, 端点: {endpoint}, 交易对: {symbol}")
            
            if endpoint == 'market-data':
                response = self.get_market_data(symbol)
            elif endpoint == 'historical-data':
                timeframe = query_params.get('timeframe', ['1h'])[0]
                limit = int(query_params.get('limit', [100])[0])
                response = self.get_historical_data(symbol, timeframe, limit)
            elif endpoint == 'api-status':
                response = self.get_api_status()
            else:
                response = {
                    'success': False,
                    'message': f'未知的端点: {endpoint}'
                }

            # 添加API模式信息到响应
            response['api_mode'] = self.api_mode
            response['api_keys_configured'] = self.api_keys_configured

            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            response = {
                'success': False,
                'message': f'服务器内部错误: {str(e)}',
                'api_mode': getattr(self, 'api_mode', 'unknown')
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def get_api_status(self):
        """获取API状态信息"""
        return {
            'success': True,
            'data': {
                'api_mode': self.api_mode,
                'api_keys_configured': self.api_keys_configured,
                'ccxt_available': CCXT_AVAILABLE,
                'available_exchanges': list(self.exchanges.keys()) if self.exchanges else [],
                'features': {
                    'real_time_data': True,
                    'historical_data': True,
                    'funding_rate': self.api_mode == 'private',
                    'high_frequency': self.api_mode == 'private',
                    'account_info': self.api_mode == 'private'
                },
                'rate_limits': {
                    'private_api': '6000/min' if self.api_mode == 'private' else 'N/A',
                    'public_api': '1200/min'
                }
            }
        }

    def get_market_data(self, symbol):
        """获取市场数据 - 智能选择数据源"""
        if not symbol:
            return {'success': False, 'message': '缺少symbol参数'}

        # 优先使用私有API
        if self.api_mode == 'private' and 'binance' in self.exchanges:
            try:
                return self._get_private_market_data(symbol)
            except Exception as e:
                print(f"私有API失败，切换到公开API: {e}")
                return self._get_public_market_data(symbol)
        else:
            return self._get_public_market_data(symbol)

    def get_historical_data(self, symbol, timeframe, limit):
        """获取历史数据 - 智能选择数据源"""
        if not symbol:
            return {'success': False, 'message': '缺少symbol参数'}

        # 优先使用私有API
        if self.api_mode == 'private' and 'binance' in self.exchanges:
            try:
                return self._get_private_historical_data(symbol, timeframe, limit)
            except Exception as e:
                print(f"私有API失败，切换到公开API: {e}")
                return self._get_public_historical_data(symbol, timeframe, limit)
        else:
            return self._get_public_historical_data(symbol, timeframe, limit)

    def _get_private_market_data(self, symbol):
        """使用CCXT私有API获取市场数据"""
        exchange = self.exchanges['binance']
        
        # 标准化交易对
        if not symbol.endswith('USDT'):
            symbol = symbol + 'USDT'
        
        ticker = exchange.fetch_ticker(symbol)
        
        # 获取资金费率（私有API独有）
        try:
            funding_rate = exchange.fetch_funding_rate(symbol)['fundingRate']
        except:
            funding_rate = None
        
        return {
            'success': True,
            'data': {
                'symbol': symbol,
                'price': ticker['last'],
                'change24h': ticker['percentage'],
                'volume24h': ticker['quoteVolume'],
                'high24h': ticker['high'],
                'low24h': ticker['low'],
                'openInterest': ticker.get('info', {}).get('openInterest'),
                'fundingRate': funding_rate,
                'lastUpdated': datetime.now().isoformat(),
                'contractType': 'perpetual',
                'exchange': 'Binance',
                'data_source': 'private_api'
            }
        }

    def _get_private_historical_data(self, symbol, timeframe, limit):
        """使用CCXT私有API获取历史数据"""
        exchange = self.exchanges['binance']
        
        # 标准化交易对
        if not symbol.endswith('USDT'):
            symbol = symbol + 'USDT'
        
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        
        data = []
        for candle in ohlcv:
            data.append({
                'timestamp': candle[0],
                'open': candle[1],
                'high': candle[2],
                'low': candle[3],
                'close': candle[4],
                'volume': candle[5]
            })
        
        return {
            'success': True,
            'data': {
                'symbol': symbol,
                'timeframe': timeframe,
                'data': data,
                'data_source': 'private_api'
            }
        }

    def _get_public_market_data(self, symbol):
        """使用公开API获取市场数据"""
        try:
            # 标准化交易对符号
            normalized_symbol = symbol.upper()
            if not normalized_symbol.endswith('USDT'):
                normalized_symbol += 'USDT'

            # Binance公开API端点
            ticker_url = f"https://fapi.binance.com/fapi/v1/ticker/24hr?symbol={normalized_symbol}"
            
            # 创建SSL上下文
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # 发送请求
            with urllib.request.urlopen(ticker_url, context=ssl_context, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            # 获取持仓量数据
            oi_url = f"https://fapi.binance.com/fapi/v1/openInterest?symbol={normalized_symbol}"
            try:
                with urllib.request.urlopen(oi_url, context=ssl_context, timeout=5) as oi_response:
                    oi_data = json.loads(oi_response.read().decode('utf-8'))
                    open_interest = float(oi_data.get('openInterest', 0))
            except:
                open_interest = None

            return {
                'success': True,
                'data': {
                    'symbol': normalized_symbol,
                    'price': float(data['lastPrice']),
                    'change24h': float(data['priceChangePercent']),
                    'volume24h': float(data['quoteVolume']),
                    'high24h': float(data['highPrice']),
                    'low24h': float(data['lowPrice']),
                    'openInterest': open_interest,
                    'fundingRate': None,  # 公开API不提供
                    'lastUpdated': datetime.now().isoformat(),
                    'contractType': 'perpetual',
                    'exchange': 'Binance',
                    'data_source': 'public_api'
                }
            }

        except Exception as e:
            print(f"公开API失败，使用模拟数据: {e}")
            return self._get_mock_market_data(symbol)

    def _get_public_historical_data(self, symbol, timeframe, limit):
        """使用公开API获取历史数据"""
        try:
            # 标准化交易对符号
            normalized_symbol = symbol.upper()
            if not normalized_symbol.endswith('USDT'):
                normalized_symbol += 'USDT'

            # 时间周期映射
            interval_map = {
                '1m': '1m',
                '15m': '15m',
                '1h': '1h',
                '4h': '4h'
            }
            
            interval = interval_map.get(timeframe, '1h')
            
            # Binance公开K线API
            klines_url = f"https://fapi.binance.com/fapi/v1/klines?symbol={normalized_symbol}&interval={interval}&limit={limit}"
            
            # 创建SSL上下文
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # 发送请求
            with urllib.request.urlopen(klines_url, context=ssl_context, timeout=15) as response:
                klines_data = json.loads(response.read().decode('utf-8'))
            
            # 转换数据格式
            data = []
            for kline in klines_data:
                data.append({
                    'timestamp': int(kline[0]),
                    'open': float(kline[1]),
                    'high': float(kline[2]),
                    'low': float(kline[3]),
                    'close': float(kline[4]),
                    'volume': float(kline[5])
                })
            
            return {
                'success': True,
                'data': {
                    'symbol': normalized_symbol,
                    'timeframe': timeframe,
                    'data': data,
                    'data_source': 'public_api'
                }
            }

        except Exception as e:
            print(f"公开API失败，使用模拟数据: {e}")
            return self._get_mock_historical_data(symbol, timeframe, limit)

    def _get_mock_market_data(self, symbol):
        """模拟市场数据（最后备用方案）"""
        return {
            'success': True,
            'data': {
                'symbol': symbol.upper(),
                'price': round(random.uniform(30000, 80000), 2),
                'change24h': round((random.random() - 0.5) * 10, 2),
                'volume24h': round(random.uniform(100000000, 1000000000), 2),
                'high24h': round(random.uniform(35000, 85000), 2),
                'low24h': round(random.uniform(25000, 75000), 2),
                'openInterest': round(random.uniform(100000000, 500000000), 2),
                'fundingRate': round((random.random() - 0.5) * 0.001, 6),
                'lastUpdated': datetime.now().isoformat(),
                'contractType': 'perpetual',
                'exchange': 'Binance',
                'data_source': 'mock_data',
                'note': '模拟数据 - 所有API都不可用时的备用数据'
            }
        }

    def _get_mock_historical_data(self, symbol, timeframe, limit):
        """模拟历史数据（最后备用方案）"""
        data = []
        base_price = 45000
        now = datetime.now()
        
        intervals = {
            '1m': timedelta(minutes=1),
            '15m': timedelta(minutes=15),
            '1h': timedelta(hours=1),
            '4h': timedelta(hours=4)
        }
        
        interval = intervals.get(timeframe, intervals['1h'])
        
        for i in range(limit - 1, -1, -1):
            timestamp = now - (interval * i)
            timestamp_ms = int(timestamp.timestamp() * 1000)
            
            volatility = 0.02
            open_price = base_price + (random.random() - 0.5) * base_price * volatility
            close_price = open_price + (random.random() - 0.5) * open_price * volatility
            high_price = max(open_price, close_price) + random.random() * open_price * volatility * 0.5
            low_price = min(open_price, close_price) - random.random() * open_price * volatility * 0.5
            volume = random.uniform(100000, 1000000)

            data.append({
                'timestamp': timestamp_ms,
                'open': round(open_price, 2),
                'high': round(high_price, 2),
                'low': round(low_price, 2),
                'close': round(close_price, 2),
                'volume': round(volume, 2)
            })

            base_price = close_price
        
        return {
            'success': True,
            'data': {
                'symbol': symbol.upper(),
                'timeframe': timeframe,
                'data': data,
                'data_source': 'mock_data',
                'note': '模拟数据 - 所有API都不可用时的备用数据'
            }
        }

    def do_OPTIONS(self):
        # 处理预检请求
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
