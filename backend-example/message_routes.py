"""
消息管理相关的API路由
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, validator
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from auth import get_current_user
from database import db
from telegram_service import telegram_service
import asyncio

logger = logging.getLogger(__name__)

# Pydantic模型
class MessageCreate(BaseModel):
    title: str
    content: str
    message_type: str
    symbol: Optional[str] = None
    priority: int = 1
    data: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None
    is_global: bool = False
    
    @validator('message_type')
    def validate_message_type(cls, v):
        allowed_types = ['price_alert', 'strategy_signal', 'system_notice', 'user_message']
        if v not in allowed_types:
            raise ValueError(f'消息类型必须是: {", ".join(allowed_types)}')
        return v
    
    @validator('priority')
    def validate_priority(cls, v):
        if v not in [1, 2, 3]:
            raise ValueError('优先级必须是1(低)、2(中)或3(高)')
        return v

class MessageResponse(BaseModel):
    id: int
    title: str
    content: str
    message_type: str
    symbol: Optional[str]
    priority: int
    data: Optional[Dict[str, Any]]
    created_at: str
    expires_at: Optional[str]
    is_global: bool
    is_read: bool
    read_at: Optional[str]
    received_at: str

class SubscriptionUpdate(BaseModel):
    symbol: str
    is_enabled: bool = True
    alert_settings: Optional[Dict[str, Any]] = None

    # 放量提醒设置
    volume_alert_enabled: bool = False
    volume_threshold: float = 2.0  # 放量倍数阈值，默认2倍
    volume_timeframe: str = "10s"  # 检测时间周期，默认10秒
    volume_analysis_timeframe: str = "5m"  # 统计数据周期，默认5分钟
    notification_interval: int = 120  # 通知间隔，默认2分钟

    @validator('symbol')
    def validate_symbol(cls, v):
        return v.upper().strip()

    @validator('volume_threshold')
    def validate_volume_threshold(cls, v):
        if v < 1.1:
            raise ValueError('放量阈值必须大于等于1.1')
        if v > 10.0:
            raise ValueError('放量阈值不能超过10.0')
        return v

    @validator('volume_timeframe')
    def validate_volume_timeframe(cls, v):
        allowed_timeframes = ['1s', '5s', '10s', '15s', '30s', '1m', '2m', '5m', '10m', '15m', '30m', '1h']
        if v not in allowed_timeframes:
            raise ValueError(f'检测周期必须是: {", ".join(allowed_timeframes)}')
        return v

    @validator('volume_analysis_timeframe')
    def validate_volume_analysis_timeframe(cls, v):
        allowed_analysis_timeframes = ['1m', '5m', '15m', '1h', '4h']
        if v not in allowed_analysis_timeframes:
            raise ValueError(f'统计数据周期必须是: {", ".join(allowed_analysis_timeframes)}')
        return v

    @validator('notification_interval')
    def validate_notification_interval(cls, v):
        if v < 30:
            raise ValueError('通知间隔不能少于30秒')
        if v > 3600:
            raise ValueError('通知间隔不能超过1小时')
        return v

class SubscriptionResponse(BaseModel):
    symbol: str
    is_enabled: bool
    alert_settings: Optional[Dict[str, Any]]
    volume_alert_enabled: bool
    volume_threshold: float
    volume_timeframe: str
    volume_analysis_timeframe: Optional[str] = "5m"
    notification_interval: Optional[int] = 120
    created_at: str
    updated_at: str

# 创建消息路由
message_router = APIRouter(prefix="/api/messages", tags=["消息管理"])

@message_router.get("", response_model=List[MessageResponse], summary="获取用户消息列表")
async def get_user_messages(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100, description="每页数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    unread_only: bool = Query(False, description="仅显示未读消息"),
    symbol: Optional[str] = Query(None, description="筛选特定币种")
):
    """
    获取用户消息列表
    
    - **limit**: 每页消息数量（1-100）
    - **offset**: 偏移量，用于分页
    - **unread_only**: 是否仅显示未读消息
    - **symbol**: 筛选特定币种的消息
    """
    try:
        messages = db.get_user_messages(
            user_id=current_user['id'],
            limit=limit,
            offset=offset,
            unread_only=unread_only,
            symbol=symbol.upper() if symbol else None
        )
        
        return [MessageResponse(**msg) for msg in messages]
        
    except Exception as e:
        logger.error(f"获取用户消息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取消息失败"
        )

@message_router.post("/{message_id}/read", summary="标记消息为已读")
async def mark_message_read(
    message_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """标记指定消息为已读"""
    try:
        success = db.mark_message_read(current_user['id'], message_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="消息不存在或已被删除"
            )
        
        return {"success": True, "message": "消息已标记为已读"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"标记消息已读失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@message_router.delete("/{message_id}", summary="删除消息")
async def delete_message(
    message_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """删除指定消息"""
    try:
        success = db.delete_user_message(current_user['id'], message_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="消息不存在或已被删除"
            )
        
        return {"success": True, "message": "消息已删除"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除消息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除失败"
        )

@message_router.post("/mark-all-read", summary="标记所有消息为已读")
async def mark_all_messages_read(
    current_user: Dict[str, Any] = Depends(get_current_user),
    symbol: Optional[str] = Query(None, description="仅标记特定币种的消息")
):
    """标记所有未读消息为已读"""
    try:
        # 获取所有未读消息
        messages = db.get_user_messages(
            user_id=current_user['id'],
            limit=1000,  # 获取大量消息
            unread_only=True,
            symbol=symbol.upper() if symbol else None
        )
        
        # 批量标记为已读
        success_count = 0
        for msg in messages:
            if db.mark_message_read(current_user['id'], msg['id']):
                success_count += 1
        
        return {
            "success": True,
            "message": f"已标记 {success_count} 条消息为已读"
        }
        
    except Exception as e:
        logger.error(f"批量标记消息已读失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@message_router.get("/stats", summary="获取消息统计")
async def get_message_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取用户消息统计信息"""
    try:
        # 获取未读消息数量
        unread_count = db.get_unread_message_count(current_user['id'])
        
        # 获取总消息数量
        all_messages = db.get_user_messages(current_user['id'], limit=10000)
        total_count = len(all_messages)
        
        # 按类型统计
        type_stats = {}
        for msg in all_messages:
            msg_type = msg['message_type']
            if msg_type not in type_stats:
                type_stats[msg_type] = {'total': 0, 'unread': 0}
            type_stats[msg_type]['total'] += 1
            if not msg['is_read']:
                type_stats[msg_type]['unread'] += 1
        
        return {
            "total_messages": total_count,
            "unread_messages": unread_count,
            "read_messages": total_count - unread_count,
            "type_statistics": type_stats
        }
        
    except Exception as e:
        logger.error(f"获取消息统计失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取统计失败"
        )

