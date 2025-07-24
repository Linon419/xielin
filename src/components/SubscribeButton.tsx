/**
 * 订阅按钮组件 - 用于在策略结果中快速订阅币种
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Form,
  Switch,
  InputNumber,
  Select,
  Divider,
  message as antMessage,
  Tooltip
} from 'antd';
import {
  BellOutlined,
  BellFilled,
  SettingOutlined
} from '@ant-design/icons';
import { Subscription } from '../types/auth';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

interface SubscribeButtonProps {
  symbol: string;
  size?: 'small' | 'middle' | 'large';
  type?: 'default' | 'primary' | 'text';
  showText?: boolean;
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  symbol,
  size = 'small',
  type = 'text',
  showText = false
}) => {
  const { state } = useAuth();
  const user = state.user;
  const [form] = Form.useForm();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // 检查订阅状态
  useEffect(() => {
    if (user && symbol) {
      checkSubscriptionStatus();
    }
  }, [user, symbol]);

  const checkSubscriptionStatus = async () => {
    try {
      const subscriptions = await authService.getSubscriptions();
      const existingSubscription = subscriptions.find(sub => sub.symbol === symbol);
      if (existingSubscription) {
        setIsSubscribed(true);
        setSubscription(existingSubscription);
      } else {
        setIsSubscribed(false);
        setSubscription(null);
      }
    } catch (error) {
      console.error('检查订阅状态失败:', error);
    }
  };

  // 处理订阅/取消订阅
  const handleSubscriptionToggle = async () => {
    if (!user) {
      antMessage.warning('请先登录');
      return;
    }

    if (isSubscribed) {
      // 取消订阅
      try {
        setLoading(true);
        await authService.removeSubscription(symbol);
        setIsSubscribed(false);
        setSubscription(null);
        antMessage.success(`已取消订阅 ${symbol}`);
      } catch (error) {
        console.error('取消订阅失败:', error);
        antMessage.error('取消订阅失败');
      } finally {
        setLoading(false);
      }
    } else {
      // 显示订阅设置模态框
      setModalVisible(true);
      // 设置默认值
      form.setFieldsValue({
        volume_alert_enabled: false,
        volume_threshold: 1.5,
        volume_timeframe: '5m'
      });
    }
  };

  // 处理订阅设置提交
  const handleSubscriptionSubmit = async (values: any) => {
    try {
      setLoading(true);
      const newSubscription = await authService.updateSubscription({
        symbol: symbol.toUpperCase(),
        is_enabled: true,
        volume_alert_enabled: values.volume_alert_enabled || false,
        volume_threshold: typeof values.volume_threshold === 'number' ? values.volume_threshold : parseFloat(values.volume_threshold) || 1.5,
        volume_timeframe: values.volume_timeframe || '5m'
      });
      
      setIsSubscribed(true);
      setSubscription(newSubscription);
      setModalVisible(false);
      form.resetFields();
      antMessage.success(`已订阅 ${symbol}`);
    } catch (error) {
      console.error('订阅失败:', error);
      antMessage.error('订阅失败');
    } finally {
      setLoading(false);
    }
  };

  // 如果用户未登录，不显示按钮
  if (!user) {
    return null;
  }

  const buttonIcon = isSubscribed ? <BellFilled /> : <BellOutlined />;
  const buttonText = isSubscribed ? '已订阅' : '订阅';
  const buttonColor = isSubscribed ? '#52c41a' : undefined;

  return (
    <>
      <Tooltip title={isSubscribed ? `已订阅 ${symbol}，点击取消订阅` : `订阅 ${symbol} 的消息提醒`}>
        <Button
          type={type}
          size={size}
          icon={buttonIcon}
          loading={loading}
          onClick={handleSubscriptionToggle}
          style={{ color: buttonColor }}
        >
          {showText && buttonText}
        </Button>
      </Tooltip>

      {/* 订阅设置模态框 */}
      <Modal
        title={`订阅 ${symbol} 消息提醒`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={480}
      >
        <Form
          form={form}
          onFinish={handleSubscriptionSubmit}
          layout="vertical"
        >
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                订阅
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SubscribeButton;
