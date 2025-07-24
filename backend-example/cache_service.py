"""
缓存服务 - 内存缓存和数据优化
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, Optional, Callable, Union
from datetime import datetime, timedelta
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)

class MemoryCache:
    """内存缓存实现"""
    
    def __init__(self, default_ttl: int = 300):  # 默认5分钟过期
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0
        }
    
    def _is_expired(self, item: Dict[str, Any]) -> bool:
        """检查缓存项是否过期"""
        return time.time() > item['expires_at']
    
    def _cleanup_expired(self):
        """清理过期的缓存项"""
        current_time = time.time()
        expired_keys = [
            key for key, item in self.cache.items()
            if current_time > item['expires_at']
        ]
        
        for key in expired_keys:
            del self.cache[key]
            self.stats['evictions'] += 1
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if key not in self.cache:
            self.stats['misses'] += 1
            return None
        
        item = self.cache[key]
        if self._is_expired(item):
            del self.cache[key]
            self.stats['misses'] += 1
            self.stats['evictions'] += 1
            return None
        
        self.stats['hits'] += 1
        return item['value']
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """设置缓存值"""
        ttl = ttl or self.default_ttl
        expires_at = time.time() + ttl
        
        self.cache[key] = {
            'value': value,
            'expires_at': expires_at,
            'created_at': time.time()
        }
        
        self.stats['sets'] += 1
        
        # 定期清理过期项
        if len(self.cache) % 100 == 0:
            self._cleanup_expired()
    
    def delete(self, key: str) -> bool:
        """删除缓存项"""
        if key in self.cache:
            del self.cache[key]
            self.stats['deletes'] += 1
            return True
        return False
    
    def clear(self) -> None:
        """清空所有缓存"""
        count = len(self.cache)
        self.cache.clear()
        self.stats['deletes'] += count
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'total_items': len(self.cache),
            'hit_rate': round(hit_rate, 2),
            'stats': self.stats.copy()
        }

class CacheManager:
    """缓存管理器"""
    
    def __init__(self):
        # 不同类型数据使用不同的缓存实例和TTL
        self.caches = {
            'price_data': MemoryCache(ttl=30),      # 价格数据30秒
            'market_data': MemoryCache(ttl=60),     # 市场数据1分钟
            'strategy_data': MemoryCache(ttl=300),  # 策略数据5分钟
            'user_data': MemoryCache(ttl=600),      # 用户数据10分钟
            'config_data': MemoryCache(ttl=3600),   # 配置数据1小时
        }
    
    def get_cache(self, cache_type: str) -> MemoryCache:
        """获取指定类型的缓存实例"""
        return self.caches.get(cache_type, self.caches['market_data'])
    
    def get_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """生成缓存键"""
        # 将参数转换为字符串并排序，确保一致性
        key_parts = [prefix]
        
        # 添加位置参数
        for arg in args:
            key_parts.append(str(arg))
        
        # 添加关键字参数（排序确保一致性）
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")
        
        key_string = ":".join(key_parts)
        
        # 如果键太长，使用哈希
        if len(key_string) > 200:
            return f"{prefix}:{hashlib.md5(key_string.encode()).hexdigest()}"
        
        return key_string
    
    def get_all_stats(self) -> Dict[str, Any]:
        """获取所有缓存的统计信息"""
        return {
            cache_type: cache.get_stats()
            for cache_type, cache in self.caches.items()
        }

# 全局缓存管理器
cache_manager = CacheManager()

def cached(cache_type: str = 'market_data', ttl: Optional[int] = None, key_prefix: Optional[str] = None):
    """缓存装饰器"""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 生成缓存键
            prefix = key_prefix or func.__name__
            cache_key = cache_manager.get_cache_key(prefix, *args, **kwargs)
            
            # 尝试从缓存获取
            cache = cache_manager.get_cache(cache_type)
            cached_result = cache.get(cache_key)
            
            if cached_result is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached_result
            
            # 缓存未命中，执行函数
            logger.debug(f"缓存未命中: {cache_key}")
            result = await func(*args, **kwargs)
            
            # 存储到缓存
            cache.set(cache_key, result, ttl)
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # 生成缓存键
            prefix = key_prefix or func.__name__
            cache_key = cache_manager.get_cache_key(prefix, *args, **kwargs)
            
            # 尝试从缓存获取
            cache = cache_manager.get_cache(cache_type)
            cached_result = cache.get(cache_key)
            
            if cached_result is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached_result
            
            # 缓存未命中，执行函数
            logger.debug(f"缓存未命中: {cache_key}")
            result = func(*args, **kwargs)
            
            # 存储到缓存
            cache.set(cache_key, result, ttl)
            
            return result
        
        # 根据函数类型返回对应的包装器
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

class DataAggregator:
    """数据聚合器 - 批量获取和缓存数据"""
    
    def __init__(self):
        self.pending_requests: Dict[str, asyncio.Event] = {}
        self.request_results: Dict[str, Any] = {}
    
    async def get_aggregated_data(self, key: str, fetch_func: Callable, ttl: int = 300):
        """聚合数据获取 - 防止重复请求"""
        cache = cache_manager.get_cache('market_data')
        
        # 先检查缓存
        cached_result = cache.get(key)
        if cached_result is not None:
            return cached_result
        
        # 检查是否有正在进行的请求
        if key in self.pending_requests:
            # 等待正在进行的请求完成
            await self.pending_requests[key].wait()
            return self.request_results.get(key)
        
        # 创建新的请求事件
        self.pending_requests[key] = asyncio.Event()
        
        try:
            # 执行数据获取
            result = await fetch_func()
            
            # 缓存结果
            cache.set(key, result, ttl)
            self.request_results[key] = result
            
            # 通知等待的请求
            self.pending_requests[key].set()
            
            return result
            
        except Exception as e:
            # 发生错误时也要通知等待的请求
            self.pending_requests[key].set()
            raise e
        finally:
            # 清理
            if key in self.pending_requests:
                del self.pending_requests[key]
            if key in self.request_results:
                del self.request_results[key]

# 全局数据聚合器
data_aggregator = DataAggregator()

async def cleanup_caches():
    """定期清理缓存"""
    while True:
        try:
            for cache_type, cache in cache_manager.caches.items():
                cache._cleanup_expired()
                logger.debug(f"清理缓存 {cache_type}: {cache.get_stats()}")
            
            await asyncio.sleep(300)  # 每5分钟清理一次
            
        except Exception as e:
            logger.error(f"缓存清理失败: {e}")
            await asyncio.sleep(60)  # 出错时1分钟后重试
