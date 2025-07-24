"""
Vercel Serverless Function - 市场数据API (Python版本)
"""

from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import random
import time
from datetime import datetime

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
            
            if not symbol:
                response = {
                    'success': False,
                    'message': '缺少symbol参数'
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return

            # 生成模拟市场数据
            mock_data = {
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
                'exchange': 'Binance'
            }

            response = {
                'success': True,
                'data': mock_data
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
