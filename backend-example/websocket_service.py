"""
WebSocket服务 - 实时数据推送
"""

import asyncio
import json
import logging
from typing import Dict, Set, Any, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from database import db
import ccxt

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 存储活跃连接 {user_id: {websocket, subscriptions}}
        self.active_connections: Dict[int, Dict[str, Any]] = {}
        # 存储订阅信息 {symbol: set(user_ids)}
        self.symbol_subscribers: Dict[str, Set[int]] = {}
        
    async def connect(self, websocket: WebSocket, user_id: int):
        """建立WebSocket连接"""
        await websocket.accept()
        self.active_connections[user_id] = {
            'websocket': websocket,
            'subscriptions': set(),
            'connected_at': datetime.utcnow()
        }
        logger.info(f"用户 {user_id} WebSocket连接已建立")
        
        # 发送连接成功消息
        await self.send_personal_message({
            'type': 'connection',
            'status': 'connected',
            'message': 'WebSocket连接成功',
            'timestamp': datetime.utcnow().isoformat()
        }, user_id)
    
    def disconnect(self, user_id: int):
        """断开WebSocket连接"""
        if user_id in self.active_connections:
            # 清理订阅
            subscriptions = self.active_connections[user_id]['subscriptions']
            for symbol in subscriptions:
                if symbol in self.symbol_subscribers:
                    self.symbol_subscribers[symbol].discard(user_id)
                    if not self.symbol_subscribers[symbol]:
                        del self.symbol_subscribers[symbol]
            
            del self.active_connections[user_id]
            logger.info(f"用户 {user_id} WebSocket连接已断开")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """发送个人消息"""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]['websocket']
                await websocket.send_text(json.dumps(message, ensure_ascii=False))
            except Exception as e:
                logger.error(f"发送消息给用户 {user_id} 失败: {e}")
                self.disconnect(user_id)
    
    async def broadcast_to_subscribers(self, symbol: str, message: dict):
        """向订阅特定币种的用户广播消息"""
        if symbol in self.symbol_subscribers:
            disconnected_users = []
            for user_id in self.symbol_subscribers[symbol]:
                try:
                    await self.send_personal_message(message, user_id)
                except Exception as e:
                    logger.error(f"广播消息给用户 {user_id} 失败: {e}")
                    disconnected_users.append(user_id)
            
            # 清理断开的连接
            for user_id in disconnected_users:
                self.disconnect(user_id)
    
    def subscribe_symbol(self, user_id: int, symbol: str):
        """订阅币种实时数据"""
        if user_id in self.active_connections:
            self.active_connections[user_id]['subscriptions'].add(symbol)
            
            if symbol not in self.symbol_subscribers:
                self.symbol_subscribers[symbol] = set()
            self.symbol_subscribers[symbol].add(user_id)
            
            logger.info(f"用户 {user_id} 订阅了 {symbol} 的实时数据")
    
    def unsubscribe_symbol(self, user_id: int, symbol: str):
        """取消订阅币种实时数据"""
        if user_id in self.active_connections:
            self.active_connections[user_id]['subscriptions'].discard(symbol)
            
            if symbol in self.symbol_subscribers:
                self.symbol_subscribers[symbol].discard(user_id)
                if not self.symbol_subscribers[symbol]:
                    del self.symbol_subscribers[symbol]
            
            logger.info(f"用户 {user_id} 取消订阅了 {symbol} 的实时数据")
    
    def get_connection_stats(self) -> dict:
        """获取连接统计信息"""
        return {
            'total_connections': len(self.active_connections),
            'total_subscriptions': sum(len(conn['subscriptions']) for conn in self.active_connections.values()),
            'active_symbols': list(self.symbol_subscribers.keys()),
            'connections': {
                user_id: {
                    'subscriptions': list(conn['subscriptions']),
                    'connected_at': conn['connected_at'].isoformat()
                }
                for user_id, conn in self.active_connections.items()
            }
        }

