/**
 * 实时价格显示组件
 */

import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Badge, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WifiOutlined } from '@ant-design/icons';
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket';

const { Text } = Typography;

interface PriceData {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  change: number;
  percentage: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
}

interface RealTimePriceDisplayProps {
  symbol: string;
  showDetails?: boolean;
  size?: 'small' | 'default';
}

const RealTimePriceDisplay: React.FC<RealTimePriceDisplayProps> = ({
  symbol,
  showDetails = true,
  size = 'default'
}) => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>();
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    onMessage: (message: WebSocketMessage) => {
      if (message.type === 'price_update' && message.symbol === symbol && message.data) {
        const newPrice = message.data.last;
        const oldPrice = priceData?.last;
        
        // 判断价格变化方向
        if (oldPrice && newPrice !== oldPrice) {
          setPriceDirection(newPrice > oldPrice ? 'up' : 'down');
          
          // 2秒后重置方向指示
          setTimeout(() => {
            setPriceDirection('neutral');
          }, 2000);
        }
        
        setPriceData(message.data);
        setLastUpdate(new Date());
      }
    }
  });

  // 订阅价格数据
  useEffect(() => {
    if (isConnected && symbol) {
      subscribe(symbol);
    }

    return () => {
      if (symbol) {
        unsubscribe(symbol);
      }
    };
  }, [isConnected, symbol, subscribe, unsubscribe]);

  const formatPrice = (price: number) => {
    if (!price) return '0.00';
    return price.toFixed(price < 1 ? 6 : 2);
  };

  const formatVolume = (volume: number) => {
    if (!volume) return '0';
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  const getPriceColor = () => {
    switch (priceDirection) {
      case 'up':
        return '#52c41a';
      case 'down':
        return '#ff4d4f';
      default:
        return undefined;
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return '#52c41a';
    if (change < 0) return '#ff4d4f';
    return '#666';
  };

  const connectionStatus = (
    <Tooltip title={isConnected ? '实时数据已连接' : '实时数据未连接'}>
      <Badge
        status={isConnected ? 'success' : 'error'}
        text={
          <WifiOutlined 
            style={{ 
              color: isConnected ? '#52c41a' : '#ff4d4f',
              fontSize: '12px'
            }} 
          />
        }
      />
    </Tooltip>
  );

  if (!priceData) {
    return (
      <Card size={size}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Text type="secondary">等待实时数据...</Text>
          <div style={{ marginTop: 8 }}>
            {connectionStatus}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      size={size}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{symbol}</span>
          {connectionStatus}
        </div>
      }
      style={{
        transition: 'all 0.3s ease',
        borderColor: priceDirection === 'up' ? '#52c41a' : priceDirection === 'down' ? '#ff4d4f' : undefined
      }}
    >
      <Row gutter={[16, 16]}>
        <Col span={showDetails ? 12 : 24}>
          <Statistic
            title="最新价格"
            value={priceData.last}
            precision={priceData.last < 1 ? 6 : 2}
            valueStyle={{ 
              color: getPriceColor(),
              transition: 'color 0.3s ease'
            }}
            prefix={
              priceDirection === 'up' ? <ArrowUpOutlined /> : 
              priceDirection === 'down' ? <ArrowDownOutlined /> : null
            }
          />
        </Col>
        
        {showDetails && (
          <Col span={12}>
            <Statistic
              title="24h涨跌"
              value={priceData.percentage}
              precision={2}
              valueStyle={{ color: getChangeColor(priceData.change) }}
              suffix="%"
              prefix={
                priceData.change > 0 ? <ArrowUpOutlined /> : 
                priceData.change < 0 ? <ArrowDownOutlined /> : null
              }
            />
          </Col>
        )}
      </Row>

      {showDetails && (
        <>
          <Row gutter={[16, 8]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Text type="secondary">买一价</Text>
              <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                {formatPrice(priceData.bid)}
              </div>
            </Col>
            <Col span={8}>
              <Text type="secondary">卖一价</Text>
              <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {formatPrice(priceData.ask)}
              </div>
            </Col>
            <Col span={8}>
              <Text type="secondary">成交量</Text>
              <div style={{ fontWeight: 'bold' }}>
                {formatVolume(priceData.volume)}
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Text type="secondary">24h最高</Text>
              <div style={{ color: '#52c41a' }}>
                {formatPrice(priceData.high)}
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary">24h最低</Text>
              <div style={{ color: '#ff4d4f' }}>
                {formatPrice(priceData.low)}
              </div>
            </Col>
          </Row>
        </>
      )}

      {lastUpdate && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            更新时间: {lastUpdate.toLocaleTimeString()}
          </Text>
        </div>
      )}
    </Card>
  );
};

export default RealTimePriceDisplay;
