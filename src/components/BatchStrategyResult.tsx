import React, { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Tooltip,
  Modal,
  Typography,
  Divider,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { StrategyOutput, StrategyInput } from '../types/strategy';
import StrategyResult from './StrategyResult';
import PriceChart from './PriceChart';
import SubscribeButton from './SubscribeButton';
import './BatchStrategyResult.css';

const { Text } = Typography;

interface BatchStrategyResultProps {
  strategies: StrategyOutput[];
}

const BatchStrategyResult: React.FC<BatchStrategyResultProps> = ({ strategies }) => {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyOutput | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 根据图表数量计算自适应列宽和间距
  const getResponsiveSpan = (totalCount: number) => {
    if (totalCount === 1) {
      return { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 }; // 1张图占满屏幕
    } else if (totalCount === 2) {
      return { xs: 24, sm: 24, md: 12, lg: 12, xl: 12 }; // 2张图各占一半
    } else if (totalCount === 3) {
      return { xs: 24, sm: 24, md: 12, lg: 8, xl: 8 }; // 3张图各占1/3
    } else if (totalCount === 4) {
      return { xs: 24, sm: 12, md: 12, lg: 6, xl: 6 }; // 4张图各占1/4
    } else if (totalCount === 5) {
      return { xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }; // 5张图，xl下每行5个，lg下每行4个
    } else if (totalCount === 6) {
      return { xs: 24, sm: 12, md: 8, lg: 4, xl: 4 }; // 6张图各占1/6
    } else {
      // 7张图及以上，使用固定布局
      return { xs: 24, sm: 12, md: 8, lg: 6, xl: 4 };
    }
  };

  // 根据图表数量计算合适的间距
  const getGutter = (totalCount: number): [number, number] => {
    if (totalCount === 1) {
      return [0, 0]; // 单图不需要间距
    } else if (totalCount === 2) {
      return [12, 16]; // 2张图用较小的水平间距
    } else if (totalCount <= 4) {
      return [16, 16]; // 3-4张图用标准间距
    } else {
      return [12, 12]; // 5张图及以上用较小间距，节省空间
    }
  };

  // 将StrategyOutput转换为StrategyInput（用于PriceChart）
  const convertToStrategyInput = (strategy: StrategyOutput): StrategyInput => {
    return {
      symbol: strategy.symbol || '',
      currentPrice: strategy.currentPrice || 0,
      schellingPoint: strategy.schellingPoint || 0,
      type: strategy.type || '兜底区',
      atr4h: strategy.operations?.riskControl?.atrInfo?.atr15m || 0.001, // 使用15分钟ATR作为4小时ATR的替代
      atr15m: strategy.operations?.riskControl?.atrInfo?.atr15m || 0.001,
      high24h: strategy.high24h,
      low24h: strategy.low24h,
      strictValidation: false // 批量模式不需要严格验证
    };
  };

  // 查看详细策略
  const handleViewDetail = (strategy: StrategyOutput) => {
    setSelectedStrategy(strategy);
    setDetailModalVisible(true);
  };

  // 导出策略数据
  const handleExport = () => {
    const exportData = strategies.map(strategy => ({
      币种: strategy.symbol || 'N/A',
      策略类型: strategy.type || 'N/A',
      谢林点: strategy.schellingPoint || 0,
      当前价格: strategy.currentPrice || 0,
      建议杠杆: strategy.basic.recommendedLeverage,
      入场价格: strategy.operations.entry.price,
      止盈百分比: strategy.operations?.riskControl?.atrInfo?.takeProfitPercent ?
        `${strategy.operations.riskControl.atrInfo.takeProfitPercent.toFixed(2)}%` : 'N/A',
      '15分钟ATR': strategy.operations?.riskControl?.atrInfo?.atr15m?.toFixed(6) || 'N/A',
      '15分钟ATR最大值': strategy.operations?.riskControl?.atrInfo?.atr15mMax?.toFixed(6) || 'N/A',
      '4小时ATR': strategy.atr4h?.toFixed(6) || 'N/A',
      '4小时ATR最大值': strategy.atr4hMax?.toFixed(6) || 'N/A',
      止损价格: strategy.operations.riskControl.stopLoss,
      止盈价格: strategy.operations.riskControl.takeProfit,
      风险等级: strategy.basic.riskLevel
    }));

    const csvContent = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_strategies_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 计算统计数据
  const stats = {
    total: strategies.length,
    supportStrategies: strategies.filter(s => s.type === '兜底区').length,
    breakoutStrategies: strategies.filter(s => s.type === '探顶区').length,
    avgLeverage: strategies.reduce((sum, s) => sum + s.basic.recommendedLeverage, 0) / strategies.length,
    highRiskCount: strategies.filter(s => s.basic.riskLevel === 'high').length
  };

  // 表格列定义
  const columns = [
    {
      title: '币种',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: StrategyOutput) => (
        <div>
          <Space align="center">
            <Tag color="blue">{symbol}</Tag>
            <SubscribeButton
              symbol={symbol}
              size="small"
              type="text"
            />
          </Space>
          {record.warnings && record.warnings.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {record.warnings.map((warning, index) => (
                <Tooltip
                  key={index}
                  title={warning.message}
                  placement="top"
                >
                  <Tag color="orange" style={{ fontSize: '12px', cursor: 'help' }}>
                    ⚠️
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      ),
      sorter: (a: StrategyOutput, b: StrategyOutput) =>
        (a.symbol || '').localeCompare(b.symbol || '')
    },
    {
      title: '策略类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag
          color={type === '兜底区' ? 'green' : 'orange'}
          icon={type === '兜底区' ? <FallOutlined /> : <RiseOutlined />}
        >
          {type}
        </Tag>
      ),
      filters: [
        { text: '兜底区', value: '兜底区' },
        { text: '探顶区', value: '探顶区' }
      ],
      onFilter: (value: any, record: StrategyOutput) => record.type === value
    },
    {
      title: '谢林点',
      dataIndex: 'schellingPoint',
      key: 'schellingPoint',
      render: (point: number) => point?.toFixed(6) || 'N/A',
      sorter: (a: StrategyOutput, b: StrategyOutput) =>
        (a.schellingPoint || 0) - (b.schellingPoint || 0)
    },
    {
      title: '当前价格',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      render: (price: number) => price?.toFixed(6) || 'N/A',
      sorter: (a: StrategyOutput, b: StrategyOutput) =>
        (a.currentPrice || 0) - (b.currentPrice || 0)
    },
    {
      title: '建议杠杆',
      dataIndex: ['basic', 'recommendedLeverage'],
      key: 'leverage',
      render: (leverage: number, record: StrategyOutput) => {
        const atr4h = record.atr4hMax || record.atr4h || 0;
        const currentPrice = record.currentPrice || 0;
        const baseMultiplier = currentPrice > 0 && atr4h > 0 ? currentPrice / atr4h : 0;

        return (
          <Tooltip
            title={
              <div>
                <div><strong>杠杆计算公式：</strong></div>
                <div>基础倍数 = 当前价格 ÷ 4小时ATR最大值</div>
                <div>= {currentPrice.toFixed(2)} ÷ {atr4h.toFixed(6)}</div>
                <div>= {baseMultiplier.toFixed(2)}</div>
                <div style={{ marginTop: 8 }}>
                  <div>建议杠杆 = Math.floor(基础倍数)</div>
                  <div>= Math.floor({baseMultiplier.toFixed(2)})</div>
                  <div>= <strong>{leverage}倍</strong></div>
                </div>
              </div>
            }
            placement="top"
          >
            <Tag
              color={leverage > 25 ? 'red' : leverage > 10 ? 'orange' : 'green'}
              style={{ cursor: 'help' }}
            >
              {leverage}x
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => a.basic.recommendedLeverage - b.basic.recommendedLeverage
    },
    {
      title: '入场价格',
      dataIndex: ['operations', 'entry', 'price'],
      key: 'entryPrice',
      render: (price: number) => price?.toFixed(6) || 'N/A',
      sorter: (a: StrategyOutput, b: StrategyOutput) => a.operations.entry.price - b.operations.entry.price
    },
    {
      title: '止盈百分比',
      key: 'takeProfitPercent',
      render: (_: any, record: StrategyOutput) => {
        const atrInfo = record.operations?.riskControl?.atrInfo;
        if (atrInfo?.takeProfitPercent) {
          return (
            <Text type="success">
              {atrInfo.takeProfitPercent.toFixed(2)}%
            </Text>
          );
        }
        return 'N/A';
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aA = a.operations?.riskControl?.atrInfo?.takeProfitPercent || 0;
        const bA = b.operations?.riskControl?.atrInfo?.takeProfitPercent || 0;
        return aA - bA;
      }
    },
    {
      title: '15分钟ATR',
      key: 'atr15m',
      render: (_: any, record: StrategyOutput) => {
        const atrInfo = record.operations?.riskControl?.atrInfo;
        if (atrInfo?.atr15m) {
          return (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {atrInfo.atr15m.toFixed(6)}
              </div>
              {atrInfo.atr15mMax > atrInfo.atr15m && (
                <div style={{ fontSize: '11px', color: '#fa8c16' }}>
                  最大: {atrInfo.atr15mMax.toFixed(6)}
                </div>
              )}
            </div>
          );
        }
        return 'N/A';
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aA = a.operations?.riskControl?.atrInfo?.atr15m || 0;
        const bA = b.operations?.riskControl?.atrInfo?.atr15m || 0;
        return aA - bA;
      }
    },
    {
      title: '4小时ATR',
      key: 'atr4h',
      render: (_: any, record: StrategyOutput) => {
        // 从原始输入数据获取4小时ATR信息
        const atr4h = record.atr4h;
        const atr4hMax = record.atr4hMax;
        if (atr4h) {
          return (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {atr4h.toFixed(6)}
              </div>
              {atr4hMax && atr4hMax > atr4h && (
                <div style={{ fontSize: '11px', color: '#fa8c16' }}>
                  最大: {atr4hMax.toFixed(6)}
                </div>
              )}
            </div>
          );
        }
        return 'N/A';
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aA = a.atr4h || 0;
        const bA = b.atr4h || 0;
        return aA - bA;
      }
    },

    {
      title: '风险等级',
      dataIndex: ['basic', 'riskLevel'],
      key: 'riskLevel',
      render: (level: string) => {
        const colorMap = {
          'low': 'green',
          'medium': 'orange',
          'high': 'red'
        };
        const textMap = {
          'low': '低风险',
          'medium': '中风险',
          'high': '高风险'
        };
        return <Tag color={colorMap[level as keyof typeof colorMap]}>{textMap[level as keyof typeof textMap]}</Tag>;
      },
      filters: [
        { text: '低风险', value: 'low' },
        { text: '中风险', value: 'medium' },
        { text: '高风险', value: 'high' }
      ],
      onFilter: (value: any, record: StrategyOutput) => record.basic.riskLevel === value
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: StrategyOutput) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
          size="small"
        >
          查看详情
        </Button>
      )
    }
  ];

  if (strategies.length === 0) {
    return null;
  }

  return (
    <Card
      title={
        <Space>
          <TrophyOutlined />
          批量策略结果 ({strategies.length} 个)
        </Space>
      }
      extra={
        <Button
          icon={<DownloadOutlined />}
          onClick={handleExport}
          type="primary"
          size="small"
        >
          导出CSV
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 统计概览 */}
        <Row gutter={16}>
          <Col span={4}>
            <Statistic
              title="总策略数"
              value={stats.total}
              prefix={<TrophyOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="兜底区策略"
              value={stats.supportStrategies}
              prefix={<FallOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="探顶区策略"
              value={stats.breakoutStrategies}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="平均杠杆"
              value={stats.avgLeverage}
              precision={1}
              suffix="x"
            />
          </Col>

          <Col span={4}>
            <Statistic
              title="高风险策略"
              value={stats.highRiskCount}
              valueStyle={{ color: stats.highRiskCount > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Col>
        </Row>

        <Divider />

        {/* 策略列表 */}
        <Table
          dataSource={strategies}
          columns={columns}
          rowKey={(record) => record.symbol || Math.random().toString()}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条策略`
          }}
        />

        {/* 所有标的价格分析图表 */}
        {strategies.length > 0 && (
          <>
            <Divider orientation="left">
              <Space>
                <LineChartOutlined />
                所有标的价格分析图表
              </Space>
            </Divider>

            <Card size="small" className="layout-info">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>同时展示所有 {strategies.length} 个标的的价格走势，便于对比分析</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {strategies.length === 1 && '💻 单图全屏显示模式 - 图表占满整个屏幕宽度'}
                  {strategies.length === 2 && '💻 双图并排显示模式 - 每图占屏幕50%宽度'}
                  {strategies.length === 3 && '💻 三图自适应显示模式 - 每图占屏幕33.3%宽度'}
                  {strategies.length === 4 && '💻 四图网格显示模式 - 每图占屏幕25%宽度'}
                  {strategies.length === 5 && '💻 五图自适应显示模式 - 每图占屏幕20%宽度'}
                  {strategies.length === 6 && '💻 六图网格显示模式 - 每图占屏幕16.7%宽度'}
                  {strategies.length > 6 && `💻 多图网格显示模式 - ${strategies.length}个图表自适应布局`}
                </Text>
              </Space>
            </Card>

            {/* 所有策略的价格分析图表 */}
            <div className={`adaptive-grid ${
              strategies.length === 1 ? 'single-chart' :
              strategies.length === 2 ? 'two-charts' :
              strategies.length === 3 ? 'three-charts' :
              strategies.length === 4 ? 'four-charts' :
              strategies.length === 5 ? 'five-charts' :
              strategies.length === 6 ? 'six-charts' :
              'many-charts'
            }`}>
              {strategies.length === 5 ? (
                // 5张图使用特殊的flex布局
                <div className="five-charts-container">
                  {strategies.map((strategy, index) => (
                    <div className="five-charts-item" key={strategy.symbol || index}>
                      <Card
                        title={
                          <div className="chart-title">
                            <Space>
                              <Text strong>{strategy.symbol}</Text>
                              <Tag color={strategy.type === '兜底区' ? 'green' : 'orange'}>
                                {strategy.type}
                              </Tag>
                              <Tag color="blue">{strategy.basic.recommendedLeverage}x杠杆</Tag>
                            </Space>
                          </div>
                        }
                        size="small"
                        className="chart-card"
                      >
                        <div className="chart-container">
                          <PriceChart
                            input={convertToStrategyInput(strategy)}
                            compact={true}
                          />
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                // 其他数量使用Row/Col布局
                <Row gutter={getGutter(strategies.length)}>
                  {strategies.map((strategy, index) => {
                    const responsiveSpan = getResponsiveSpan(strategies.length);
                    return (
                      <Col {...responsiveSpan} key={strategy.symbol || index}>
                        <Card
                          title={
                            <div className="chart-title">
                              <Space>
                                <Text strong>{strategy.symbol}</Text>
                                <Tag color={strategy.type === '兜底区' ? 'green' : 'orange'}>
                                  {strategy.type}
                                </Tag>
                                <Tag color="blue">{strategy.basic.recommendedLeverage}x杠杆</Tag>
                              </Space>
                            </div>
                          }
                          size="small"
                          className="chart-card"
                        >
                          <div className="chart-container">
                            <PriceChart
                              input={convertToStrategyInput(strategy)}
                              compact={true}
                            />
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>


          </>
        )}
      </Space>

      {/* 详情弹窗 */}
      <Modal
        title={`${selectedStrategy?.symbol || 'N/A'} 策略详情`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        {selectedStrategy && (
          <StrategyResult strategy={selectedStrategy} />
        )}
      </Modal>
    </Card>
  );
};

export default BatchStrategyResult;
