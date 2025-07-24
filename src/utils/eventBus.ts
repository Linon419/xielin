/**
 * 简单的事件总线 - 用于组件间通信
 */

type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  /**
   * 订阅事件
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    const callbacks = this.events.get(event)!;
    callbacks.push(callback);

    // 返回取消订阅的函数
    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 发送事件
   */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`事件处理器错误 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 取消所有事件订阅
   */
  off(event: string): void {
    this.events.delete(event);
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events.clear();
  }
}

// 导出全局事件总线实例
export const eventBus = new EventBus();

// 定义事件类型常量
export const EVENTS = {
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_ADDED: 'subscription_added',
  SUBSCRIPTION_REMOVED: 'subscription_removed',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
} as const;

export type EventType = typeof EVENTS[keyof typeof EVENTS];
