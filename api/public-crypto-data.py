"""
Vercel Serverless Function - 公开加密货币数据API (无需API密钥)
使用公开端点获取市场数据
"""

from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import random
from datetime import datetime, timedelta

class handler(BaseHTTPRequestHandler):
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
            
            if endpoint == 'market-data':
                response = self.get_public_market_data(symbol)
            elif endpoint == 'historical-data':
                timeframe = query_params.get('timeframe', ['1h'])[0]
                limit = int(query_params.get('limit', [100])[0])
                response = self.get_public_historical_data(symbol, timeframe, limit)
            else:
                response = {
                    'success': False,
                    'message': f'未知的端点: {endpoint}'
                }

            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            response = {
                'success': False,
                'message': f'服务器内部错误: {str(e)}'
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def get_public_market_data(self, symbol):
        """使用Binance公开API获取市场数据（无需API密钥）"""
        if not symbol:
            return {'success': False, 'message': '缺少symbol参数'}

        try:
            # 标准化交易对符号
            normalized_symbol = symbol.upper()
            if not normalized_symbol.endswith('USDT'):
                normalized_symbol += 'USDT'

            # Binance公开API端点
            ticker_url = f"https://fapi.binance.com/fapi/v1/ticker/24hr?symbol={normalized_symbol}"
            
            # 创建SSL上下文（忽略证书验证，仅用于开发）
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
                    'fundingRate': None,  # 需要单独获取
                    'lastUpdated': datetime.now().isoformat(),
                    'contractType': 'perpetual',
                    'exchange': 'Binance'
                }
            }

        except urllib.error.HTTPError as e:
            if e.code == 400:
                return {
                    'success': False,
                    'message': f'无效的交易对: {symbol}'
                }
            else:
                return self.get_mock_market_data(symbol)
        except Exception as e:
            print(f"获取公开市场数据失败: {e}")
            return self.get_mock_market_data(symbol)

    def get_public_historical_data(self, symbol, timeframe, limit):
        """使用Binance公开API获取历史数据（无需API密钥）"""
        if not symbol:
            return {'success': False, 'message': '缺少symbol参数'}

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
                    'timestamp': int(kline[0]),  # 开盘时间
                    'open': float(kline[1]),     # 开盘价
                    'high': float(kline[2]),     # 最高价
                    'low': float(kline[3]),      # 最低价
                    'close': float(kline[4]),    # 收盘价
                    'volume': float(kline[5])    # 成交量
                })
            
            return {
                'success': True,
                'data': {
                    'symbol': normalized_symbol,
                    'timeframe': timeframe,
                    'data': data
                }
            }

        except urllib.error.HTTPError as e:
            if e.code == 400:
                return {
                    'success': False,
                    'message': f'无效的交易对或时间周期: {symbol}, {timeframe}'
                }
            else:
                return self.get_mock_historical_data(symbol, timeframe, limit)
        except Exception as e:
            print(f"获取公开历史数据失败: {e}")
            return self.get_mock_historical_data(symbol, timeframe, limit)

    def get_mock_market_data(self, symbol):
        """模拟市场数据（备用方案）"""
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
                'note': '模拟数据 - API调用失败时的备用数据'
            }
        }

    def get_mock_historical_data(self, symbol, timeframe, limit):
        """模拟历史数据（备用方案）"""
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
                'note': '模拟数据 - API调用失败时的备用数据'
            }
        }

    def do_OPTIONS(self):
        # 处理预检请求
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
