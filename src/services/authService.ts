/**
 * 用户认证服务
 */

import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  Message, 
  Subscription, 
  MessageStats, 
  UserStats 
} from '../types/auth';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

class AuthService {
  private token: string | null = null;

  constructor() {
    // 从localStorage恢复token
    this.token = localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AuthService] API错误:', response.status, response.statusText, errorData);

      if (response.status === 403) {
        throw new Error('Not authenticated');
      }

      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    const result = await this.handleResponse<AuthResponse>(response);

    // 保存token
    this.token = result.access_token;
    localStorage.setItem('auth_token', this.token);

    return result;
  }

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    const result = await this.handleResponse<AuthResponse>(response);
    
    // 保存token
    this.token = result.access_token;
    localStorage.setItem('auth_token', this.token);
    
    return result;
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 清除本地存储
      this.token = null;
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<User>(response);
  }

  /**
   * 检查认证状态
   */
  async checkAuthStatus(): Promise<{ authenticated: boolean; user: User | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/check`, {
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<{ authenticated: boolean; user: User | null }>(response);
    } catch (error) {
      return { authenticated: false, user: null };
    }
  }

  /**
   * 刷新token
   */
  async refreshToken(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<{ access_token: string }>(response);
    
    // 更新token
    this.token = result.access_token;
    localStorage.setItem('auth_token', this.token);
    
    return result.access_token;
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<UserStats> {
    // 检查是否有有效的token
    if (!this.token) {
      throw new Error('未认证：缺少访问令牌');
    }

    const response = await fetch(`${API_BASE_URL}/users/stats`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<UserStats>(response);
  }

  /**
   * 获取用户消息列表
   */
  async getMessages(params: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
    symbol?: string;
  } = {}): Promise<Message[]> {
    const searchParams = new URLSearchParams();
    
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());
    if (params.unread_only) searchParams.append('unread_only', 'true');
    if (params.symbol) searchParams.append('symbol', params.symbol);

    const response = await fetch(`${API_BASE_URL}/messages?${searchParams}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<Message[]>(response);
  }

  /**
   * 标记消息为已读
   */
  async markMessageRead(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/read`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  /**
   * 删除消息
   */
  async deleteMessage(messageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  /**
   * 标记所有消息为已读
   */
  async markAllMessagesRead(symbol?: string): Promise<void> {
    const searchParams = new URLSearchParams();
    if (symbol) searchParams.append('symbol', symbol);

    const response = await fetch(`${API_BASE_URL}/messages/mark-all-read?${searchParams}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  /**
   * 获取消息统计
   */
  async getMessageStats(): Promise<MessageStats> {
    // 检查是否有有效的token
    if (!this.token) {
      throw new Error('未认证：缺少访问令牌');
    }

    const response = await fetch(`${API_BASE_URL}/messages/stats`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<MessageStats>(response);
  }

  /**
   * 获取用户订阅列表
   */
  async getSubscriptions(): Promise<Subscription[]> {
    const response = await fetch(`${API_BASE_URL}/subscriptions`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<Subscription[]>(response);
  }

  /**
   * 更新订阅
   */
  async updateSubscription(data: {
    symbol: string;
    is_enabled: boolean;
    alert_settings?: Record<string, any>;
    volume_alert_enabled?: boolean;
    volume_threshold?: number;
    volume_timeframe?: string;
    volume_analysis_timeframe?: string;
    notification_interval?: number;
  }): Promise<Subscription> {
    const response = await fetch(`${API_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<Subscription>(response);
  }

  /**
   * 删除订阅
   */
  async removeSubscription(symbol: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${symbol}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  /**
   * 切换订阅状态
   */
  async toggleSubscription(symbol: string): Promise<{
    success: boolean;
    symbol: string;
    is_enabled: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${symbol}/toggle`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<{
      success: boolean;
      symbol: string;
      is_enabled: boolean;
      message: string;
    }>(response);
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * 获取当前token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * 清除token
   */
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Telegram配置相关方法
  async getTelegramConfig(): Promise<{
    chat_id: string;
    enabled: boolean;
    is_verified: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/users/telegram/config`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateTelegramConfig(config: {
    chat_id: string;
    enabled: boolean;
  }): Promise<{
    chat_id: string;
    enabled: boolean;
    is_verified: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/users/telegram/config`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(config),
    });

    return this.handleResponse(response);
  }

  async testTelegramConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/users/telegram/test`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }
}

// 创建全局实例
export const authService = new AuthService();
export default authService;
