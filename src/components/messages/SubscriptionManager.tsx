/**
 * 订阅管理组件
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Switch,
  Button,
  Input,
  InputNumber,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message as antMessage,
  Empty,
  Spin,
  Modal,
  Form,
  Select,
  Divider,
  Tooltip
} from 'antd';
import {
  BellOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  NotificationOutlined
} from '@ant-design/icons';
import { Subscription } from '../../types/auth';
import authService from '../../services/authService';
import { formatDistanceToNow } from '../../utils/dateUtils';
import { eventBus, EVENTS } from '../../utils/eventBus';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface SubscriptionManagerProps {
  onSubscriptionChange?: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onSubscriptionChange }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [settingsForm] = Form.useForm();

  // 常用币种列表
  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
    'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT'
  ];

  // 获取订阅列表
  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await authService.getSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error('获取订阅列表失败:', error);
      antMessage.error('获取订阅列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();

    // 监听订阅变化事件
    const unsubscribeAdded = eventBus.on(EVENTS.SUBSCRIPTION_ADDED, () => {
      fetchSubscriptions();
    });

    const unsubscribeRemoved = eventBus.on(EVENTS.SUBSCRIPTION_REMOVED, () => {
      fetchSubscriptions();
    });

    const unsubscribeUpdated = eventBus.on(EVENTS.SUBSCRIPTION_UPDATED, () => {
      fetchSubscriptions();
    });

    // 清理事件监听器
    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
      unsubscribeUpdated();
    };
  }, []);

  // 切换订阅状态
  const handleToggleSubscription = async (symbol: string, enabled: boolean) => {
    try {
      await authService.toggleSubscription(symbol);
      setSubscriptions(prev =>
        prev.map(sub =>
          sub.symbol === symbol ? { ...sub, is_enabled: enabled } : sub
        )
      );
      onSubscriptionChange?.();
      antMessage.success(`${symbol} 订阅已${enabled ? '启用' : '禁用'}`);

      // 发送订阅更新事件
      eventBus.emit(EVENTS.SUBSCRIPTION_UPDATED, { symbol, enabled });
    } catch (error) {
      console.error('切换订阅状态失败:', error);
      antMessage.error('操作失败');
    }
  };

  // 删除订阅
  const handleRemoveSubscription = async (symbol: string) => {
    try {
      await authService.removeSubscription(symbol);
      setSubscriptions(prev => prev.filter(sub => sub.symbol !== symbol));
      onSubscriptionChange?.();
      antMessage.success(`已删除 ${symbol} 的订阅`);

      // 发送订阅移除事件
      eventBus.emit(EVENTS.SUBSCRIPTION_REMOVED, { symbol });
    } catch (error) {
      console.error('删除订阅失败:', error);
      antMessage.error('删除失败');
    }
  };

  // 添加新订阅
  const handleAddSubscription = async (values: any) => {
    try {
      const newSubscription = await authService.updateSubscription({
        symbol: values.symbol.toUpperCase(),
        is_enabled: true,
        volume_alert_enabled: values.volume_alert_enabled || false,
        volume_threshold: typeof values.volume_threshold === 'number' ? values.volume_threshold : parseFloat(values.volume_threshold) || 1.5,
        volume_timeframe: values.volume_timeframe || '5m'
      });
      
      setSubscriptions(prev => {
        const existing = prev.find(sub => sub.symbol === newSubscription.symbol);
        if (existing) {
          return prev.map(sub =>
            sub.symbol === newSubscription.symbol ? newSubscription : sub
          );
        } else {
          return [...prev, newSubscription];
        }
      });
      
      setAddModalVisible(false);
      form.resetFields();
      onSubscriptionChange?.();
      antMessage.success(`已添加 ${newSubscription.symbol} 的订阅`);

      // 发送订阅添加事件
      eventBus.emit(EVENTS.SUBSCRIPTION_ADDED, { symbol: newSubscription.symbol, subscription: newSubscription });
    } catch (error) {
      console.error('添加订阅失败:', error);
      antMessage.error('添加订阅失败');
    }
  };

  // 更新订阅设置
  const handleUpdateSettings = async (values: any) => {
    if (!currentSubscription) return;

    try {
      const updatedSubscription = await authService.updateSubscription({
        symbol: currentSubscription.symbol,
        is_enabled: currentSubscription.is_enabled,
        alert_settings: values.alert_settings || currentSubscription.alert_settings,
        volume_alert_enabled: values.volume_alert_enabled !== undefined ? values.volume_alert_enabled : currentSubscription.volume_alert_enabled,
        volume_threshold: values.volume_threshold !== undefined ? (typeof values.volume_threshold === 'number' ? values.volume_threshold : parseFloat(values.volume_threshold)) : currentSubscription.volume_threshold,
        volume_timeframe: values.volume_timeframe || currentSubscription.volume_timeframe
      });

      setSubscriptions(prev =>
        prev.map(sub =>
          sub.symbol === currentSubscription.symbol ? updatedSubscription : sub
        )
      );

      setSettingsModalVisible(false);
      setCurrentSubscription(null);
      settingsForm.resetFields();
      antMessage.success('设置已更新');
    } catch (error) {
      console.error('更新设置失败:', error);
      antMessage.error('更新设置失败');
    }
  };

  // 打开设置模态框
  const handleOpenSettings = (subscription: Subscription) => {
    setCurrentSubscription(subscription);

    // 设置表单初始值，包括放量提醒设置
    settingsForm.setFieldsValue({
      // 价格提醒设置
      ...(subscription.alert_settings || {}),
      // 放量提醒设置
      volume_alert_enabled: subscription.volume_alert_enabled || false,
      volume_threshold: subscription.volume_threshold || 1.5,
      volume_timeframe: subscription.volume_timeframe || '5m'
    });

    setSettingsModalVisible(true);
  };

  // 筛选订阅
  const filteredSubscriptions = subscriptions.filter(sub =>
    sub.symbol.toLowerCase().includes(searchText.toLowerCase())
  );

  // 渲染订阅项
  const renderSubscriptionItem = (item: Subscription) => (
    <List.Item
      key={item.symbol}
      actions={[
        <Tooltip title="订阅设置">
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => handleOpenSettings(item)}
            size="small"
          />
        </Tooltip>,
        <Popconfirm
          title={`确定要删除 ${item.symbol} 的订阅吗？`}
          onConfirm={() => handleRemoveSubscription(item.symbol)}
          okText="确定"
          cancelText="取消"
        >
          <Tooltip title="删除订阅">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Tooltip>
        </Popconfirm>
      ]}
    >
      <List.Item.Meta
        avatar={
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: item.is_enabled ? '#52c41a' : '#d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 16
            }}
          >
            <BellOutlined />
          </div>
        }
        title={
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              {item.symbol}
            </Text>
            <Tag color={item.is_enabled ? 'green' : 'default'}>
              {item.is_enabled ? '已启用' : '已禁用'}
            </Tag>
            {item.volume_alert_enabled && (
              <Tag color="orange" icon={<NotificationOutlined />}>
                放量提醒
              </Tag>
            )}
          </Space>
        }
        description={
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              订阅时间: {formatDistanceToNow(new Date(item.created_at))}
            </Text>
            {item.volume_alert_enabled && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                放量提醒: {item.volume_threshold}倍 ({item.volume_timeframe})
              </Text>
            )}
            {item.alert_settings && Object.keys(item.alert_settings).length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                已配置个性化提醒设置
              </Text>
            )}
          </div>
        }
      />
      <div style={{ marginLeft: 16 }}>
        <Switch
          checked={item.is_enabled}
          onChange={(checked) => handleToggleSubscription(item.symbol, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      </div>
    </List.Item>
  );

  return (
    <Card
      title={
        <Space>
          <NotificationOutlined />
          <Title level={4} style={{ margin: 0 }}>
            订阅管理
          </Title>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalVisible(true)}
        >
          添加订阅
        </Button>
      }
    >
      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索币种..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      {/* 订阅列表 */}
      <Spin spinning={loading}>
        {filteredSubscriptions.length > 0 ? (
          <List
            dataSource={filteredSubscriptions}
            renderItem={renderSubscriptionItem}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? '未找到匹配的订阅' : '暂无订阅'}
          >
            {!searchText && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                添加第一个订阅
              </Button>
            )}
          </Empty>
        )}
      </Spin>

      {/* 添加订阅模态框 */}
      <Modal
        title="添加币种订阅"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleAddSubscription}
          layout="vertical"
        >
          <Form.Item
            name="symbol"
            label="币种代码"
            rules={[
              { required: true, message: '请输入币种代码' },
              { pattern: /^[A-Z0-9]+$/, message: '币种代码只能包含大写字母和数字' }
            ]}
          >
            <Select
              placeholder="选择或输入币种代码"
              showSearch
              allowClear
              optionFilterProp="children"
            >
              {popularSymbols.map(symbol => (
                <Option key={symbol} value={symbol}>
                  {symbol}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left">放量提醒设置</Divider>

          <Form.Item
            name="volume_alert_enabled"
            label="启用放量提醒"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="volume_threshold"
            label="放量倍数阈值"
            initialValue={1.5}
            rules={[
              { required: true, message: '请输入放量倍数阈值' },
              { type: 'number', min: 1.1, max: 10, message: '阈值必须在1.1-10之间' }
            ]}
          >
            <InputNumber
              step={0.1}
              min={1.1}
              max={10}
              placeholder="1.5"
              addonAfter="倍"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="volume_timeframe"
            label="检测周期"
            initialValue="5m"
            tooltip="选择合适的检测周期，短周期更敏感但可能产生更多提醒"
          >
            <Select>
              <Option value="1s">1秒（极短期）</Option>
              <Option value="5s">5秒（超短期）</Option>
              <Option value="10s">10秒（短期）</Option>
              <Option value="15s">15秒</Option>
              <Option value="30s">30秒</Option>
              <Option value="1m">1分钟</Option>
              <Option value="2m">2分钟</Option>
              <Option value="5m">5分钟（推荐）</Option>
              <Option value="10m">10分钟</Option>
              <Option value="15m">15分钟</Option>
              <Option value="30m">30分钟</Option>
              <Option value="1h">1小时（长期）</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                添加订阅
              </Button>
              <Button onClick={() => {
                setAddModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 订阅设置模态框 */}
      <Modal
        title={`${currentSubscription?.symbol} 订阅设置`}
        open={settingsModalVisible}
        onCancel={() => {
          setSettingsModalVisible(false);
          setCurrentSubscription(null);
          settingsForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={settingsForm}
          onFinish={handleUpdateSettings}
          layout="vertical"
        >
          <Title level={5}>价格提醒设置</Title>
          <Form.Item
            name="price_alert_enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用价格提醒" unCheckedChildren="禁用价格提醒" />
          </Form.Item>

          <Form.Item
            name="price_threshold_high"
            label="价格突破提醒（美元）"
          >
            <Input
              type="number"
              placeholder="当价格高于此值时提醒"
              addonBefore=">"
            />
          </Form.Item>

          <Form.Item
            name="price_threshold_low"
            label="价格跌破提醒（美元）"
          >
            <Input
              type="number"
              placeholder="当价格低于此值时提醒"
              addonBefore="<"
            />
          </Form.Item>

          <Divider />

          <Title level={5}>放量提醒设置</Title>
          <Form.Item
            name="volume_alert_enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用放量提醒" unCheckedChildren="禁用放量提醒" />
          </Form.Item>

          <Form.Item
            name="volume_threshold"
            label="放量倍数阈值"
            rules={[
              { type: 'number', min: 1.1, max: 10, message: '阈值必须在1.1-10之间' }
            ]}
          >
            <InputNumber
              step={0.1}
              min={1.1}
              max={10}
              placeholder="1.5"
              addonAfter="倍"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="volume_timeframe"
            label="检测周期"
            tooltip="选择合适的检测周期，短周期更敏感但可能产生更多提醒"
          >
            <Select placeholder="选择检测周期">
              <Option value="1s">1秒（极短期）</Option>
              <Option value="5s">5秒（超短期）</Option>
              <Option value="10s">10秒（短期）</Option>
              <Option value="15s">15秒</Option>
              <Option value="30s">30秒</Option>
              <Option value="1m">1分钟</Option>
              <Option value="2m">2分钟</Option>
              <Option value="5m">5分钟（推荐）</Option>
              <Option value="10m">10分钟</Option>
              <Option value="15m">15分钟</Option>
              <Option value="30m">30分钟</Option>
              <Option value="1h">1小时（长期）</Option>
            </Select>
          </Form.Item>

          <Divider />

          <Title level={5}>策略信号设置</Title>
          <Form.Item
            name="strategy_signal_enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用策略信号" unCheckedChildren="禁用策略信号" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存设置
              </Button>
              <Button onClick={() => {
                setSettingsModalVisible(false);
                setCurrentSubscription(null);
                settingsForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SubscriptionManager;
