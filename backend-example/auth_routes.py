"""
用户认证相关的API路由
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from typing import Dict, Any
import logging

from auth import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    auth_manager, get_current_user, get_optional_user
)
from database import db
from telegram_service import telegram_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 创建认证路由
auth_router = APIRouter(prefix="/api/auth", tags=["认证"])

@auth_router.post("/register", response_model=TokenResponse, summary="用户注册")
async def register_user(user_data: UserRegister):
    """
    用户注册
    
    - **username**: 用户名（3-20个字符，只能包含字母、数字、下划线）
    - **email**: 邮箱地址
    - **password**: 密码（至少6个字符，包含字母和数字）
    - **confirm_password**: 确认密码
    """
    try:
        # 创建用户
        user_id = db.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password
        )
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名或邮箱已存在"
            )
        
        # 获取用户信息
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="用户创建失败"
            )
        
        # 创建访问令牌
        access_token = auth_manager.create_access_token(user)
        
        # 返回用户信息和令牌
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=auth_manager.expiration_hours * 3600,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户注册失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="注册失败，请稍后重试"
        )

@auth_router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login_user(login_data: UserLogin):
    """
    用户登录
    
    - **username**: 用户名或邮箱
    - **password**: 密码
    """
    try:
        # 验证用户凭据
        user = db.authenticate_user(login_data.username, login_data.password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 创建访问令牌
        access_token = auth_manager.create_access_token(user)
        
        # 返回用户信息和令牌
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=auth_manager.expiration_hours * 3600,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户登录失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败，请稍后重试"
        )

@auth_router.post("/refresh", response_model=Dict[str, str], summary="刷新令牌")
async def refresh_access_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    刷新访问令牌
    
    需要在请求头中提供有效的Bearer令牌
    """
    try:
        # 创建新的访问令牌
        new_token = auth_manager.create_access_token(current_user)
        
        return {
            "access_token": new_token,
            "token_type": "bearer",
            "expires_in": str(auth_manager.expiration_hours * 3600)
        }
        
    except Exception as e:
        logger.error(f"刷新令牌失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="令牌刷新失败"
        )

@auth_router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    获取当前登录用户的信息
    
    需要在请求头中提供有效的Bearer令牌
    """
    return UserResponse(**current_user)

@auth_router.post("/logout", summary="用户登出")
async def logout_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    用户登出
    
    注意：由于使用JWT，实际的令牌失效需要在客户端处理
    """
    try:
        logger.info(f"用户 {current_user['username']} 登出")
        
        return {
            "success": True,
            "message": "登出成功"
        }
        
    except Exception as e:
        logger.error(f"用户登出失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登出失败"
        )

@auth_router.get("/check", summary="检查认证状态")
async def check_auth_status(current_user: Dict[str, Any] = Depends(get_optional_user)):
    """
    检查当前认证状态
    
    可选认证，如果提供了有效令牌则返回用户信息，否则返回未认证状态
    """
    if current_user:
        return {
            "authenticated": True,
            "user": UserResponse(**current_user)
        }
    else:
        return {
            "authenticated": False,
            "user": None
        }

# 用户管理相关路由
user_router = APIRouter(prefix="/api/users", tags=["用户管理"])

@user_router.get("/profile", response_model=UserResponse, summary="获取用户资料")
async def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取当前用户的详细资料"""
    return UserResponse(**current_user)

@user_router.put("/profile", response_model=UserResponse, summary="更新用户资料")
async def update_user_profile(
    profile_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    更新用户资料
    
    可更新字段：
    - avatar_url: 头像URL
    - preferences: 用户偏好设置
    """
    try:
        # 这里可以添加更新用户资料的逻辑
        # 目前返回当前用户信息
        return UserResponse(**current_user)
        
    except Exception as e:
        logger.error(f"更新用户资料失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新失败"
        )

@user_router.get("/stats", summary="获取用户统计信息")
async def get_user_stats(request: Request, current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取用户统计信息"""
    try:
        # 记录请求来源（用于调试）
        user_agent = request.headers.get('user-agent', 'Unknown')
        logger.debug(f"用户统计请求 - 用户: {current_user.get('username', 'Unknown')}, User-Agent: {user_agent}")

        # 获取未读消息数量
        unread_count = db.get_unread_message_count(current_user['id'])
        
        # 获取订阅数量
        subscriptions = db.get_user_subscriptions(current_user['id'])
        subscription_count = len(subscriptions)
        enabled_subscription_count = len([s for s in subscriptions if s['is_enabled']])
        
        return {
            "unread_messages": unread_count,
            "total_subscriptions": subscription_count,
            "enabled_subscriptions": enabled_subscription_count,
            "user_since": current_user['created_at']
        }
        
    except Exception as e:
        logger.error(f"获取用户统计失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取统计信息失败"
        )

# Telegram配置相关的数据模型
class TelegramConfig(BaseModel):
    chat_id: str
    enabled: bool = True

class TelegramConfigResponse(BaseModel):
    chat_id: str
    enabled: bool
    is_verified: bool

@user_router.get("/telegram/config", response_model=TelegramConfigResponse, summary="获取Telegram配置")
async def get_telegram_config(current_user: Dict[str, Any] = Depends(get_current_user)):
    """获取用户的Telegram配置"""
    try:
        return {
            "chat_id": current_user.get('telegram_chat_id', ''),
            "enabled": bool(current_user.get('telegram_enabled', False)),
            "is_verified": bool(current_user.get('telegram_chat_id'))
        }
    except Exception as e:
        logger.error(f"获取Telegram配置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取配置失败"
        )

@user_router.post("/telegram/config", response_model=TelegramConfigResponse, summary="配置Telegram推送")
async def update_telegram_config(
    config: TelegramConfig,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """配置Telegram推送设置"""
    try:
        # 验证Chat ID
        if config.enabled and config.chat_id:
            is_valid = await telegram_service.verify_chat_id(config.chat_id)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的Telegram Chat ID或Bot无法发送消息"
                )

        # 更新数据库
        success = db.update_user_telegram_config(
            user_id=current_user['id'],
            chat_id=config.chat_id if config.enabled else None,
            enabled=config.enabled
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新配置失败"
            )

        return {
            "chat_id": config.chat_id if config.enabled else '',
            "enabled": config.enabled,
            "is_verified": config.enabled and bool(config.chat_id)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新Telegram配置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新配置失败"
        )

@user_router.post("/telegram/test", summary="测试Telegram连接")
async def test_telegram_connection(current_user: Dict[str, Any] = Depends(get_current_user)):
    """测试Telegram连接"""
    try:
        chat_id = current_user.get('telegram_chat_id')
        if not chat_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请先配置Telegram Chat ID"
            )

        success = await telegram_service.verify_chat_id(chat_id)
        if success:
            return {"success": True, "message": "测试消息发送成功"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="测试消息发送失败"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"测试Telegram连接失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="测试连接失败"
        )
