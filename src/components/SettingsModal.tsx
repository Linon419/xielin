/**
 * 设置模态框组件
 */

import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Card
} from 'antd';
import {
  SettingOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import TelegramConfig from './TelegramConfig';
import type { TabsProps } from 'antd';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState('telegram');

  const tabItems: TabsProps['items'] = [
    {
      key: 'telegram',
      label: (
        <span>
          <SendOutlined />
          Telegram推送
        </span>
      ),
      children: <TelegramConfig />
    },
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          个人资料
        </span>
      ),
      children: (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p>个人资料设置功能开发中...</p>
          </div>
        </Card>
      )
    }
  ];

  return (
    <Modal
      title={
        <span>
          <SettingOutlined /> 用户设置
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={tabItems}
      />
    </Modal>
  );
};

export default SettingsModal;