@message_router.post("", response_model=MessageResponse, summary="创建消息")
async def create_message(
    message_data: MessageCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """创建新消息并推送到Telegram"""
    try:
        # 创建消息
        message_id = db.create_message(
            title=message_data.title,
            content=message_data.content,
            message_type=message_data.message_type,
            symbol=message_data.symbol,
            priority=message_data.priority,
            data=message_data.data,
            expires_at=message_data.expires_at,
            is_global=message_data.is_global
        )

        if not message_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建消息失败"
            )

        # 获取创建的消息
        message = db.get_message_by_id(message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="获取消息失败"
            )

        # 异步推送到Telegram
        asyncio.create_task(send_telegram_notification(message))

        return message

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建消息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建消息失败"
        )

async def send_telegram_notification(message: Dict[str, Any]):
    """发送Telegram通知"""
    try:
        # 获取启用了Telegram推送的用户
        users = db.get_users_with_telegram_enabled()

        if not users:
            logger.info("没有用户启用Telegram推送")
            return

        # 格式化消息
        formatted_message = telegram_service.format_message(message)

        # 并发发送给所有用户
        tasks = []
        for user in users:
            if user['telegram_chat_id']:
                task = telegram_service.send_message(
                    chat_id=user['telegram_chat_id'],
                    message=formatted_message
                )
                tasks.append(task)

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            success_count = sum(1 for result in results if result is True)
            logger.info(f"Telegram推送完成: {success_count}/{len(tasks)} 成功")

    except Exception as e:
        logger.error(f"Telegram推送失败: {e}")

