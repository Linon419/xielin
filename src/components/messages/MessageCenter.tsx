/**
 * 消息中心主页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Tabs,
  Space,
  Typography,
  Button,
  Badge,
  Spin
} from 'antd';
import {
  MessageOutlined,
  BellOutlined,
  CheckCircleOutlined,
  NotificationOutlined,
  RiseOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import { MessageStats, UserStats } from '../../types/auth';
import MessageList from './MessageList';
import SubscriptionManager from './SubscriptionManager';

const { Title } = Typography;

const MessageCenter: React.FC = () => {
  const { state } = useAuth();
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('messages');

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    // 严格检查认证状态
    if (!state.isAuthenticated || !state.user || !state.token || state.loading) {
      return;
    }

    // 双重检查：确保authService也有token
    if (!authService.getToken()) {
      console.debug('AuthService中没有token，跳过统计数据获取');
      return;
    }

    try {
      setLoading(true);
      const [msgStats, usrStats] = await Promise.all([
        authService.getMessageStats(),
        authService.getUserStats()
      ]);
      setMessageStats(msgStats);
      setUserStats(usrStats);
    } catch (error) {
      // 如果是认证相关错误，不记录错误日志
      if (error instanceof Error && (
        error.message.includes('401') ||
        error.message.includes('未认证') ||
        error.message.includes('缺少访问令牌')
      )) {
        console.debug('认证状态异常，跳过统计数据获取');
      } else {
        console.error('获取统计数据失败:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [state.isAuthenticated, state.user, state.token, state.loading]);

  useEffect(() => {
    // 只有在认证状态完全稳定且已认证时才获取数据
    if (state.isAuthenticated && state.user && state.token && !state.loading) {
      fetchStats();
    }
  }, [state.isAuthenticated, state.user, state.token, state.loading, fetchStats]);

  // 刷新统计数据
  const handleRefreshStats = () => {
    fetchStats();
  };

  if (!state.isAuthenticated) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
        <MessageOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
        <Title level={3} type="secondary">
          请先登录以查看消息中心
        </Title>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <MessageOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            消息中心
          </Title>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={handleRefreshStats}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="未读消息"
                value={messageStats?.unread_messages || 0}
                prefix={<Badge dot={messageStats?.unread_messages ? messageStats.unread_messages > 0 : false}>
                  <MessageOutlined />
                </Badge>}
                valueStyle={{ color: messageStats?.unread_messages ? '#cf1322' : '#52c41a' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总消息数"
                value={messageStats?.total_messages || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="订阅币种"
                value={userStats?.enabled_subscriptions || 0}
                suffix={`/ ${userStats?.total_subscriptions || 0}`}
                prefix={<BellOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="注册天数"
                value={userStats ? Math.ceil(
                  (new Date().getTime() - new Date(userStats.user_since).getTime()) / (1000 * 60 * 60 * 24)
                ) : 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 消息类型统计 */}
        {messageStats?.type_statistics && Object.keys(messageStats.type_statistics).length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="消息类型统计" size="small">
                <Row gutter={[16, 8]}>
                  {Object.entries(messageStats.type_statistics).map(([type, stats]) => {
                    const typeConfig = {
                      price_alert: { icon: <BellOutlined />, label: '价格提醒', color: '#faad14' },
                      strategy_signal: { icon: <RiseOutlined />, label: '策略信号', color: '#52c41a' },
                      system_notice: { icon: <NotificationOutlined />, label: '系统通知', color: '#1890ff' },
                      user_message: { icon: <UserOutlined />, label: '用户消息', color: '#722ed1' }
                    }[type] || { icon: <MessageOutlined />, label: type, color: '#666' };

                    return (
                      <Col xs={12} sm={8} md={6} key={type}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <Space direction="vertical" size="small">
                            <div style={{ color: typeConfig.color, fontSize: 20 }}>
                              {typeConfig.icon}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: '#666' }}>
                                {typeConfig.label}
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                                {stats.total}
                                {stats.unread > 0 && (
                                  <Badge
                                    count={stats.unread}
                                    size="small"
                                    style={{ marginLeft: 8 }}
                                  />
                                )}
                              </div>
                            </div>
                          </Space>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </Col>
          </Row>
        )}
      </Spin>

      {/* 主要内容区域 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'messages',
              label: (
                <Space>
                  <MessageOutlined />
                  消息列表
                  {messageStats?.unread_messages && messageStats.unread_messages > 0 && (
                    <Badge count={messageStats.unread_messages} size="small" />
                  )}
                </Space>
              ),
              children: (
                <MessageList
                  onMessageRead={handleRefreshStats}
                  onMessageDelete={handleRefreshStats}
                />
              )
            },
            {
              key: 'subscriptions',
              label: (
                <Space>
                  <BellOutlined />
                  订阅管理
                  <Badge count={userStats?.enabled_subscriptions || 0} showZero color="green" />
                </Space>
              ),
              children: (
                <SubscriptionManager
                  onSubscriptionChange={handleRefreshStats}
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default MessageCenter;
