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
        # 通知历史记录：{user_id: {symbol: last_notification_time}}
        self.notification_history: Dict[int, Dict[str, float]] = {}
        
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

            # 清理通知历史记录
            if user_id in self.notification_history:
                del self.notification_history[user_id]
    
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

    def can_send_notification(self, user_id: int, symbol: str, interval_seconds: int) -> bool:
        """检查是否可以发送通知（基于通知间隔）"""
        import time
        current_time = time.time()

        # 初始化用户通知历史
        if user_id not in self.notification_history:
            self.notification_history[user_id] = {}

        # 检查上次通知时间
        last_notification = self.notification_history[user_id].get(symbol, 0)

        # 如果距离上次通知的时间超过间隔，则可以发送
        if current_time - last_notification >= interval_seconds:
            # 更新最后通知时间
            self.notification_history[user_id][symbol] = current_time
            return True

        return False

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
    
    def _normalize_symbol(self, symbol: str) -> str:
        """标准化交易对符号格式"""
        # 如果已经是正确格式（包含/），直接返回
        if '/' in symbol:
            return symbol

        # 如果是单独的币种名称，添加/USDT
        if symbol and not symbol.endswith('USDT'):
            return f"{symbol}/USDT"

        # 如果已经以USDT结尾，添加/
        if symbol.endswith('USDT') and '/' not in symbol:
            base = symbol[:-4]  # 移除USDT
            return f"{base}/USDT"

        return symbol

    async def _get_ticker_data(self, symbol: str) -> Optional[dict]:
        """获取ticker数据"""
        from main import exchanges

        try:
            exchange = exchanges.get('binance')
            if not exchange:
                return None

            # 标准化符号格式
            normalized_symbol = self._normalize_symbol(symbol)

            ticker = exchange.fetch_ticker(normalized_symbol)
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
                        analysis_timeframe = sub.get('volume_analysis_timeframe', '5m')
                        volume_analysis = await self._get_volume_analysis(symbol, threshold, analysis_timeframe)

                        if volume_analysis and volume_analysis['is_anomaly']:
                            # 检查通知间隔
                            notification_interval = sub.get('notification_interval', 120)
                            user_id = sub['user_id']

                            if manager.can_send_notification(user_id, symbol, notification_interval):
                                # 发送详细的放量提醒
                                await manager.send_personal_message({
                                    'type': 'volume_alert',
                                    'symbol': symbol,
                                    'threshold': threshold,
                                    'message': f'{symbol} 触发放量提醒！当前成交量超过平均值 {volume_analysis["multiplier"]:.2f} 倍 (基于{analysis_timeframe}K线)',
                                    'timestamp': datetime.utcnow().isoformat(),
                                    'analysis': {
                                        'current_volume': volume_analysis['current_volume'],
                                        'avg_volume': volume_analysis['avg_volume'],
                                        'multiplier': volume_analysis['multiplier'],
                                        'price': volume_analysis['price'],
                                        'std_dev': volume_analysis['std_dev'],
                                        'analysis_timeframe': analysis_timeframe,
                                        'notification_interval': notification_interval
                                    }
                                }, user_id)

                                # 同时发送Telegram推送（如果用户启用了）
                                try:
                                    from message_routes import send_volume_alert_telegram
                                    await send_volume_alert_telegram(
                                        symbol=symbol,
                                        volume_data={
                                            'current_volume': volume_analysis['current_volume'],
                                            'avg_volume': volume_analysis['avg_volume'],
                                            'multiplier': volume_analysis['multiplier'],
                                            'price': volume_analysis['price'],
                                            'timeframe': analysis_timeframe,
                                            'analysis_timeframe': analysis_timeframe,
                                            'notification_interval': notification_interval
                                        },
                                        user_ids=[user_id]
                                    )
                                except Exception as telegram_error:
                                    logger.error(f"Telegram推送失败: {telegram_error}")
                            else:
                                logger.debug(f"跳过通知 {symbol} 用户 {user_id}：通知间隔未到 ({notification_interval}秒)")
                            
                    except Exception as e:
                        logger.error(f"检查放量提醒失败: {e}")
                
                await asyncio.sleep(10)  # 10秒检查一次放量
                
            except Exception as e:
                logger.error(f"放量提醒检查失败: {e}")
                await asyncio.sleep(30)
    
    async def _check_volume_threshold(self, symbol: str, threshold: float, analysis_timeframe: str = '5m') -> bool:
        """检查是否触发放量阈值 - 使用与前端相同的逻辑"""
        try:
            # 获取历史OHLCV数据用于计算平均成交量和标准差
            historical_data = await self._get_historical_ohlcv_data(symbol, analysis_timeframe, 25)

            if not historical_data or len(historical_data) < 20:
                logger.warning(f"历史数据不足，无法进行放量检测: {symbol} ({analysis_timeframe})")
                return False

            # 使用与前端PriceChart相同的放量检测逻辑
            volume_analysis = self._analyze_volume_anomaly(historical_data, threshold)

            if volume_analysis and volume_analysis['is_anomaly']:
                logger.info(f"检测到放量异常: {symbol} ({analysis_timeframe}), 倍数: {volume_analysis['multiplier']:.2f}x")
                return True

            return False

        except Exception as e:
            logger.error(f"检查放量阈值失败: {e}")
            return False

    async def _get_volume_analysis(self, symbol: str, threshold: float, analysis_timeframe: str = '5m') -> dict:
        """获取成交量分析结果"""
        try:
            # 获取历史OHLCV数据用于计算平均成交量和标准差
            historical_data = await self._get_historical_ohlcv_data(symbol, analysis_timeframe, 25)

            if not historical_data or len(historical_data) < 20:
                return None

            # 使用与前端PriceChart相同的放量检测逻辑
            analysis_result = self._analyze_volume_anomaly(historical_data, threshold)

            # 添加分析周期信息
            if analysis_result:
                analysis_result['analysis_timeframe'] = analysis_timeframe

            return analysis_result

        except Exception as e:
            logger.error(f"获取成交量分析失败: {e}")
            return None

    def _analyze_volume_anomaly(self, ohlcv_data: list, threshold: float) -> dict:
        """分析成交量异常 - 与前端PriceChart组件逻辑完全一致"""
        try:
            if len(ohlcv_data) < 20:
                return None

            # 最新数据点
            latest = ohlcv_data[-1]
            # 最近19个数据点（不包括最新的）
            recent_19 = ohlcv_data[-20:-1]

            # 计算平均成交量
            volumes = [item['volume'] for item in recent_19]
            avg_volume = sum(volumes) / len(volumes)

            # 计算标准差
            variance = sum((vol - avg_volume) ** 2 for vol in volumes) / len(volumes)
            std_dev = variance ** 0.5

            # 计算当前成交量相对于平均值的倍数
            current_volume = latest['volume']
            multiplier = current_volume / avg_volume if avg_volume > 0 else 0

            # 检查是否为异常放量（超过阈值且超过2个标准差）
            is_anomaly = (multiplier >= threshold and
                         current_volume > (avg_volume + 2 * std_dev))

            return {
                'is_anomaly': is_anomaly,
                'current_volume': current_volume,
                'avg_volume': avg_volume,
                'multiplier': multiplier,
                'std_dev': std_dev,
                'timestamp': latest['timestamp'],
                'price': latest['close']
            }

        except Exception as e:
            logger.error(f"成交量异常分析失败: {e}")
            return None

    async def _get_historical_ohlcv_data(self, symbol: str, timeframe: str = '5m', limit: int = 25) -> list:
        """获取历史OHLCV数据用于放量分析"""
        try:
            # 这里应该调用实际的市场数据API
            # 为了演示，我们生成模拟数据，实际应用中应该替换为真实API调用

            # 模拟生成历史OHLCV数据
            import time
            import random

            current_time = int(time.time() * 1000)
            interval_ms = self._get_timeframe_ms(timeframe)

            ohlcv_data = []
            base_price = 45000.0  # 基础价格
            base_volume = 1000000.0  # 基础成交量

            for i in range(limit):
                timestamp = current_time - (limit - i - 1) * interval_ms

                # 模拟价格波动
                price_change = (random.random() - 0.5) * 0.02  # ±1%波动
                price = base_price * (1 + price_change)

                # 模拟成交量波动
                volume_change = (random.random() - 0.3) * 2  # 更大的成交量波动
                volume = max(base_volume * (1 + volume_change), base_volume * 0.1)

                # 最后一个数据点可能是放量
                if i == limit - 1 and random.random() < 0.3:  # 30%概率放量
                    volume *= random.uniform(2.0, 5.0)  # 2-5倍放量

                ohlcv_data.append({
                    'timestamp': timestamp,
                    'open': price,
                    'high': price * (1 + random.random() * 0.01),
                    'low': price * (1 - random.random() * 0.01),
                    'close': price,
                    'volume': volume
                })

            return ohlcv_data

        except Exception as e:
            logger.error(f"获取历史OHLCV数据失败: {e}")
            return []

    def _get_timeframe_ms(self, timeframe: str) -> int:
        """获取时间周期对应的毫秒数"""
        timeframe_map = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000
        }
        return timeframe_map.get(timeframe, 5 * 60 * 1000)  # 默认5分钟

# 全局实时数据服务
realtime_service = RealTimeDataService()
