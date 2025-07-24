/**
 * WebSocket Hook - 实时数据连接
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { useAuth } from '../contexts/AuthContext';

export interface WebSocketMessage {
  type: string;
  symbol?: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  sendMessage: (message: any) => void;
  connectionStats: {
    reconnectAttempts: number;
    lastConnected?: Date;
    subscriptions: string[];
  };
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const { state } = useAuth();
  const user = state.user;
  
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date>();
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const connect = useCallback(() => {
    if (!user?.id) {
      console.log('用户未登录，跳过WebSocket连接');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket已连接');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/${user.id}`;
      
      console.log('连接WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket连接成功');
        setIsConnected(true);
        setReconnectAttempts(0);
        setLastConnected(new Date());
        onConnect?.();
        
        // 启动心跳
        startHeartbeat();
        
        message.success('实时数据连接成功');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('收到WebSocket消息:', data);
          
          // 处理不同类型的消息
          switch (data.type) {
            case 'connection':
              console.log('连接状态:', data.message);
              break;
            case 'price_update':
              // 价格更新消息
              onMessage?.(data);
              break;
            case 'volume_alert':
              // 放量提醒
              message.warning(`${data.symbol} ${data.message}`);
              onMessage?.(data);
              break;
            case 'subscription_success':
              console.log('订阅成功:', data.symbol);
              break;
            case 'unsubscription_success':
              console.log('取消订阅成功:', data.symbol);
              break;
            case 'pong':
              // 心跳响应
              console.log('心跳响应');
              break;
            default:
              onMessage?.(data);
          }
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket连接关闭:', event.code, event.reason);
        setIsConnected(false);
        stopHeartbeat();
        onDisconnect?.();
        
        // 自动重连
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`${reconnectInterval}ms后尝试重连 (第${reconnectAttempts + 1}次)`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        } else {
          message.error('实时数据连接失败，请刷新页面重试');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket错误:', error);
        onError?.(error);
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
    }
  }, [user?.id, onMessage, onError, onConnect, onDisconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setSubscriptions([]);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }, []);

  const subscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    
    sendMessage({
      type: 'subscribe',
      symbol: symbol
    });
    
    setSubscriptions(prev => {
      if (!prev.includes(symbol)) {
        return [...prev, symbol];
      }
      return prev;
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((symbol: string) => {
    if (!symbol) return;
    
    sendMessage({
      type: 'unsubscribe',
      symbol: symbol
    });
    
    setSubscriptions(prev => prev.filter(s => s !== symbol));
  }, [sendMessage]);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // 每30秒发送一次心跳
  }, [sendMessage]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  // 用户登录状态变化时重新连接
  useEffect(() => {
    if (user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage,
    connectionStats: {
      reconnectAttempts,
      lastConnected,
      subscriptions
    }
  };
};
