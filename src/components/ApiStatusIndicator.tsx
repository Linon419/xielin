import React, { useState, useEffect } from 'react';
import { Badge, Tooltip, Space, Typography, Modal, Descriptions, Tag } from 'antd';
import { 
  ApiOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  GlobalOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface ApiStatus {
  api_mode: 'private' | 'public';
  api_keys_configured: boolean;
  ccxt_available: boolean;
  available_exchanges: string[];
  features: {
    real_time_data: boolean;
    historical_data: boolean;
    funding_rate: boolean;
    high_frequency: boolean;
    account_info: boolean;
  };
  rate_limits: {
    private_api: string;
    public_api: string;
  };
}

const ApiStatusIndicator: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchApiStatus();
  }, []);

  const fetchApiStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const result = await response.json();

      if (result.success && result.data) {
        setApiStatus({
          api_mode: result.data.api_mode || 'public',
          api_keys_configured: result.data.api_keys_configured || false,
          ccxt_available: result.data.ccxt_available || true,
          available_exchanges: result.data.exchanges || ['binance'],
          features: result.data.features || {
            real_time_data: true,
            historical_data: true,
            funding_rate: true,
            high_frequency: false,
            account_info: false
          },
          rate_limits: result.data.rate_limits || {
            private_api: 'N/A',
            public_api: '1200/min'
          }
        });
      }
    } catch (error) {
      console.error('获取API状态失败:', error);
      // 设置默认状态为公共API
      setApiStatus({
        api_mode: 'public',
        api_keys_configured: false,
        ccxt_available: true,
        available_exchanges: ['binance'],
        features: {
          real_time_data: true,
          historical_data: true,
          funding_rate: true,
          high_frequency: false,
          account_info: false
        },
        rate_limits: {
          private_api: 'N/A',
          public_api: '1200/min'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!apiStatus) return 'default';
    return apiStatus.api_mode === 'private' ? 'success' : 'processing';
  };

  const getStatusText = () => {
    if (!apiStatus) return '未知';
    return apiStatus.api_mode === 'private' ? '私有API' : '公共API';
  };

  const getStatusIcon = () => {
    if (!apiStatus) return <InfoCircleOutlined />;
    return apiStatus.api_mode === 'private' ? <KeyOutlined /> : <GlobalOutlined />;
  };

  const getTooltipTitle = () => {
    if (!apiStatus) return 'API状态未知';

    if (apiStatus.api_mode === 'private') {
      return `使用私有API - 高频率访问，完整功能`;
    } else {
      return `使用公共API - 基础功能，无需配置`;
    }
  };

  if (loading) {
    return (
      <Badge status="default" text="检查中..." />
    );
  }

  return (
    <>
      <Tooltip title={getTooltipTitle()}>
        <Space 
          style={{ cursor: 'pointer' }} 
          onClick={() => setModalVisible(true)}
        >
          <Badge 
            status={getStatusColor()} 
            text={
              <Space size={4}>
                {getStatusIcon()}
                <Text style={{ fontSize: '12px' }}>
                  {getStatusText()}
                </Text>
              </Space>
            } 
          />
        </Space>
      </Tooltip>

      <Modal
        title={
          <Space>
            <ApiOutlined />
            API状态详情
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        {apiStatus && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item 
              label="API模式"
              labelStyle={{ width: '120px' }}
            >
              <Space>
                <Tag 
                  color={apiStatus.api_mode === 'private' ? 'green' : 'blue'}
                  icon={apiStatus.api_mode === 'private' ? <KeyOutlined /> : <GlobalOutlined />}
                >
                  {apiStatus.api_mode === 'private' ? '私有API模式' : '公共API模式'}
                </Tag>
                {apiStatus.api_mode === 'private' && (
                  <Tag color="gold">高级功能</Tag>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="API密钥配置">
              <Space>
                {apiStatus.api_keys_configured ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag>
                ) : (
                  <Tag color="orange" icon={<ExclamationCircleOutlined />}>未配置</Tag>
                )}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {apiStatus.api_keys_configured 
                    ? '使用您配置的API密钥访问私有端点' 
                    : '使用公开端点，无需API密钥'
                  }
                </Text>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="可用交易所">
              <Space wrap>
                {apiStatus.available_exchanges.length > 0 ? (
                  apiStatus.available_exchanges.map(exchange => (
                    <Tag key={exchange} color="blue">
                      {exchange.toUpperCase()}
                    </Tag>
                  ))
                ) : (
                  <Tag color="default">Binance (公共API)</Tag>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="功能支持">
              <Space direction="vertical" size={4}>
                <Space wrap>
                  <Tag color={apiStatus.features.real_time_data ? 'green' : 'red'}>
                    实时数据: {apiStatus.features.real_time_data ? '✓' : '✗'}
                  </Tag>
                  <Tag color={apiStatus.features.historical_data ? 'green' : 'red'}>
                    历史数据: {apiStatus.features.historical_data ? '✓' : '✗'}
                  </Tag>
                  <Tag color={apiStatus.features.funding_rate ? 'green' : 'orange'}>
                    资金费率: {apiStatus.features.funding_rate ? '✓' : '✗'}
                  </Tag>
                </Space>
                <Space wrap>
                  <Tag color={apiStatus.features.high_frequency ? 'green' : 'orange'}>
                    高频访问: {apiStatus.features.high_frequency ? '✓' : '✗'}
                  </Tag>
                  <Tag color={apiStatus.features.account_info ? 'green' : 'orange'}>
                    账户信息: {apiStatus.features.account_info ? '✓' : '✗'}
                  </Tag>
                </Space>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="频率限制">
              <Space direction="vertical" size={4}>
                {apiStatus.api_mode === 'private' && (
                  <Text>
                    <Tag color="green">私有API</Tag>
                    {apiStatus.rate_limits.private_api}
                  </Text>
                )}
                <Text>
                  <Tag color="blue">公共API</Tag>
                  {apiStatus.rate_limits.public_api}
                </Text>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="升级建议">
              {apiStatus.api_mode === 'public' ? (
                <div>
                  <Text type="warning">
                    💡 配置API密钥可获得更好的性能和完整功能
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    在Vercel环境变量中配置 BINANCE_API_KEY 和 BINANCE_SECRET
                  </Text>
                </div>
              ) : (
                <Text type="success">
                  ✅ 您正在使用最佳配置，享受完整功能
                </Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default ApiStatusIndicator;
