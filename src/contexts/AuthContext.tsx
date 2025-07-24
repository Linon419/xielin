/**
 * 用户认证上下文
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { message } from 'antd';
import { User, AuthState, LoginRequest, RegisterRequest } from '../types/auth';
import authService from '../services/authService';

// 认证状态的Action类型
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User };

// 初始状态
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
  error: null,
};

// Reducer函数
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    
    default:
      return state;
  }
}

// 上下文类型
interface AuthContextType {
  state: AuthState;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

// 创建上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider组件
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const authStatus = await authService.checkAuthStatus();
        
        if (authStatus.authenticated && authStatus.user) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: authStatus.user,
              token: authService.getToken() || '',
            },
          });
        } else {
          // 如果未认证，确保清除所有token和用户数据
          authService.clearToken();
          dispatch({ type: 'LOGOUT' });
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        dispatch({ type: 'LOGOUT' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initAuth();
  }, []);

  // 登录
  const login = async (data: LoginRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await authService.login(data);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          token: response.access_token,
        },
      });

      message.success('登录成功！');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      message.error(errorMessage);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 注册
  const register = async (data: RegisterRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await authService.register(data);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          token: response.access_token,
        },
      });

      message.success('注册成功！欢迎加入我们！');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '注册失败';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      message.error(errorMessage);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 登出
  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      message.success('已安全登出');
    } catch (error) {
      console.error('登出失败:', error);
      // 即使登出请求失败，也要清除本地状态
      dispatch({ type: 'LOGOUT' });
    }
  };

  // 刷新用户信息
  const refreshUser = async () => {
    try {
      if (!state.isAuthenticated) return;
      
      const user = await authService.getCurrentUser();
      dispatch({ type: 'UPDATE_USER', payload: user });
    } catch (error) {
      console.error('刷新用户信息失败:', error);
      // 如果刷新失败，可能是token过期，尝试登出
      if (error instanceof Error && error.message.includes('401')) {
        await logout();
      }
    }
  };

  // 清除错误
  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
