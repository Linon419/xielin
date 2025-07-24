"""
用户认证和JWT处理模块
"""

import jwt
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
import re
import logging

logger = logging.getLogger(__name__)

# JWT配置
import os
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-for-development-only-change-in-production')  # 开发环境使用固定密钥
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# HTTP Bearer认证
security = HTTPBearer()

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    confirm_password: str
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 20:
            raise ValueError('用户名长度必须在3-20个字符之间')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('用户名只能包含字母、数字和下划线')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('密码长度至少6个字符')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('密码必须包含至少一个字母')
        if not re.search(r'\d', v):
            raise ValueError('密码必须包含至少一个数字')
        return v
    
    @validator('confirm_password')
    def validate_confirm_password(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('两次输入的密码不一致')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: str
    last_login: Optional[str]
    avatar_url: Optional[str]
    preferences: Dict[str, Any]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse

class AuthManager:
    def __init__(self):
        self.secret_key = JWT_SECRET_KEY
        self.algorithm = JWT_ALGORITHM
        self.expiration_hours = JWT_EXPIRATION_HOURS
    
    def create_access_token(self, user_data: Dict[str, Any]) -> str:
        """创建JWT访问令牌"""
        try:
            # 设置过期时间
            expire = datetime.utcnow() + timedelta(hours=self.expiration_hours)
            
            # 创建JWT payload
            payload = {
                'user_id': user_data['id'],
                'username': user_data['username'],
                'email': user_data['email'],
                'exp': expire,
                'iat': datetime.utcnow(),
                'type': 'access_token'
            }
            
            # 生成JWT token
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            
            logger.info(f"为用户 {user_data['username']} 创建访问令牌")
            return token
            
        except Exception as e:
            logger.error(f"创建访问令牌失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="令牌创建失败"
            )
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """验证JWT令牌"""
        try:
            logger.info(f"开始验证token，密钥前缀: {self.secret_key[:10]}...")

            # 解码JWT token
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            logger.info(f"Token解码成功，payload: {payload}")

            # 检查token类型
            if payload.get('type') != 'access_token':
                logger.error(f"无效的令牌类型: {payload.get('type')}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的令牌类型"
                )

            # 检查是否过期
            if datetime.utcnow() > datetime.fromtimestamp(payload['exp']):
                logger.error(f"令牌已过期: {datetime.fromtimestamp(payload['exp'])}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="令牌已过期"
                )

            return payload
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌已过期"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌"
            )
        except Exception as e:
            logger.error(f"令牌验证失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌验证失败"
            )
    
    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
        """获取当前用户信息（依赖注入）"""
        try:
            logger.info(f"收到认证请求，token前缀: {credentials.credentials[:20]}...")

            # 验证令牌
            payload = self.verify_token(credentials.credentials)
            logger.info(f"Token验证成功，用户ID: {payload.get('user_id')}")

            # 从数据库获取最新用户信息
            from database import db
            user = db.get_user_by_id(payload['user_id'])

            if not user:
                logger.error(f"用户不存在: {payload['user_id']}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="用户不存在"
                )

            logger.info(f"认证成功，用户: {user.get('username')}")
            return user

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取当前用户失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="认证失败"
            )
    
    def optional_current_user(self, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
        """可选的当前用户信息（用于可选认证的接口）"""
        if not credentials:
            return None
        
        try:
            return self.get_current_user(credentials)
        except HTTPException:
            return None
    
    def refresh_token(self, token: str) -> str:
        """刷新访问令牌"""
        try:
            # 验证当前令牌
            payload = self.verify_token(token)
            
            # 从数据库获取用户信息
            from database import db
            user = db.get_user_by_id(payload['user_id'])
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="用户不存在"
                )
            
            # 创建新的访问令牌
            new_token = self.create_access_token(user)
            
            logger.info(f"为用户 {user['username']} 刷新访问令牌")
            return new_token
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"刷新令牌失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="令牌刷新失败"
            )

# 创建全局认证管理器实例
auth_manager = AuthManager()

# 依赖注入函数
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """获取当前认证用户"""
    return auth_manager.get_current_user(credentials)

def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
    """获取可选认证用户"""
    return auth_manager.optional_current_user(credentials)

# 权限检查装饰器
def require_auth(func):
    """需要认证的装饰器"""
    def wrapper(*args, **kwargs):
        current_user = kwargs.get('current_user')
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="需要登录"
            )
        return func(*args, **kwargs)
    return wrapper