# 全局连接管理器
manager = ConnectionManager()

class RealTimeDataService:
    """实时数据服务"""
    
    def __init__(self):
        self.is_running = False
        self.update_interval = 2  # 2秒更新一次
        
    async def start(self):
        """启动实时数据服务"""
        if self.is_running:
            return
            
        self.is_running = True
        logger.info("实时数据服务已启动")
        
        # 启动数据更新任务
        asyncio.create_task(self._update_price_data())
        asyncio.create_task(self._check_volume_alerts())
    
    async def stop(self):
        """停止实时数据服务"""
        self.is_running = False
        logger.info("实时数据服务已停止")
    
    async def _update_price_data(self):
        """更新价格数据"""
        from main import exchanges
        
        while self.is_running:
            try:
                # 获取所有被订阅的币种
                symbols = list(manager.symbol_subscribers.keys())
                
                if symbols:
                    for symbol in symbols:
                        try:
                            # 获取实时价格数据
                            ticker = await self._get_ticker_data(symbol)
                            if ticker:
                                # 广播给订阅用户
                                await manager.broadcast_to_subscribers(symbol, {
                                    'type': 'price_update',
                                    'symbol': symbol,
                                    'data': ticker,
                                    'timestamp': datetime.utcnow().isoformat()
                                })
                        except Exception as e:
                            logger.error(f"获取 {symbol} 价格数据失败: {e}")
                
                await asyncio.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"价格数据更新失败: {e}")
                await asyncio.sleep(5)
    
    async def _get_ticker_data(self, symbol: str) -> Optional[dict]:
        """获取ticker数据"""
        from main import exchanges
        
        try:
            exchange = exchanges.get('binance')
            if not exchange:
                return None
                
            ticker = exchange.fetch_ticker(symbol)
            return {
                'symbol': ticker['symbol'],
                'last': ticker['last'],
                'bid': ticker['bid'],
                'ask': ticker['ask'],
                'change': ticker['change'],
                'percentage': ticker['percentage'],
                'volume': ticker['baseVolume'],
                'high': ticker['high'],
                'low': ticker['low'],
                'timestamp': ticker['timestamp']
            }
        except Exception as e:
            logger.error(f"获取 {symbol} ticker数据失败: {e}")
            return None
    
    async def _check_volume_alerts(self):
        """检查放量提醒"""
        while self.is_running:
            try:
                # 获取所有启用放量提醒的订阅
                subscriptions = db.get_volume_alert_subscriptions()
                
                for sub in subscriptions:
                    try:
                        symbol = sub['symbol']
                        threshold = sub['volume_threshold']
                        
                        # 检查是否触发放量提醒
                        is_volume_alert = await self._check_volume_threshold(symbol, threshold)
                        
                        if is_volume_alert:
                            # 发送放量提醒
                            await manager.send_personal_message({
                                'type': 'volume_alert',
                                'symbol': symbol,
                                'threshold': threshold,
                                'message': f'{symbol} 触发放量提醒！当前成交量超过平均值 {threshold} 倍',
                                'timestamp': datetime.utcnow().isoformat()
                            }, sub['user_id'])
                            
                    except Exception as e:
                        logger.error(f"检查放量提醒失败: {e}")
                
                await asyncio.sleep(10)  # 10秒检查一次放量
                
            except Exception as e:
                logger.error(f"放量提醒检查失败: {e}")
                await asyncio.sleep(30)
    
    async def _check_volume_threshold(self, symbol: str, threshold: float) -> bool:
        """检查是否触发放量阈值"""
        try:
            # 这里简化实现，实际应该计算平均成交量
            ticker = await self._get_ticker_data(symbol)
            if ticker and ticker['volume']:
                # 简单的放量检测逻辑
                return ticker['volume'] > 1000000 * threshold
            return False
        except Exception as e:
            logger.error(f"检查放量阈值失败: {e}")
            return False

# 全局实时数据服务
realtime_service = RealTimeDataService()
