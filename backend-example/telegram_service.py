"""
Telegram推送服务模块
"""

import os
import asyncio
import aiohttp
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN', '')
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        
        if not self.bot_token:
            logger.warning("Telegram Bot Token未配置，Telegram推送功能将不可用")
    
    def is_enabled(self) -> bool:
        """检查Telegram服务是否可用"""
        return bool(self.bot_token)
    
    async def send_message(self, chat_id: str, message: str, parse_mode: str = 'HTML') -> bool:
        """发送消息到Telegram"""
        if not self.is_enabled():
            logger.warning("Telegram服务未启用，无法发送消息")
            return False
        
        try:
            url = f"{self.base_url}/sendMessage"
            data = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': parse_mode,
                'disable_web_page_preview': True
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        logger.info(f"Telegram消息发送成功: {chat_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Telegram消息发送失败: {response.status}, {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"发送Telegram消息时出错: {e}")
            return False
    
    async def verify_chat_id(self, chat_id: str) -> bool:
        """验证Chat ID是否有效"""
        if not self.is_enabled():
            return False
        
        try:
            # 发送一条测试消息
            test_message = "🤖 <b>连接测试成功！</b>\n\n您已成功连接到加密货币谢林点交易策略平台的Telegram推送服务。"
            return await self.send_message(chat_id, test_message)
        except Exception as e:
            logger.error(f"验证Chat ID时出错: {e}")
            return False
    
    def format_message(self, message_data: Dict[str, Any]) -> str:
        """格式化消息内容"""
        try:
            title = message_data.get('title', '消息通知')
            content = message_data.get('content', '')
            message_type = message_data.get('message_type', 'user_message')
            symbol = message_data.get('symbol', '')
            priority = message_data.get('priority', 1)
            created_at = message_data.get('created_at', datetime.now().isoformat())
            
            # 根据消息类型设置图标
            type_icons = {
                'price_alert': '💰',
                'strategy_signal': '📊',
                'system_notice': '🔔',
                'user_message': '💬',
                'volume_alert': '📈'
            }
            
            # 根据优先级设置标识
            priority_labels = {
                1: '🟢 低',
                2: '🟡 中',
                3: '🔴 高'
            }
            
            icon = type_icons.get(message_type, '💬')
            priority_label = priority_labels.get(priority, '🟢 低')
            
            # 构建消息
            formatted_message = f"{icon} <b>{title}</b>\n\n"
            
            if symbol:
                formatted_message += f"🪙 <b>币种:</b> {symbol}\n"
            
            formatted_message += f"⚡ <b>优先级:</b> {priority_label}\n"
            formatted_message += f"⏰ <b>时间:</b> {self._format_datetime(created_at)}\n\n"
            formatted_message += f"📝 <b>内容:</b>\n{content}"
            
            # 添加额外数据
            if 'data' in message_data and message_data['data']:
                data = message_data['data']
                if isinstance(data, dict):
                    formatted_message += "\n\n📊 <b>详细信息:</b>"
                    for key, value in data.items():
                        formatted_message += f"\n• <b>{key}:</b> {value}"
            
            return formatted_message
            
        except Exception as e:
            logger.error(f"格式化消息时出错: {e}")
            return f"💬 <b>{message_data.get('title', '消息通知')}</b>\n\n{message_data.get('content', '')}"
    
    def format_volume_alert(self, symbol: str, volume_data: Dict[str, Any]) -> str:
        """格式化放量提醒消息"""
        try:
            current_volume = volume_data.get('current_volume', 0)
            avg_volume = volume_data.get('avg_volume', 0)
            multiplier = volume_data.get('multiplier', 0)
            price = volume_data.get('price', 0)
            timeframe = volume_data.get('timeframe', '1h')
            
            # 格式化数字
            def format_volume(vol):
                if vol >= 1e9:
                    return f"{vol/1e9:.2f}B"
                elif vol >= 1e6:
                    return f"{vol/1e6:.2f}M"
                elif vol >= 1e3:
                    return f"{vol/1e3:.2f}K"
                else:
                    return f"{vol:.0f}"
            
            message = f"📈 <b>放量提醒 - {symbol}</b>\n\n"
            message += f"🪙 <b>币种:</b> {symbol}\n"
            message += f"💰 <b>当前价格:</b> ${price:.6f}\n"
            message += f"📊 <b>当前成交量:</b> {format_volume(current_volume)}\n"
            message += f"📊 <b>平均成交量:</b> {format_volume(avg_volume)}\n"
            message += f"🔥 <b>放量倍数:</b> {multiplier:.2f}x\n"
            message += f"⏱️ <b>检测周期:</b> {timeframe}\n"
            message += f"⏰ <b>时间:</b> {self._format_datetime(datetime.now().isoformat())}\n\n"
            message += "⚠️ <b>提醒:</b> 检测到异常放量，请关注市场动态！"
            
            return message
            
        except Exception as e:
            logger.error(f"格式化放量提醒时出错: {e}")
            return f"📈 <b>放量提醒 - {symbol}</b>\n\n检测到异常放量，请关注市场动态！"
    
    def _format_datetime(self, datetime_str: str) -> str:
        """格式化日期时间"""
        try:
            dt = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except:
            return datetime_str
    
    async def get_bot_info(self) -> Optional[Dict[str, Any]]:
        """获取Bot信息"""
        if not self.is_enabled():
            return None
        
        try:
            url = f"{self.base_url}/getMe"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('result')
                    else:
                        logger.error(f"获取Bot信息失败: {response.status}")
                        return None
        except Exception as e:
            logger.error(f"获取Bot信息时出错: {e}")
            return None

# 创建全局实例
telegram_service = TelegramService()
