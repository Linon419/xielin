/**
 * 用户认证相关的类型定义
 */

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  last_login?: string;
  avatar_url?: string;
  preferences: Record<string, any>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface Message {
  id: number;
  title: string;
  content: string;
  message_type: 'price_alert' | 'strategy_signal' | 'system_notice' | 'user_message';
  symbol?: string;
  priority: 1 | 2 | 3;
  data?: Record<string, any>;
  created_at: string;
  expires_at?: string;
  is_global: boolean;
  is_read: boolean;
  read_at?: string;
  received_at: string;
}

export interface Subscription {
  symbol: string;
  is_enabled: boolean;
  alert_settings?: Record<string, any>;
  volume_alert_enabled: boolean;
  volume_threshold: number;
  volume_timeframe: string;
  created_at: string;
  updated_at: string;
}

export interface MessageStats {
  total_messages: number;
  unread_messages: number;
  read_messages: number;
  type_statistics: Record<string, {
    total: number;
    unread: number;
  }>;
}

export interface UserStats {
  unread_messages: number;
  total_subscriptions: number;
  enabled_subscriptions: number;
  user_since: string;
}
