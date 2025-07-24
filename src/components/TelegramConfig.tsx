/**
 * Telegram配置组件
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
  Steps,
  message as antMessage,
  Spin
} from 'antd';
import {
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import authService from '../services/authService';
import type { StepsProps } from 'antd';

const { Text, Title, Paragraph } = Typography;

interface TelegramConfig {
  chat_id: string;
  enabled: boolean;
  is_verified: boolean;
}

const TelegramConfig: React.FC = () => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<TelegramConfig>({
    chat_id: '',
    enabled: false,
    is_verified: false
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setInitialLoading(true);
      const response = await authService.getTelegramConfig();
      setConfig(response);
      form.setFieldsValue({
        chat_id: response.chat_id,
        enabled: response.enabled
      });
    } catch (error) {
      console.error('加载Telegram配置失败:', error);
      antMessage.error('加载配置失败');
    } finally {
      setInitialLoading(false);
    }
  };

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setLoading(true);
      const response = await authService.updateTelegramConfig({
        chat_id: values.chat_id,
        enabled: values.enabled
      });
      setConfig(response);
      antMessage.success('配置保存成功');
    } catch (error: any) {
      console.error('保存配置失败:', error);
      antMessage.error(error.message || '保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试连接
  const handleTest = async () => {
    try {
      setTesting(true);
      await authService.testTelegramConnection();
      antMessage.success('测试消息发送成功！请检查您的Telegram');
    } catch (error: any) {
      console.error('测试连接失败:', error);
      antMessage.error(error.message || '测试连接失败');
    } finally {
      setTesting(false);
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载配置中...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Title level={4}>
        <SendOutlined /> Telegram推送配置
      </Title>
      
      <Alert
        message="Telegram推送功能"
        description="配置后，系统消息和放量提醒将自动推送到您的Telegram"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 配置步骤说明 */}
      <Card size="small" style={{ marginBottom: 24, backgroundColor: '#fafafa' }}>
        <Title level={5}>配置步骤：</Title>
        <Steps
          direction="vertical"
          size="small"
          items={[
            {
              status: "finish",
              title: "添加Bot",
              description: "在Telegram中搜索并添加 @YourBotName（请联系管理员获取Bot用户名）"
            },
            {
              status: "finish",
              title: "获取Chat ID",
              description: "向Bot发送任意消息，然后联系管理员获取您的Chat ID"
            },
            {
              status: config.is_verified ? "finish" : "process",
              title: "配置并测试",
              description: "在下方输入Chat ID，启用推送并测试连接"
            }
          ]}
        />
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          chat_id: config.chat_id,
          enabled: config.enabled
        }}
      >
        <Form.Item
          name="enabled"
          label="启用Telegram推送"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="chat_id"
          label="Telegram Chat ID"
          rules={[
            {
              required: form.getFieldValue('enabled'),
              message: '启用推送时必须输入Chat ID'
            },
            {
              pattern: /^-?\d+$/,
              message: 'Chat ID必须是数字'
            }
          ]}
          extra="您的Telegram Chat ID，通常是一串数字（可能以负号开头）"
        >
          <Input
            placeholder="例如: 123456789 或 -123456789"
            disabled={!form.getFieldValue('enabled')}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<CheckCircleOutlined />}
            >
              保存配置
            </Button>
            
            {config.chat_id && (
              <Button
                onClick={handleTest}
                loading={testing}
                icon={<SendOutlined />}
              >
                测试连接
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      {/* 状态显示 */}
      {config.is_verified && (
        <Alert
          message="配置状态"
          description={
            <Space direction="vertical" size="small">
              <Text>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                Telegram推送已配置并验证成功
              </Text>
              <Text type="secondary">
                Chat ID: {config.chat_id}
              </Text>
            </Space>
          }
          type="success"
          showIcon={false}
          style={{ marginTop: 16 }}
        />
      )}

      <Divider />

      {/* 帮助信息 */}
      <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
        <Title level={5}>
          <InfoCircleOutlined /> 如何获取Chat ID？
        </Title>
        <Paragraph>
          <ol>
            <li>在Telegram中搜索并添加我们的Bot</li>
            <li>向Bot发送任意消息（如 "hello"）</li>
            <li>联系管理员，提供您的Telegram用户名，获取Chat ID</li>
            <li>将Chat ID填入上方表单并保存</li>
            <li>点击"测试连接"验证配置是否正确</li>
          </ol>
        </Paragraph>
        
        <Alert
          message="注意事项"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Chat ID通常是一串数字，可能以负号开头</li>
              <li>确保您已经向Bot发送过消息，否则Bot无法主动发送消息给您</li>
              <li>如果测试失败，请检查Chat ID是否正确，或联系管理员</li>
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    </Card>
  );
};

export default TelegramConfig;
