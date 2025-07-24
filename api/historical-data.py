"""
Vercel Serverless Function - 历史数据API (Python版本)
"""

from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import random
import time
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
            
            symbol = query_params.get('symbol', [None])[0]
            timeframe = query_params.get('timeframe', ['1h'])[0]
            limit = int(query_params.get('limit', [100])[0])
            
            if not symbol:
                response = {
                    'success': False,
                    'message': '缺少symbol参数'
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return

            # 生成模拟历史数据
            def generate_ohlcv_data(count):
                data = []
                base_price = 45000
                now = datetime.now()
                
                # 时间间隔映射
                intervals = {
                    '1m': timedelta(minutes=1),
                    '15m': timedelta(minutes=15),
                    '1h': timedelta(hours=1),
                    '4h': timedelta(hours=4)
                }
                
                interval = intervals.get(timeframe, intervals['1h'])
                
                for i in range(count - 1, -1, -1):
                    timestamp = now - (interval * i)
                    timestamp_ms = int(timestamp.timestamp() * 1000)
                    
                    volatility = 0.02  # 2% 波动率
                    
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

                    base_price = close_price  # 下一个K线的基准价格
                
                return data

            historical_data = generate_ohlcv_data(limit)

            response = {
                'success': True,
                'data': {
                    'symbol': symbol.upper(),
                    'timeframe': timeframe,
                    'data': historical_data
                }
            }

            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            response = {
                'success': False,
                'message': f'服务器内部错误: {str(e)}'
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        # 处理预检请求
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
