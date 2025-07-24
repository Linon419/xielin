/**
 * 认证模态框组件
 */

import React, { useState } from 'react';
import { Modal } from 'antd';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthModalProps {
  visible: boolean;
  onCancel: () => void;
  defaultMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  visible, 
  onCancel, 
  defaultMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);

  const handleSuccess = () => {
    onCancel();
  };

  const handleSwitchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={480}
      centered
      destroyOnClose
      styles={{
        body: { padding: 0 }
      }}
    >
      {mode === 'login' ? (
        <LoginForm
          onSwitchToRegister={handleSwitchMode}
          onSuccess={handleSuccess}
        />
      ) : (
        <RegisterForm
          onSwitchToLogin={handleSwitchMode}
          onSuccess={handleSuccess}
        />
      )}
    </Modal>
  );
};

export default AuthModal;
