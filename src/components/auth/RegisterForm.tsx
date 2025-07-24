/**
 * 用户注册表单组件
 */

import React from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider, Alert, Progress } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { RegisterRequest } from '../../types/auth';

const { Title, Text, Link } = Typography;

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
  onSuccess?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onSuccess }) => {
  const { state, register, clearError } = useAuth();
  const [form] = Form.useForm();

  // 密码强度检查
  const getPasswordStrength = (password: string): { score: number; text: string; color: string } => {
    if (!password) return { score: 0, text: '', color: '' };

    let score = 0;
    if (password.length >= 6) score += 20;
    if (password.length >= 8) score += 20;
    if (/[a-z]/.test(password)) score += 20;
    if (/[A-Z]/.test(password)) score += 20;
    if (/\d/.test(password)) score += 20;

    if (score < 40) return { score, text: '弱', color: '#ff4d4f' };
    if (score < 80) return { score, text: '中等', color: '#faad14' };
    return { score, text: '强', color: '#52c41a' };
  };

  const handleSubmit = async (values: RegisterRequest) => {
    try {
      await register(values);
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

  const passwordValue = Form.useWatch('password', form);
  const passwordStrength = getPasswordStrength(passwordValue || '');

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
        <UserAddOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={3} style={{ margin: 0 }}>
          创建账户
        </Title>
        <Text type="secondary">
          注册新账户，开始您的交易之旅
        </Text>
      </div>

      {state.error && (
        <Alert
          message="注册失败"
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
        name="register"
        onFinish={handleSubmit}
        onValuesChange={handleFormChange}
        layout="vertical"
        size="large"
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, max: 20, message: '用户名长度为3-20个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱地址"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱地址"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
            { pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: '密码必须包含字母和数字' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="new-password"
          />
        </Form.Item>

        {passwordValue && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>密码强度</Text>
              <Text style={{ fontSize: 12, color: passwordStrength.color }}>
                {passwordStrength.text}
              </Text>
            </div>
            <Progress
              percent={passwordStrength.score}
              strokeColor={passwordStrength.color}
              showInfo={false}
              size="small"
            />
          </div>
        )}

        <Form.Item
          name="confirm_password"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请再次输入密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={state.loading}
            block
            size="large"
            icon={<UserAddOutlined />}
          >
            {state.loading ? '注册中...' : '注册账户'}
          </Button>
        </Form.Item>
      </Form>

      {onSwitchToLogin && (
        <>
          <Divider>
            <Text type="secondary">已有账户？</Text>
          </Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Space>
              <Text type="secondary">已有账户？</Text>
              <Link onClick={onSwitchToLogin}>
                立即登录
              </Link>
            </Space>
          </div>
        </>
      )}

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          注册即表示您同意我们的服务条款和隐私政策
        </Text>
      </div>
    </Card>
  );
};

export default RegisterForm;
