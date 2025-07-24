import React from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Tooltip } from 'antd';
import { 
  InfoCircleOutlined, 
  TrophyOutlined, 
  ThunderboltOutlined,
  DollarOutlined,
  PercentageOutlined
} from '@ant-design/icons';
import { ContractMarketData } from '../services/contractDataService';

interface ContractInfoProps {
  contractData: ContractMarketData | null;
  loading?: boolean;
}

const ContractInfo: React.FC<ContractInfoProps> = ({ contractData, loading = false }) => {
  if (!contractData) {
    return (
      <Card 
        title={
          <Space>
            <ThunderboltOutlined />
            合约信息
          </Space>
        }
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
          请输入合约币种以获取实时数据
        </div>
      </Card>
    );
  }

  const formatNumber = (num: number | undefined, decimals: number = 2): string => {
    if (num === undefined || num === null) return '--';
    
    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(decimals)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(decimals)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(decimals)}K`;
    }
    
    return num.toFixed(decimals);
  };

  const formatPercentage = (num: number | undefined): string => {
    if (num === undefined || num === null) return '--';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const getChangeColor = (change: number | undefined): string => {
    if (change === undefined || change === null) return '#666';
    return change >= 0 ? '#52c41a' : '#ff4d4f';
  };

  return (
    <Card 
      title={
        <Space>
          <ThunderboltOutlined />
          合约信息 - {contractData.symbol}
          <Tag color={contractData.contractType === 'perpetual' ? 'blue' : 'green'}>
            {contractData.contractType === 'perpetual' ? '永续合约' : '期货合约'}
          </Tag>
        </Space>
      }
      loading={loading}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6}>
          <Statistic
            title={
              <Space>
                <DollarOutlined />
                当前价格
              </Space>
            }
            value={contractData.price}
            precision={contractData.price > 1 ? 2 : 6}
            prefix="$"
            valueStyle={{ fontSize: '18px', fontWeight: 'bold' }}
          />
        </Col>
        
        <Col xs={12} sm={8} md={6}>
          <Statistic
            title={
              <Space>
                <PercentageOutlined />
                24h涨跌
              </Space>
            }
            value={formatPercentage(contractData.change24h)}
            valueStyle={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              color: getChangeColor(contractData.change24h)
            }}
          />
        </Col>

        <Col xs={12} sm={8} md={6}>
          <Statistic
            title="24h最高"
            value={contractData.high24h}
            precision={contractData.high24h > 1 ? 2 : 6}
            prefix="$"
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>

        <Col xs={12} sm={8} md={6}>
          <Statistic
            title="24h最低"
            value={contractData.low24h}
            precision={contractData.low24h > 1 ? 2 : 6}
            prefix="$"
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>

        <Col xs={12} sm={8} md={6}>
          <Statistic
            title={
              <Space>
                24h成交量
                <Tooltip title="24小时内的总成交量（USDT）">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            value={formatNumber(contractData.volume24h)}
            suffix="USDT"
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>

        {contractData.openInterest && (
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title={
                <Space>
                  持仓量
                  <Tooltip title="当前未平仓的合约总量">
                    <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                </Space>
              }
              value={formatNumber(contractData.openInterest)}
              valueStyle={{ fontSize: '14px' }}
            />
          </Col>
        )}

        {contractData.fundingRate !== undefined && (
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title={
                <Space>
                  资金费率
                  <Tooltip title="永续合约的资金费率，正值表示多头支付空头">
                    <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                </Space>
              }
              value={formatPercentage(contractData.fundingRate * 100)}
              valueStyle={{ 
                fontSize: '14px',
                color: getChangeColor(contractData.fundingRate)
              }}
            />
          </Col>
        )}

        <Col xs={24} sm={8} md={6}>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <div>数据更新时间:</div>
            <div>{new Date(contractData.lastUpdated).toLocaleString('zh-CN')}</div>
          </div>
        </Col>
      </Row>

      <div style={{ 
        marginTop: 16, 
        padding: '12px', 
        backgroundColor: '#f6f8fa', 
        borderRadius: '6px',
        fontSize: '12px',
        color: '#666'
      }}>
        <Space>
          <TrophyOutlined />
          <span>
            合约交易具有高风险，请确保您了解杠杆交易的风险并做好资金管理。
            建议使用小仓位进行测试，逐步熟悉合约交易机制。
          </span>
        </Space>
      </div>
    </Card>
  );
};

export default ContractInfo;
