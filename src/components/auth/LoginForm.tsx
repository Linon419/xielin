/**
 * 用户登录表单组件
 */

import React from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider, Alert } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { LoginRequest } from '../../types/auth';

const { Title, Text, Link } = Typography;

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onSuccess }) => {
  const { state, login, clearError } = useAuth();
  const [form] = Form.useForm();

  const handleSubmit = async (values: LoginRequest) => {
    try {
      await login(values);
      onSuccess?.();
    } catch (error) {
      // 错误已在AuthContext中处理
    }
  };

  const handleFormChange = () => {
    if (state.error) {
      clearError();
    }
  };

  return (
    <Card
      style={{ 
        width: '100%', 
        maxWidth: 400, 
        margin: '0 auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <LoginOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={3} style={{ margin: 0 }}>
          登录账户
        </Title>
        <Text type="secondary">
          登录您的账户以访问完整功能
        </Text>
      </div>

      {state.error && (
        <Alert
          message="登录失败"
          description={state.error}
          type="error"
          showIcon
          closable
          onClose={clearError}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        onValuesChange={handleFormChange}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="username"
          label="用户名或邮箱"
          rules={[
            { required: true, message: '请输入用户名或邮箱' },
            { min: 3, message: '用户名至少3个字符' }
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名或邮箱"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={state.loading}
            block
            size="large"
            icon={<LoginOutlined />}
          >
            {state.loading ? '登录中...' : '登录'}
          </Button>
        </Form.Item>
      </Form>

      {onSwitchToRegister && (
        <>
          <Divider>
            <Text type="secondary">还没有账户？</Text>
          </Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Space>
              <Text type="secondary">新用户？</Text>
              <Link onClick={onSwitchToRegister}>
                立即注册
              </Link>
            </Space>
          </div>
        </>
      )}

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          登录即表示您同意我们的服务条款和隐私政策
        </Text>
      </div>
    </Card>
  );
};

export default LoginForm;
