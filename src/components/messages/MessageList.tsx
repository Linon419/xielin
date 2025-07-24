/**
 * 消息列表组件
 */

import React, { useState, useEffect } from 'react';
import {
  List,
  Card,
  Badge,
  Typography,
  Space,
  Button,
  Tag,
  Empty,
  Spin,
  Pagination,
  Select,
  Input,
  message as antMessage,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  MessageOutlined,
  DeleteOutlined,
  CheckOutlined,
  BellOutlined,
  RiseOutlined,
  NotificationOutlined,
  UserOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { Message } from '../../types/auth';
import authService from '../../services/authService';
import { formatDistanceToNow } from '../../utils/dateUtils';

const { Text, Title } = Typography;
const { Option } = Select;
const { Search } = Input;

interface MessageListProps {
  onMessageRead?: (messageId: number) => void;
  onMessageDelete?: (messageId: number) => void;
}

const MessageList: React.FC<MessageListProps> = ({ onMessageRead, onMessageDelete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    unread_only: false,
    symbol: '',
    message_type: ''
  });

  // 消息类型配置
  const messageTypeConfig = {
    price_alert: { 
      icon: <BellOutlined />, 
      color: '#faad14', 
      label: '价格提醒' 
    },
    strategy_signal: {
      icon: <RiseOutlined />,
      color: '#52c41a',
      label: '策略信号'
    },
    system_notice: { 
      icon: <NotificationOutlined />, 
      color: '#1890ff', 
      label: '系统通知' 
    },
    user_message: { 
      icon: <UserOutlined />, 
      color: '#722ed1', 
      label: '用户消息' 
    }
  };

  // 优先级配置
  const priorityConfig = {
    1: { color: '#52c41a', label: '低' },
    2: { color: '#faad14', label: '中' },
    3: { color: '#ff4d4f', label: '高' }
  };

  // 获取消息列表
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await authService.getMessages({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        unread_only: filters.unread_only,
        symbol: filters.symbol || undefined
      });
      
      setMessages(data);
      // 注意：这里需要后端返回总数，暂时使用消息数量
      setTotal(data.length >= pageSize ? (currentPage * pageSize) + 1 : (currentPage - 1) * pageSize + data.length);
    } catch (error) {
      console.error('获取消息失败:', error);
      antMessage.error('获取消息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [currentPage, filters]);

  // 标记消息为已读
  const handleMarkRead = async (messageId: number) => {
    try {
      await authService.markMessageRead(messageId);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        )
      );
      onMessageRead?.(messageId);
      antMessage.success('消息已标记为已读');
    } catch (error) {
      console.error('标记消息已读失败:', error);
      antMessage.error('操作失败');
    }
  };

  // 删除消息
  const handleDelete = async (messageId: number) => {
    try {
      await authService.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      onMessageDelete?.(messageId);
      antMessage.success('消息已删除');
    } catch (error) {
      console.error('删除消息失败:', error);
      antMessage.error('删除失败');
    }
  };

  // 标记所有消息为已读
  const handleMarkAllRead = async () => {
    try {
      await authService.markAllMessagesRead(filters.symbol || undefined);
      setMessages(prev => 
        prev.map(msg => ({ 
          ...msg, 
          is_read: true, 
          read_at: new Date().toISOString() 
        }))
      );
      antMessage.success('所有消息已标记为已读');
    } catch (error) {
      console.error('批量标记已读失败:', error);
      antMessage.error('操作失败');
    }
  };

  // 渲染消息项
  const renderMessageItem = (item: Message) => {
    const typeConfig = messageTypeConfig[item.message_type];
    const priorityInfo = priorityConfig[item.priority];
    
    return (
      <List.Item
        key={item.id}
        style={{
          backgroundColor: item.is_read ? '#fff' : '#f6ffed',
          border: item.is_read ? '1px solid #f0f0f0' : '1px solid #b7eb8f',
          borderRadius: 8,
          marginBottom: 8,
          padding: 16
        }}
        actions={[
          !item.is_read && (
            <Tooltip title="标记为已读">
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => handleMarkRead(item.id)}
                size="small"
              />
            </Tooltip>
          ),
          <Popconfirm
            title="确定要删除这条消息吗？"
            onConfirm={() => handleDelete(item.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除消息">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={!item.is_read}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: typeConfig.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 16
                }}
              >
                {typeConfig.icon}
              </div>
            </Badge>
          }
          title={
            <Space>
              <Text strong={!item.is_read} style={{ fontSize: 16 }}>
                {item.title}
              </Text>
              {item.symbol && (
                <Tag color="blue" style={{ fontSize: 12 }}>
                  {item.symbol}
                </Tag>
              )}
              <Tag color={priorityInfo.color} style={{ fontSize: 12 }}>
                {priorityInfo.label}优先级
              </Tag>
            </Space>
          }
          description={
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                {item.content}
              </Text>
              <Space size="middle">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <MessageOutlined style={{ marginRight: 4 }} />
                  {typeConfig.label}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDistanceToNow(new Date(item.created_at))}
                </Text>
                {item.is_read && item.read_at && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已读于 {formatDistanceToNow(new Date(item.read_at))}
                  </Text>
                )}
              </Space>
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card
      title={
        <Space>
          <MessageOutlined />
          <Title level={4} style={{ margin: 0 }}>
            消息中心
          </Title>
        </Space>
      }
      extra={
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={handleMarkAllRead}
            disabled={messages.every(msg => msg.is_read)}
          >
            全部已读
          </Button>
        </Space>
      }
    >
      {/* 筛选器 */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="消息类型"
            style={{ width: 120 }}
            allowClear
            value={filters.message_type || undefined}
            onChange={(value) => setFilters(prev => ({ ...prev, message_type: value || '' }))}
          >
            {Object.entries(messageTypeConfig).map(([key, config]) => (
              <Option key={key} value={key}>
                <Space>
                  {config.icon}
                  {config.label}
                </Space>
              </Option>
            ))}
          </Select>
          
          <Search
            placeholder="搜索币种"
            style={{ width: 120 }}
            value={filters.symbol}
            onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
            onSearch={() => fetchMessages()}
            allowClear
          />
          
          <Button
            type={filters.unread_only ? 'primary' : 'default'}
            icon={<FilterOutlined />}
            onClick={() => setFilters(prev => ({ ...prev, unread_only: !prev.unread_only }))}
          >
            {filters.unread_only ? '显示全部' : '仅未读'}
          </Button>
        </Space>
      </div>

      {/* 消息列表 */}
      <Spin spinning={loading}>
        {messages.length > 0 ? (
          <>
            <List
              dataSource={messages}
              renderItem={renderMessageItem}
              style={{ marginBottom: 16 }}
            />
            
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total, range) => 
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条消息`
              }
            />
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              filters.unread_only ? '暂无未读消息' : '暂无消息'
            }
          />
        )}
      </Spin>
    </Card>
  );
};

export default MessageList;
