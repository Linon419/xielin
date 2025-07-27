"""
数据库模型和初始化
使用SQLite数据库存储用户信息、消息和订阅设置
"""

import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: str = None):
        # 支持环境变量配置数据库路径
        if db_path is None:
            import os
            db_path = os.getenv('DATABASE_PATH', '/app/data/crypto_platform.db')

        self.db_path = db_path
        # 确保数据目录存在
        import os
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.init_database()
    
    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 使结果可以像字典一样访问
        return conn
    
    def init_database(self):
        """初始化数据库表"""
        conn = self.get_connection()
        try:
            # 创建用户表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    salt VARCHAR(32) NOT NULL,
                    telegram_chat_id VARCHAR(50),  -- Telegram聊天ID
                    telegram_enabled BOOLEAN DEFAULT 0,  -- Telegram推送开关
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    last_login TIMESTAMP,
                    avatar_url VARCHAR(255),
                    preferences TEXT  -- JSON格式存储用户偏好设置
                )
            ''')
            
            # 创建消息表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    message_type VARCHAR(50) NOT NULL,  -- 'price_alert', 'strategy_signal', 'system_notice'
                    symbol VARCHAR(20),  -- 相关币种，可为空
                    priority INTEGER DEFAULT 1,  -- 1:低, 2:中, 3:高
                    data TEXT,  -- JSON格式存储额外数据
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,  -- 消息过期时间
                    is_global BOOLEAN DEFAULT 0  -- 是否为全局消息
                )
            ''')
            
            # 创建用户消息关联表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    message_id INTEGER NOT NULL,
                    is_read BOOLEAN DEFAULT 0,
                    read_at TIMESTAMP,
                    is_deleted BOOLEAN DEFAULT 0,
                    deleted_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                    UNIQUE(user_id, message_id)
                )
            ''')
            
            # 创建用户币种订阅表
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    symbol VARCHAR(20) NOT NULL,
                    is_enabled BOOLEAN DEFAULT 1,
                    alert_settings TEXT,  -- JSON格式存储告警设置
                    volume_alert_enabled BOOLEAN DEFAULT 0,  -- 放量提醒开关
                    volume_threshold REAL DEFAULT 2.0,      -- 放量倍数阈值
                    volume_timeframe VARCHAR(10) DEFAULT '5m', -- 检测时间周期
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE(user_id, symbol)
                )
            ''')
            
            # 创建用户会话表（用于JWT token管理）
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash VARCHAR(255) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_agent VARCHAR(500),
                    ip_address VARCHAR(45),
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            ''')
            
            # 创建索引以提高查询性能
            conn.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_messages_symbol ON messages(symbol)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages(user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_messages_is_read ON user_messages(is_read)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_symbol ON user_subscriptions(symbol)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)')
            
            # 数据库迁移：为现有订阅表添加放量提醒字段
            try:
                # 检查是否已存在新字段
                cursor = conn.execute("PRAGMA table_info(user_subscriptions)")
                columns = [column[1] for column in cursor.fetchall()]

                if 'volume_alert_enabled' not in columns:
                    logger.info("执行数据库迁移：添加放量提醒字段")
                    conn.execute('ALTER TABLE user_subscriptions ADD COLUMN volume_alert_enabled BOOLEAN DEFAULT 0')
                    conn.execute('ALTER TABLE user_subscriptions ADD COLUMN volume_threshold REAL DEFAULT 2.0')
                    conn.execute('ALTER TABLE user_subscriptions ADD COLUMN volume_timeframe VARCHAR(10) DEFAULT "5m"')
                    logger.info("放量提醒字段添加完成")
            except Exception as e:
                logger.warning(f"数据库迁移失败（可能字段已存在）: {e}")

            # 数据库迁移：为用户表添加Telegram字段
            try:
                cursor = conn.execute("PRAGMA table_info(users)")
                columns = [column[1] for column in cursor.fetchall()]

                if 'telegram_chat_id' not in columns:
                    logger.info("执行数据库迁移：添加Telegram字段")
                    conn.execute('ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(50)')
                    conn.execute('ALTER TABLE users ADD COLUMN telegram_enabled BOOLEAN DEFAULT 0')
                    logger.info("Telegram字段添加完成")
            except Exception as e:
                logger.warning(f"Telegram字段迁移失败（可能字段已存在）: {e}")

            # 数据库迁移：为订阅表添加统计周期字段
            try:
                cursor = conn.execute("PRAGMA table_info(user_subscriptions)")
                columns = [column[1] for column in cursor.fetchall()]

                if 'volume_analysis_timeframe' not in columns:
                    logger.info("执行数据库迁移：添加统计周期字段")
                    conn.execute('ALTER TABLE user_subscriptions ADD COLUMN volume_analysis_timeframe VARCHAR(10) DEFAULT "5m"')
                    logger.info("统计周期字段添加完成")
            except Exception as e:
                logger.warning(f"统计周期字段迁移失败（可能字段已存在）: {e}")

            # 数据库迁移：为订阅表添加通知间隔字段
            try:
                cursor = conn.execute("PRAGMA table_info(user_subscriptions)")
                columns = [column[1] for column in cursor.fetchall()]

                if 'notification_interval' not in columns:
                    logger.info("执行数据库迁移：添加通知间隔字段")
                    conn.execute('ALTER TABLE user_subscriptions ADD COLUMN notification_interval INTEGER DEFAULT 120')
                    logger.info("通知间隔字段添加完成")
            except Exception as e:
                logger.warning(f"通知间隔字段迁移失败（可能字段已存在）: {e}")

            conn.commit()
            logger.info("数据库初始化完成")
            
        except Exception as e:
            logger.error(f"数据库初始化失败: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def hash_password(self, password: str, salt: str = None) -> tuple:
        """密码哈希处理"""
        if salt is None:
            salt = secrets.token_hex(16)
        
        # 使用PBKDF2进行密码哈希
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # 迭代次数
        ).hex()
        
        return password_hash, salt
    
    def verify_password(self, password: str, password_hash: str, salt: str) -> bool:
        """验证密码"""
        computed_hash, _ = self.hash_password(password, salt)
        return computed_hash == password_hash
    
    def create_user(self, username: str, email: str, password: str) -> Optional[int]:
        """创建新用户"""
        conn = self.get_connection()
        try:
            # 检查用户名和邮箱是否已存在
            cursor = conn.execute(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                (username, email)
            )
            if cursor.fetchone():
                return None  # 用户已存在
            
            # 哈希密码
            password_hash, salt = self.hash_password(password)
            
            # 插入新用户
            cursor = conn.execute('''
                INSERT INTO users (username, email, password_hash, salt, preferences)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, email, password_hash, salt, json.dumps({})))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            logger.info(f"创建用户成功: {username} (ID: {user_id})")
            return user_id
            
        except Exception as e:
            logger.error(f"创建用户失败: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """用户认证"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT id, username, email, password_hash, salt, is_active, preferences,
                       datetime(created_at, 'localtime') as created_at,
                       datetime(last_login, 'localtime') as last_login,
                       avatar_url, telegram_chat_id, telegram_enabled
                FROM users
                WHERE (username = ? OR email = ?) AND is_active = 1
            ''', (username, username))
            
            user = cursor.fetchone()
            if not user:
                return None
            
            # 验证密码
            if not self.verify_password(password, user['password_hash'], user['salt']):
                return None
            
            # 更新最后登录时间
            conn.execute(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                (user['id'],)
            )
            conn.commit()
            
            return {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'created_at': user['created_at'],
                'last_login': user['last_login'],
                'avatar_url': user['avatar_url'],
                'preferences': json.loads(user['preferences'] or '{}'),
                'telegram_chat_id': user['telegram_chat_id'],
                'telegram_enabled': bool(user['telegram_enabled'])
            }
            
        except Exception as e:
            logger.error(f"用户认证失败: {e}")
            return None
        finally:
            conn.close()
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """根据ID获取用户信息"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT id, username, email,
                       datetime(created_at, 'localtime') as created_at,
                       datetime(last_login, 'localtime') as last_login,
                       avatar_url, preferences, telegram_chat_id, telegram_enabled
                FROM users
                WHERE id = ? AND is_active = 1
            ''', (user_id,))
            
            user = cursor.fetchone()
            if user:
                return {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'created_at': user['created_at'],
                    'last_login': user['last_login'],
                    'avatar_url': user['avatar_url'],
                    'preferences': json.loads(user['preferences'] or '{}'),
                    'telegram_chat_id': user['telegram_chat_id'],
                    'telegram_enabled': bool(user['telegram_enabled'])
                }
            return None
            
        except Exception as e:
            logger.error(f"获取用户信息失败: {e}")
            return None
        finally:
            conn.close()

    def create_message(self, title: str, content: str, message_type: str,
                      symbol: str = None, priority: int = 1, data: Dict = None,
                      expires_at: datetime = None, is_global: bool = False) -> Optional[int]:
        """创建消息"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                INSERT INTO messages (title, content, message_type, symbol, priority, data, expires_at, is_global)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (title, content, message_type, symbol, priority,
                  json.dumps(data) if data else None, expires_at, is_global))

            message_id = cursor.lastrowid
            conn.commit()

            logger.info(f"创建消息成功: {title} (ID: {message_id})")
            return message_id

        except Exception as e:
            logger.error(f"创建消息失败: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

    def get_user_messages(self, user_id: int, limit: int = 50, offset: int = 0,
                         unread_only: bool = False, symbol: str = None) -> List[Dict[str, Any]]:
        """获取用户消息列表"""
        conn = self.get_connection()
        try:
            where_conditions = ['um.user_id = ?', 'um.is_deleted = 0']
            params = [user_id]

            if unread_only:
                where_conditions.append('um.is_read = 0')

            if symbol:
                where_conditions.append('m.symbol = ?')
                params.append(symbol)

            where_clause = ' AND '.join(where_conditions)
            params.extend([limit, offset])

            cursor = conn.execute(f'''
                SELECT m.id, m.title, m.content, m.message_type, m.symbol, m.priority, m.data,
                       datetime(m.created_at, 'localtime') as created_at,
                       datetime(m.expires_at, 'localtime') as expires_at,
                       m.is_global, um.is_read,
                       datetime(um.read_at, 'localtime') as read_at,
                       datetime(um.created_at, 'localtime') as received_at
                FROM messages m
                JOIN user_messages um ON m.id = um.message_id
                WHERE {where_clause}
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            ''', params)

            messages = []
            for row in cursor.fetchall():
                message = dict(row)
                if message['data']:
                    message['data'] = json.loads(message['data'])
                messages.append(message)

            return messages

        except Exception as e:
            logger.error(f"获取用户消息失败: {e}")
            return []
        finally:
            conn.close()

    def mark_message_read(self, user_id: int, message_id: int) -> bool:
        """标记消息为已读"""
        conn = self.get_connection()
        try:
            conn.execute('''
                UPDATE user_messages
                SET is_read = 1, read_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND message_id = ?
            ''', (user_id, message_id))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"标记消息已读失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def delete_user_message(self, user_id: int, message_id: int) -> bool:
        """删除用户消息"""
        conn = self.get_connection()
        try:
            conn.execute('''
                UPDATE user_messages
                SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND message_id = ?
            ''', (user_id, message_id))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"删除用户消息失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_user_subscriptions(self, user_id: int) -> List[Dict[str, Any]]:
        """获取用户币种订阅列表"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT symbol, is_enabled, alert_settings, volume_alert_enabled,
                       volume_threshold, volume_timeframe, volume_analysis_timeframe,
                       notification_interval,
                       datetime(created_at, 'localtime') as created_at,
                       datetime(updated_at, 'localtime') as updated_at
                FROM user_subscriptions
                WHERE user_id = ?
                ORDER BY symbol
            ''', (user_id,))

            subscriptions = []
            for row in cursor.fetchall():
                subscription = dict(row)
                if subscription['alert_settings']:
                    subscription['alert_settings'] = json.loads(subscription['alert_settings'])

                # 为旧记录提供默认值
                if 'volume_analysis_timeframe' not in subscription or subscription['volume_analysis_timeframe'] is None:
                    subscription['volume_analysis_timeframe'] = '5m'

                if 'notification_interval' not in subscription or subscription['notification_interval'] is None:
                    subscription['notification_interval'] = 120

                subscriptions.append(subscription)

            return subscriptions

        except Exception as e:
            logger.error(f"获取用户订阅失败: {e}")
            return []
        finally:
            conn.close()

    def update_subscription(self, user_id: int, symbol: str, is_enabled: bool = True,
                           alert_settings: Dict = None, volume_alert_enabled: bool = False,
                           volume_threshold: float = 2.0, volume_timeframe: str = "5m",
                           volume_analysis_timeframe: str = "5m", notification_interval: int = 120) -> bool:
        """更新或创建币种订阅"""
        conn = self.get_connection()
        try:
            # 使用UPSERT操作
            conn.execute('''
                INSERT INTO user_subscriptions (user_id, symbol, is_enabled, alert_settings,
                                               volume_alert_enabled, volume_threshold, volume_timeframe,
                                               volume_analysis_timeframe, notification_interval, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, symbol) DO UPDATE SET
                    is_enabled = excluded.is_enabled,
                    alert_settings = excluded.alert_settings,
                    volume_alert_enabled = excluded.volume_alert_enabled,
                    volume_threshold = excluded.volume_threshold,
                    volume_timeframe = excluded.volume_timeframe,
                    volume_analysis_timeframe = excluded.volume_analysis_timeframe,
                    notification_interval = excluded.notification_interval,
                    updated_at = CURRENT_TIMESTAMP
            ''', (user_id, symbol.upper(), is_enabled,
                  json.dumps(alert_settings) if alert_settings else None,
                  volume_alert_enabled, volume_threshold, volume_timeframe, volume_analysis_timeframe, notification_interval))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"更新订阅失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def remove_subscription(self, user_id: int, symbol: str) -> bool:
        """删除币种订阅"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                DELETE FROM user_subscriptions
                WHERE user_id = ? AND symbol = ?
            ''', (user_id, symbol.upper()))

            conn.commit()
            return cursor.rowcount > 0

        except Exception as e:
            logger.error(f"删除订阅失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_volume_alert_subscriptions(self) -> List[Dict[str, Any]]:
        """获取所有启用放量提醒的订阅"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT user_id, symbol, volume_threshold, volume_timeframe, volume_analysis_timeframe, notification_interval
                FROM user_subscriptions
                WHERE volume_alert_enabled = 1 AND is_enabled = 1
            ''')

            subscriptions = []
            for row in cursor.fetchall():
                subscriptions.append({
                    'user_id': row[0],
                    'symbol': row[1],
                    'volume_threshold': row[2] or 2.0,  # 默认2倍
                    'volume_timeframe': row[3] or '5m',  # 默认5分钟
                    'volume_analysis_timeframe': row[4] or '5m',  # 默认5分钟
                    'notification_interval': row[5] or 120  # 默认2分钟
                })

            return subscriptions

        except Exception as e:
            logger.error(f"获取放量提醒订阅失败: {e}")
            return []
        finally:
            conn.close()

    def update_user_telegram_config(self, user_id: int, chat_id: str = None, enabled: bool = False) -> bool:
        """更新用户Telegram配置"""
        conn = self.get_connection()
        try:
            conn.execute('''
                UPDATE users
                SET telegram_chat_id = ?, telegram_enabled = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (chat_id, enabled, user_id))

            conn.commit()
            return True

        except Exception as e:
            logger.error(f"更新Telegram配置失败: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_users_with_telegram_enabled(self) -> List[Dict[str, Any]]:
        """获取启用了Telegram推送的用户列表"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT id, username, telegram_chat_id, telegram_enabled
                FROM users
                WHERE telegram_enabled = 1 AND telegram_chat_id IS NOT NULL
            ''')

            users = []
            for row in cursor.fetchall():
                users.append(dict(row))

            return users

        except Exception as e:
            logger.error(f"获取Telegram用户列表失败: {e}")
            return []
        finally:
            conn.close()

    def create_message(self, title: str, content: str, message_type: str = 'user_message',
                      symbol: str = None, priority: int = 1, data: Dict = None,
                      expires_at: datetime = None, is_global: bool = False) -> Optional[int]:
        """创建消息"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                INSERT INTO messages (title, content, message_type, symbol, priority, data, expires_at, is_global)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (title, content, message_type, symbol, priority,
                  json.dumps(data) if data else None, expires_at, is_global))

            message_id = cursor.lastrowid
            conn.commit()
            return message_id

        except Exception as e:
            logger.error(f"创建消息失败: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

    def get_message_by_id(self, message_id: int) -> Optional[Dict[str, Any]]:
        """根据ID获取消息"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT id, title, content, message_type, symbol, priority, data,
                       created_at, expires_at, is_global
                FROM messages
                WHERE id = ?
            ''', (message_id,))

            row = cursor.fetchone()
            if row:
                message = dict(row)
                if message['data']:
                    message['data'] = json.loads(message['data'])
                return message
            return None

        except Exception as e:
            logger.error(f"获取消息失败: {e}")
            return None
        finally:
            conn.close()

    def get_unread_message_count(self, user_id: int) -> int:
        """获取未读消息数量"""
        conn = self.get_connection()
        try:
            cursor = conn.execute('''
                SELECT COUNT(*) as count
                FROM user_messages
                WHERE user_id = ? AND is_read = 0 AND is_deleted = 0
            ''', (user_id,))

            result = cursor.fetchone()
            return result['count'] if result else 0

        except Exception as e:
            logger.error(f"获取未读消息数量失败: {e}")
            return 0
        finally:
            conn.close()

# 创建全局数据库实例
db = Database()
