"""
消息推送服务
用于生成和推送各种类型的消息给用户
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import json

from database import db

logger = logging.getLogger(__name__)

class MessageService:
    def __init__(self):
        self.message_types = {
            'price_alert': '价格提醒',
            'strategy_signal': '策略信号',
            'system_notice': '系统通知',
            'user_message': '用户消息'
        }
    
    async def create_and_send_message(self, title: str, content: str, message_type: str,
                                    symbol: str = None, priority: int = 1, 
                                    data: Dict = None, expires_at: datetime = None,
                                    target_users: List[int] = None, is_global: bool = False):
        """
        创建并发送消息
        
        Args:
            title: 消息标题
            content: 消息内容
            message_type: 消息类型
            symbol: 相关币种
            priority: 优先级 (1:低, 2:中, 3:高)
            data: 额外数据
            expires_at: 过期时间
            target_users: 目标用户ID列表，如果为None则发送给所有订阅用户
            is_global: 是否为全局消息
        """
        try:
            # 创建消息
            message_id = db.create_message(
                title=title,
                content=content,
                message_type=message_type,
                symbol=symbol,
                priority=priority,
                data=data,
                expires_at=expires_at,
                is_global=is_global
            )
            
            if not message_id:
                logger.error("消息创建失败")
                return False
            
            # 确定目标用户
            if target_users is None:
                if symbol:
                    # 获取订阅该币种的用户
                    target_users = await self._get_subscribed_users(symbol)
                else:
                    # 获取所有活跃用户
                    target_users = await self._get_all_active_users()
            
            # 发送给目标用户
            success_count = 0
            for user_id in target_users:
                if await self._send_message_to_user(user_id, message_id):
                    success_count += 1
            
            logger.info(f"消息发送完成: {title}, 成功发送给 {success_count}/{len(target_users)} 个用户")
            return True
            
        except Exception as e:
            logger.error(f"创建并发送消息失败: {e}")
            return False
    
    async def _get_subscribed_users(self, symbol: str) -> List[int]:
        """获取订阅指定币种的用户ID列表"""
        try:
            conn = db.get_connection()
            cursor = conn.execute('''
                SELECT DISTINCT user_id
                FROM user_subscriptions
                WHERE symbol = ? AND is_enabled = 1
            ''', (symbol.upper(),))
            
            user_ids = [row['user_id'] for row in cursor.fetchall()]
            conn.close()
            
            return user_ids
            
        except Exception as e:
            logger.error(f"获取订阅用户失败: {e}")
            return []
    
    async def _get_all_active_users(self) -> List[int]:
        """获取所有活跃用户ID列表"""
        try:
            conn = db.get_connection()
            cursor = conn.execute('''
                SELECT id
                FROM users
                WHERE is_active = 1
            ''')
            
            user_ids = [row['id'] for row in cursor.fetchall()]
            conn.close()
            
            return user_ids
            
        except Exception as e:
            logger.error(f"获取活跃用户失败: {e}")
            return []
    
    async def _send_message_to_user(self, user_id: int, message_id: int) -> bool:
        """发送消息给指定用户"""
        try:
            conn = db.get_connection()
            conn.execute('''
                INSERT OR IGNORE INTO user_messages (user_id, message_id)
                VALUES (?, ?)
            ''', (user_id, message_id))
            
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"发送消息给用户失败: {e}")
            return False
    
    async def send_price_alert(self, symbol: str, current_price: float, 
                              alert_type: str, threshold: float, 
                              target_users: List[int] = None):
        """
        发送价格提醒消息
        
        Args:
            symbol: 币种
            current_price: 当前价格
            alert_type: 提醒类型 ('above', 'below')
            threshold: 阈值价格
            target_users: 目标用户列表
        """
        try:
            if alert_type == 'above':
                title = f"{symbol} 价格突破提醒"
                content = f"{symbol} 当前价格 ${current_price:,.2f} 已突破设定阈值 ${threshold:,.2f}"
            else:
                title = f"{symbol} 价格跌破提醒"
                content = f"{symbol} 当前价格 ${current_price:,.2f} 已跌破设定阈值 ${threshold:,.2f}"
            
            data = {
                'current_price': current_price,
                'threshold': threshold,
                'alert_type': alert_type,
                'timestamp': datetime.now().isoformat()
            }
            
            await self.create_and_send_message(
                title=title,
                content=content,
                message_type='price_alert',
                symbol=symbol,
                priority=2,
                data=data,
                target_users=target_users
            )
            
        except Exception as e:
            logger.error(f"发送价格提醒失败: {e}")
    
    async def send_strategy_signal(self, symbol: str, signal_type: str, 
                                  strategy_name: str, confidence: float,
                                  entry_price: float = None, target_price: float = None,
                                  stop_loss: float = None, target_users: List[int] = None):
        """
        发送策略信号消息
        
        Args:
            symbol: 币种
            signal_type: 信号类型 ('buy', 'sell', 'hold')
            strategy_name: 策略名称
            confidence: 信号置信度 (0-1)
            entry_price: 入场价格
            target_price: 目标价格
            stop_loss: 止损价格
            target_users: 目标用户列表
        """
        try:
            signal_text = {'buy': '买入', 'sell': '卖出', 'hold': '持有'}[signal_type]
            title = f"{symbol} {strategy_name} {signal_text}信号"
            
            content = f"策略 {strategy_name} 为 {symbol} 生成了 {signal_text} 信号\n"
            content += f"信号置信度: {confidence:.1%}\n"
            
            if entry_price:
                content += f"建议入场价: ${entry_price:,.2f}\n"
            if target_price:
                content += f"目标价格: ${target_price:,.2f}\n"
            if stop_loss:
                content += f"止损价格: ${stop_loss:,.2f}\n"
            
            data = {
                'signal_type': signal_type,
                'strategy_name': strategy_name,
                'confidence': confidence,
                'entry_price': entry_price,
                'target_price': target_price,
                'stop_loss': stop_loss,
                'timestamp': datetime.now().isoformat()
            }
            
            await self.create_and_send_message(
                title=title,
                content=content,
                message_type='strategy_signal',
                symbol=symbol,
                priority=3,
                data=data,
                target_users=target_users
            )
            
        except Exception as e:
            logger.error(f"发送策略信号失败: {e}")
    
    async def send_system_notice(self, title: str, content: str, 
                                priority: int = 1, expires_at: datetime = None,
                                target_users: List[int] = None):
        """
        发送系统通知
        
        Args:
            title: 通知标题
            content: 通知内容
            priority: 优先级
            expires_at: 过期时间
            target_users: 目标用户列表，None表示发送给所有用户
        """
        try:
            await self.create_and_send_message(
                title=title,
                content=content,
                message_type='system_notice',
                priority=priority,
                expires_at=expires_at,
                target_users=target_users,
                is_global=target_users is None
            )
            
        except Exception as e:
            logger.error(f"发送系统通知失败: {e}")
    
    async def send_welcome_message(self, user_id: int):
        """发送欢迎消息给新用户"""
        try:
            title = "欢迎使用加密货币谢林点交易策略平台！"
            content = """欢迎您加入我们的平台！

这里您可以：
• 生成专业的交易策略
• 订阅感兴趣的币种消息
• 接收实时价格提醒和策略信号
• 管理您的消息中心

开始探索吧！如有任何问题，请随时联系我们。"""
            
            await self.create_and_send_message(
                title=title,
                content=content,
                message_type='user_message',
                priority=1,
                target_users=[user_id]
            )
            
        except Exception as e:
            logger.error(f"发送欢迎消息失败: {e}")
    
    async def cleanup_expired_messages(self):
        """清理过期消息"""
        try:
            conn = db.get_connection()
            
            # 删除过期的消息
            cursor = conn.execute('''
                DELETE FROM messages
                WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
            ''')
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted_count > 0:
                logger.info(f"清理了 {deleted_count} 条过期消息")
            
        except Exception as e:
            logger.error(f"清理过期消息失败: {e}")

# 创建全局消息服务实例
message_service = MessageService()

# 定期清理任务
async def periodic_cleanup():
    """定期清理过期消息"""
    while True:
        try:
            await message_service.cleanup_expired_messages()
            # 每小时清理一次
            await asyncio.sleep(3600)
        except Exception as e:
            logger.error(f"定期清理任务失败: {e}")
            await asyncio.sleep(300)  # 出错时5分钟后重试