async def send_volume_alert_telegram(symbol: str, volume_data: Dict[str, Any], user_ids: List[int] = None):
    """发送放量提醒到Telegram"""
    try:
        # 获取目标用户
        if user_ids:
            # 获取指定用户的Telegram配置
            users = []
            for user_id in user_ids:
                user = db.get_user_by_id(user_id)
                if user and user.get('telegram_enabled') and user.get('telegram_chat_id'):
                    users.append(user)
        else:
            # 获取所有启用Telegram的用户
            users = db.get_users_with_telegram_enabled()

        if not users:
            return

        # 格式化放量提醒消息
        formatted_message = telegram_service.format_volume_alert(symbol, volume_data)

        # 并发发送
        tasks = []
        for user in users:
            if user['telegram_chat_id']:
                task = telegram_service.send_message(
                    chat_id=user['telegram_chat_id'],
                    message=formatted_message
                )
                tasks.append(task)

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            success_count = sum(1 for result in results if result is True)
            logger.info(f"放量提醒Telegram推送完成: {success_count}/{len(tasks)} 成功")

    except Exception as e:
        logger.error(f"放量提醒Telegram推送失败: {e}")

# 创建订阅管理路由
subscription_router = APIRouter(prefix="/api/subscriptions", tags=["订阅管理"])

@subscription_router.get("", response_model=List[SubscriptionResponse], summary="获取用户订阅列表")
async def get_user_subscriptions(current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取当前用户的所有币种订阅"""
    try:
        subscriptions = db.get_user_subscriptions(current_user['id'])
        return [SubscriptionResponse(**sub) for sub in subscriptions]
        
    except Exception as e:
        logger.error(f"获取用户订阅失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取订阅失败"
        )

@subscription_router.post("", response_model=SubscriptionResponse, summary="添加或更新订阅")
async def update_subscription(
    subscription_data: SubscriptionUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """添加新的币种订阅或更新现有订阅"""
    try:
        success = db.update_subscription(
            user_id=current_user['id'],
            symbol=subscription_data.symbol,
            is_enabled=subscription_data.is_enabled,
            alert_settings=subscription_data.alert_settings,
            volume_alert_enabled=subscription_data.volume_alert_enabled,
            volume_threshold=subscription_data.volume_threshold,
            volume_timeframe=subscription_data.volume_timeframe,
            volume_analysis_timeframe=getattr(subscription_data, 'volume_analysis_timeframe', '5m'),
            notification_interval=getattr(subscription_data, 'notification_interval', 120)
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="订阅更新失败"
            )
        
        # 获取更新后的订阅信息
        subscriptions = db.get_user_subscriptions(current_user['id'])
        for sub in subscriptions:
            if sub['symbol'] == subscription_data.symbol:
                return SubscriptionResponse(**sub)
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订阅不存在"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新订阅失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="订阅更新失败"
        )

@subscription_router.delete("/{symbol}", summary="删除订阅")
async def remove_subscription(
    symbol: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """删除指定币种的订阅"""
    try:
        success = db.remove_subscription(current_user['id'], symbol.upper())
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="订阅不存在"
            )
        
        return {"success": True, "message": f"已删除 {symbol.upper()} 的订阅"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除订阅失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除订阅失败"
        )

@subscription_router.put("/{symbol}/toggle", summary="切换订阅状态")
async def toggle_subscription(
    symbol: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """切换指定币种订阅的启用/禁用状态"""
    try:
        # 获取当前订阅状态
        subscriptions = db.get_user_subscriptions(current_user['id'])
        current_sub = None
        for sub in subscriptions:
            if sub['symbol'] == symbol.upper():
                current_sub = sub
                break
        
        if not current_sub:
            # 如果不存在，创建新订阅（默认启用）
            success = db.update_subscription(
                user_id=current_user['id'],
                symbol=symbol.upper(),
                is_enabled=True
            )
            new_status = True
        else:
            # 切换状态
            new_status = not current_sub['is_enabled']
            success = db.update_subscription(
                user_id=current_user['id'],
                symbol=symbol.upper(),
                is_enabled=new_status,
                alert_settings=current_sub['alert_settings']
            )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="状态切换失败"
            )
        
        return {
            "success": True,
            "symbol": symbol.upper(),
            "is_enabled": new_status,
            "message": f"{symbol.upper()} 订阅已{'启用' if new_status else '禁用'}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"切换订阅状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="状态切换失败"
        )
