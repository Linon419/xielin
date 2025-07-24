/**
 * 用户菜单组件
 */

import React, { useState, useEffect } from 'react';
import { 
  Avatar, 
  Dropdown, 
  Space, 
  Typography, 
  Badge,
  Button,
  Spin
} from 'antd';
import { 
  UserOutlined, 
  MessageOutlined, 
  SettingOutlined,
  LogoutOutlined,
  LoginOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import AuthModal from './AuthModal';
import SettingsModal from '../SettingsModal';

const { Text } = Typography;

const UserMenu: React.FC = () => {
  const { state, logout } = useAuth();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 获取未读消息数量
  useEffect(() => {
    const fetchUnreadCount = async () => {
      // 严格检查认证状态：必须已认证、有用户信息、有token、且不在加载中
      if (state.isAuthenticated && state.user && state.token && !state.loading) {
        try {
          // 双重检查：确保authService也有token
          if (!authService.getToken()) {
            console.debug('AuthService中没有token，跳过用户统计获取');
            setUnreadCount(0);
            return;
          }

          const stats = await authService.getUserStats();
          setUnreadCount(stats.unread_messages);
        } catch (error) {
          // 如果是认证相关错误，不记录错误日志
          if (error instanceof Error && (
            error.message.includes('401') ||
            error.message.includes('未认证') ||
            error.message.includes('缺少访问令牌')
          )) {
            console.debug('认证状态异常，跳过用户统计获取');
          } else {
            console.error('获取未读消息数量失败:', error);
          }
          // 如果获取失败，重置未读数量
          setUnreadCount(0);
        }
      } else {
        // 未认证时重置未读数量
        setUnreadCount(0);
      }
    };

    // 只有在认证状态完全稳定且已认证时才开始获取数据
    if (!state.loading && state.isAuthenticated && state.user && state.token) {
      fetchUnreadCount();

      // 每2分钟更新一次未读消息数量（进一步减少频率）
      const interval = setInterval(fetchUnreadCount, 120000);
      return () => clearInterval(interval);
    } else if (!state.loading && !state.isAuthenticated) {
      // 如果确认未认证，重置未读数量
      setUnreadCount(0);
    }
  }, [state.isAuthenticated, state.user, state.token, state.loading]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMessages = () => {
    // 这里可以打开消息中心
    console.log('打开消息中心');
  };

  const handleOpenSettings = () => {
    setSettingsModalVisible(true);
  };

  // 未登录状态
  if (!state.isAuthenticated) {
    return (
      <>
        <Button
          type="primary"
          icon={<LoginOutlined />}
          onClick={() => setAuthModalVisible(true)}
          loading={state.loading}
        >
          登录
        </Button>
        
        <AuthModal
          visible={authModalVisible}
          onCancel={() => setAuthModalVisible(false)}
          defaultMode="login"
        />
      </>
    );
  }

  // 登录状态的菜单项
  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div>
          <div style={{ fontWeight: 500 }}>{state.user?.username}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {state.user?.email}
          </Text>
        </div>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'messages',
      icon: (
        <Badge count={unreadCount} size="small" offset={[4, -4]}>
          <MessageOutlined />
        </Badge>
      ),
      label: '消息中心',
      onClick: handleOpenMessages,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: handleOpenSettings,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 用户头像
  const userAvatar = (
    <Space size="small" style={{ cursor: 'pointer' }}>
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Avatar
          size="default"
          src={state.user?.avatar_url}
          icon={<UserOutlined />}
          style={{ 
            backgroundColor: '#1890ff',
            border: '2px solid #fff'
          }}
        />
      </Badge>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Text style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>
          {state.user?.username}
        </Text>
        {unreadCount > 0 && (
          <Text style={{ color: '#faad14', fontSize: 12 }}>
            {unreadCount} 条未读消息
          </Text>
        )}
      </div>
    </Space>
  );

  if (loading || state.loading) {
    return <Spin size="small" />;
  }

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomRight"
        arrow
        trigger={['click']}
      >
        {userAvatar}
      </Dropdown>

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />
    </>
  );
};

export default UserMenu;
