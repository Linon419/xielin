"""
统一错误处理中间件
"""

import logging
import traceback
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import asyncio

logger = logging.getLogger(__name__)

class ErrorHandler:
    """统一错误处理器"""
    
    @staticmethod
    def format_error_response(
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ) -> Dict[str, Any]:
        """格式化错误响应"""
        response = {
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "timestamp": "2025-01-24T00:00:00Z"  # 简化时间戳
            }
        }
        
        if details:
            response["error"]["details"] = details
            
        return response
    
    @staticmethod
    async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        """处理HTTP异常"""
        logger.warning(f"HTTP异常 {exc.status_code}: {exc.detail} - URL: {request.url}")
        
        error_messages = {
            400: "请求参数错误",
            401: "未授权访问",
            403: "禁止访问",
            404: "资源不存在",
            422: "请求数据验证失败",
            429: "请求过于频繁",
            500: "服务器内部错误"
        }
        
        message = error_messages.get(exc.status_code, exc.detail)
        
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorHandler.format_error_response(
                error_code=f"HTTP_{exc.status_code}",
                message=message,
                details={"original_message": exc.detail} if exc.detail != message else None,
                status_code=exc.status_code
            )
        )
    
    @staticmethod
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        """处理请求验证错误"""
        logger.warning(f"请求验证错误: {exc.errors()} - URL: {request.url}")
        
        # 格式化验证错误信息
        formatted_errors = []
        for error in exc.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            formatted_errors.append({
                "field": field,
                "message": error["msg"],
                "type": error["type"]
            })
        
        return JSONResponse(
            status_code=422,
            content=ErrorHandler.format_error_response(
                error_code="VALIDATION_ERROR",
                message="请求数据验证失败",
                details={"validation_errors": formatted_errors},
                status_code=422
            )
        )
    
    @staticmethod
    async def handle_general_exception(request: Request, exc: Exception) -> JSONResponse:
        """处理一般异常"""
        logger.error(f"未处理的异常: {type(exc).__name__}: {str(exc)} - URL: {request.url}")
        logger.error(f"异常堆栈: {traceback.format_exc()}")
        
        # 根据异常类型提供更友好的错误信息
        if isinstance(exc, asyncio.TimeoutError):
            message = "请求超时，请稍后重试"
            error_code = "TIMEOUT_ERROR"
        elif isinstance(exc, ConnectionError):
            message = "网络连接错误，请检查网络状态"
            error_code = "CONNECTION_ERROR"
        elif "ccxt" in str(type(exc)).lower():
            message = "交易所API调用失败，请稍后重试"
            error_code = "EXCHANGE_API_ERROR"
        else:
            message = "服务器内部错误，请稍后重试"
            error_code = "INTERNAL_ERROR"
        
        return JSONResponse(
            status_code=500,
            content=ErrorHandler.format_error_response(
                error_code=error_code,
                message=message,
                details={
                    "exception_type": type(exc).__name__,
                    "exception_message": str(exc)
                } if logger.level <= logging.DEBUG else None,
                status_code=500
            )
        )

class RetryHandler:
    """重试处理器"""
    
    @staticmethod
    async def retry_with_backoff(
        func,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        backoff_factor: float = 2.0
    ):
        """带退避的重试机制"""
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(func):
                    return await func()
                else:
                    return func()
            except Exception as e:
                last_exception = e
                
                if attempt == max_retries:
                    break
                
                # 计算延迟时间
                delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                logger.warning(f"操作失败，{delay}秒后重试 (第{attempt + 1}次): {str(e)}")
                await asyncio.sleep(delay)
        
        # 所有重试都失败了
        logger.error(f"操作在{max_retries}次重试后仍然失败: {str(last_exception)}")
        raise last_exception

class CircuitBreaker:
    """熔断器"""
    
    def __init__(self, failure_threshold: int = 5, timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    async def call(self, func, *args, **kwargs):
        """通过熔断器调用函数"""
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
            else:
                raise HTTPException(
                    status_code=503,
                    detail="服务暂时不可用，请稍后重试"
                )
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # 成功调用，重置计数器
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
            
            return result
            
        except Exception as e:
            self._record_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        """判断是否应该尝试重置熔断器"""
        if self.last_failure_time is None:
            return True
        
        import time
        return time.time() - self.last_failure_time >= self.timeout
    
    def _record_failure(self):
        """记录失败"""
        import time
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"熔断器开启，失败次数: {self.failure_count}")

# 全局熔断器实例
exchange_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60.0)

def setup_error_handlers(app):
    """设置错误处理器"""
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return await ErrorHandler.handle_http_exception(request, exc)
    
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
        return await ErrorHandler.handle_http_exception(request, HTTPException(status_code=exc.status_code, detail=exc.detail))
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return await ErrorHandler.handle_validation_error(request, exc)
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return await ErrorHandler.handle_general_exception(request, exc)
