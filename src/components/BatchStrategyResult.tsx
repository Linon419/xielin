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
  Statistic,
  Select
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
const { Option } = Select;

interface BatchStrategyResultProps {
  strategies: StrategyOutput[];
}

const BatchStrategyResult: React.FC<BatchStrategyResultProps> = ({ strategies }) => {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyOutput | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 跟踪每个策略的ATR类型选择，使用symbol作为key
  const [atrTypeSelections, setAtrTypeSelections] = useState<Record<string, '4h' | '1d'>>(() => {
    const initialSelections: Record<string, '4h' | '1d'> = {};
    strategies.forEach(strategy => {
      if (strategy.symbol) {
        initialSelections[strategy.symbol] = strategy.leverageAtrType || '4h';
      }
    });
    return initialSelections;
  });

  // 跟踪每个策略的滤波区间基准类型选择
  const [filterBaseSelections, setFilterBaseSelections] = useState<Record<string, 'currentPrice' | 'schellingPoint'>>(() => {
    const initialSelections: Record<string, 'currentPrice' | 'schellingPoint'> = {};
    strategies.forEach(strategy => {
      if (strategy.symbol) {
        initialSelections[strategy.symbol] = 'schellingPoint'; // 默认使用谢林点
      }
    });
    return initialSelections;
  });

  // 动态计算杠杆倍数
  const calculateDynamicLeverage = (strategy: StrategyOutput, atrType: '4h' | '1d'): number => {
    let atr: number, atrMax: number | undefined;

    if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
      atr = strategy.atr1d;
      atrMax = strategy.atr1dMax;
    } else {
      atr = strategy.atr4h || 0;
      atrMax = strategy.atr4hMax;
    }

    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const currentPrice = strategy.currentPrice || 0;

    if (currentPrice > 0 && atrForCalculation > 0) {
      return Math.floor(currentPrice / atrForCalculation);
    }

    return strategy.basic?.recommendedLeverage || 0;
  };

  // 计算滤波区间
  const calculateFilterRange = (strategy: StrategyOutput, atrType: '4h' | '1d', baseType: 'currentPrice' | 'schellingPoint') => {
    let atr: number, atrMax: number | undefined;

    if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
      atr = strategy.atr1d;
      atrMax = strategy.atr1dMax;
    } else {
      atr = strategy.atr4h || 0;
      atrMax = strategy.atr4hMax;
    }

    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const basePrice = baseType === 'currentPrice' ? (strategy.currentPrice || 0) : (strategy.schellingPoint || 0);

    if (basePrice > 0 && atrForCalculation > 0) {
      return {
        lower: basePrice - atrForCalculation,
        upper: basePrice + atrForCalculation,
        basePrice,
        atr: atrForCalculation
      };
    }

    return null;
  };

  // 更新ATR类型选择
  const updateAtrTypeSelection = (symbol: string, atrType: '4h' | '1d') => {
    setAtrTypeSelections(prev => ({
      ...prev,
      [symbol]: atrType
    }));
  };

  // 更新滤波区间基准类型选择
  const updateFilterBaseSelection = (symbol: string, baseType: 'currentPrice' | 'schellingPoint') => {
    setFilterBaseSelections(prev => ({
      ...prev,
      [symbol]: baseType
    }));
  };

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
      return [8, 12]; // 2张图用更小的间距，充分利用空间
    } else if (totalCount <= 4) {
      return [12, 12]; // 3-4张图用较小间距
    } else {
      return [8, 8]; // 5张图及以上用最小间距，最大化利用空间
    }
  };

  // 根据图表数量获取对应的CSS类名
  const getLayoutClassName = (totalCount: number): string => {
    if (totalCount === 1) {
      return 'one-chart';
    } else if (totalCount === 2) {
      return 'two-charts';
    } else if (totalCount === 3) {
      return 'three-charts';
    } else if (totalCount === 4) {
      return 'four-charts';
    } else if (totalCount === 5) {
      return 'five-charts';
    } else if (totalCount === 6) {
      return 'six-charts';
    } else {
      return 'many-charts';
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
              type="primary"
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
      key: 'leverage',
      width: 200,
      render: (_: any, record: StrategyOutput) => {
        const symbol = record.symbol || '';
        const selectedAtrType = atrTypeSelections[symbol] || '4h';
        const dynamicLeverage = calculateDynamicLeverage(record, selectedAtrType);
        const atrTypeLabel = selectedAtrType === '1d' ? '日线' : '4小时';

        let atr: number, atrMax: number | undefined;
        if (selectedAtrType === '1d') {
          atr = record.atr1d || 0;
          atrMax = record.atr1dMax;
        } else {
          atr = record.atr4h || 0;
          atrMax = record.atr4hMax;
        }

        const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
        const currentPrice = record.currentPrice || 0;
        const baseMultiplier = currentPrice > 0 && atrForCalculation > 0 ? currentPrice / atrForCalculation : 0;

        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Select
              value={selectedAtrType}
              size="small"
              style={{ width: '100%' }}
              onChange={(value: '4h' | '1d') => updateAtrTypeSelection(symbol, value)}
            >
              <Option value="4h">4小时ATR</Option>
              <Option value="1d">日线ATR（保守）</Option>
            </Select>

            <Tooltip
              title={
                <div>
                  <div><strong>杠杆计算公式：</strong></div>
                  <div>基础倍数 = 当前价格 ÷ {atrTypeLabel}ATR最大值</div>
                  <div>= {currentPrice.toFixed(2)} ÷ {atrForCalculation.toFixed(6)}</div>
                  <div>= {baseMultiplier.toFixed(2)}</div>
                  <div style={{ marginTop: 8 }}>
                    <div>建议杠杆 = Math.floor(基础倍数)</div>
                    <div>= Math.floor({baseMultiplier.toFixed(2)})</div>
                    <div>= <strong>{dynamicLeverage}倍</strong></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    使用{atrTypeLabel}ATR计算杠杆
                  </div>
                </div>
              }
              placement="top"
            >
              <Tag
                color={dynamicLeverage > 25 ? 'red' : dynamicLeverage > 10 ? 'orange' : 'green'}
                style={{ cursor: 'help', width: '100%', textAlign: 'center' }}
              >
                {dynamicLeverage}x
                {selectedAtrType === '1d' && (
                  <span style={{ fontSize: '10px', marginLeft: '2px' }}>(1d)</span>
                )}
              </Tag>
            </Tooltip>
          </Space>
        );
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aSymbol = a.symbol || '';
        const bSymbol = b.symbol || '';
        const aLeverage = calculateDynamicLeverage(a, atrTypeSelections[aSymbol] || '4h');
        const bLeverage = calculateDynamicLeverage(b, atrTypeSelections[bSymbol] || '4h');
        return aLeverage - bLeverage;
      }
    },
    {
      title: '入场价格',
      dataIndex: ['operations', 'entry', 'price'],
      key: 'entryPrice',
      render: (price: number) => price?.toFixed(6) || 'N/A',
      sorter: (a: StrategyOutput, b: StrategyOutput) => a.operations.entry.price - b.operations.entry.price
    },
    {
      title: '滤波区间',
      key: 'filterRange',
      width: 200,
      render: (_: any, record: StrategyOutput) => {
        const symbol = record.symbol || '';
        const selectedAtrType = atrTypeSelections[symbol] || '4h';
        const selectedBaseType = filterBaseSelections[symbol] || 'schellingPoint';
        const filterRange = calculateFilterRange(record, selectedAtrType, selectedBaseType);

        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Select
              value={selectedBaseType}
              size="small"
              style={{ width: '100%' }}
              onChange={(value: 'currentPrice' | 'schellingPoint') => updateFilterBaseSelection(symbol, value)}
            >
              <Option value="schellingPoint">谢林点基准</Option>
              <Option value="currentPrice">当前价格基准</Option>
            </Select>

            {filterRange && (
              <Tooltip
                title={
                  <div>
                    <div><strong>滤波区间计算公式：</strong></div>
                    <div>基准价格 = {selectedBaseType === 'currentPrice' ? '当前价格' : '谢林点'}</div>
                    <div>使用ATR = {selectedAtrType === '1d' ? '日线' : '4小时'}ATR最大值</div>
                    <div>下限 = {filterRange.basePrice.toFixed(6)} - {filterRange.atr.toFixed(6)}</div>
                    <div>上限 = {filterRange.basePrice.toFixed(6)} + {filterRange.atr.toFixed(6)}</div>
                    <div style={{ marginTop: 8 }}>
                      <div>滤波区间：<strong>{filterRange.lower.toFixed(6)} - {filterRange.upper.toFixed(6)}</strong></div>
                    </div>
                  </div>
                }
                placement="top"
              >
                <div style={{
                  cursor: 'help',
                  padding: '4px 8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: '#fafafa',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                    {selectedAtrType === '1d' ? '日线' : '4小时'}ATR区间
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}>
                    {filterRange.lower.toFixed(4)} - {filterRange.upper.toFixed(4)}
                  </div>
                </div>
              </Tooltip>
            )}

            {!filterRange && (
              <div style={{
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: '#f5f5f5',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', color: '#999' }}>数据不可用</div>
              </div>
            )}
          </Space>
        );
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aSymbol = a.symbol || '';
        const bSymbol = b.symbol || '';
        const aAtrType = atrTypeSelections[aSymbol] || '4h';
        const bAtrType = atrTypeSelections[bSymbol] || '4h';
        const aBaseType = filterBaseSelections[aSymbol] || 'schellingPoint';
        const bBaseType = filterBaseSelections[bSymbol] || 'schellingPoint';

        const aRange = calculateFilterRange(a, aAtrType, aBaseType);
        const bRange = calculateFilterRange(b, bAtrType, bBaseType);

        if (!aRange && !bRange) return 0;
        if (!aRange) return 1;
        if (!bRange) return -1;

        return aRange.lower - bRange.lower;
      }
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
      title: '日线ATR',
      key: 'atr1d',
      render: (_: any, record: StrategyOutput) => {
        // 从原始输入数据获取日线ATR信息
        const atr1d = record.atr1d;
        const atr1dMax = record.atr1dMax;
        if (atr1d) {
          return (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {atr1d.toFixed(6)}
              </div>
              {atr1dMax && atr1dMax > atr1d && (
                <div style={{ fontSize: '11px', color: '#fa8c16' }}>
                  最大: {atr1dMax.toFixed(6)}
                </div>
              )}
            </div>
          );
        }
        return 'N/A';
      },
      sorter: (a: StrategyOutput, b: StrategyOutput) => {
        const aA = a.atr1d || 0;
        const bA = b.atr1d || 0;
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
        <Row gutter={12}>
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

        {/* 批量设置 */}
        <Row style={{ marginBottom: 16 }} gutter={[16, 8]}>
          <Col xs={24} lg={12}>
            <Space>
              <Text strong>批量设置杠杆ATR类型：</Text>
              <Select
                placeholder="选择ATR类型"
                style={{ width: 200 }}
                onChange={(value: '4h' | '1d') => {
                  const newSelections: Record<string, '4h' | '1d'> = {};
                  strategies.forEach(strategy => {
                    if (strategy.symbol) {
                      newSelections[strategy.symbol] = value;
                    }
                  });
                  setAtrTypeSelections(newSelections);
                }}
              >
                <Option value="4h">全部使用4小时ATR</Option>
                <Option value="1d">全部使用日线ATR（保守）</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} lg={12}>
            <Space>
              <Text strong>批量设置滤波区间基准：</Text>
              <Select
                placeholder="选择基准类型"
                style={{ width: 200 }}
                onChange={(value: 'currentPrice' | 'schellingPoint') => {
                  const newSelections: Record<string, 'currentPrice' | 'schellingPoint'> = {};
                  strategies.forEach(strategy => {
                    if (strategy.symbol) {
                      newSelections[strategy.symbol] = value;
                    }
                  });
                  setFilterBaseSelections(newSelections);
                }}
              >
                <Option value="schellingPoint">全部使用谢林点基准</Option>
                <Option value="currentPrice">全部使用当前价格基准</Option>
              </Select>
            </Space>
          </Col>
        </Row>
        <Row style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 提示：ATR类型影响杠杆计算和滤波区间大小，基准类型决定滤波区间的中心点
            </Text>
          </Col>
        </Row>

        {/* 策略列表 */}
        <Table
          dataSource={strategies}
          columns={columns}
          rowKey={(record) => record.symbol || Math.random().toString()}
          size="small"
          scroll={{ x: 1550 }}
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
              ) : strategies.length === 2 ? (
                // 2张图使用纯CSS Flexbox布局，避免Ant Design Grid问题
                <div className="two-charts-flex-container" style={{
                  display: 'flex',
                  gap: '8px', // 减少间距，充分利用空间
                  width: '100%'
                }}>
                  {strategies.map((strategy, index) => (
                    <div
                      key={strategy.symbol || index}
                      style={{
                        flex: '1 1 50%',
                        width: '50%',
                        maxWidth: '50%'
                      }}
                    >
                      <div className="strategy-chart-container" style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: '8px',
                        backgroundColor: '#fff',
                        padding: '12px',
                        height: '100%',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                        transition: 'box-shadow 0.3s ease'
                      }}>
                        {/* 标题栏 */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div className="chart-title">
                            <Space>
                              <Text strong>{strategy.symbol}</Text>
                              <Tag color={strategy.type === '兜底区' ? 'green' : 'orange'}>
                                {strategy.type}
                              </Tag>
                              <Tag color="blue">{strategy.basic.recommendedLeverage}x杠杆</Tag>
                            </Space>
                          </div>
                          {strategy.symbol && (
                            <SubscribeButton
                              symbol={strategy.symbol}
                              size="small"
                              type="primary"
                            />
                          )}
                        </div>

                        {/* 图表内容 */}
                        <div className="chart-container" style={{ height: 'calc(100% - 60px)' }}>
                          <PriceChart
                            input={convertToStrategyInput(strategy)}
                            compact={true}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // 其他数量使用Row/Col布局
                <Row
                  gutter={getGutter(strategies.length)}
                  className={getLayoutClassName(strategies.length)}
                >
                  {strategies.map((strategy, index) => {
                    const responsiveSpan = getResponsiveSpan(strategies.length);
                    return (
                      <Col {...responsiveSpan} key={strategy.symbol || index}>
                        <div className="strategy-chart-container" style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: '8px',
                          backgroundColor: '#fff',
                          padding: '12px',
                          height: '100%',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                          transition: 'box-shadow 0.3s ease'
                        }}>
                          {/* 标题栏 */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <div className="chart-title">
                              <Space>
                                <Text strong>{strategy.symbol}</Text>
                                <Tag color={strategy.type === '兜底区' ? 'green' : 'orange'}>
                                  {strategy.type}
                                </Tag>
                                <Tag color="blue">{strategy.basic.recommendedLeverage}x杠杆</Tag>
                              </Space>
                            </div>
                            {strategy.symbol && (
                              <SubscribeButton
                                symbol={strategy.symbol}
                                size="small"
                                type="primary"
                              />
                            )}
                          </div>

                          {/* 图表内容 */}
                          <div className="chart-container" style={{ height: 'calc(100% - 60px)' }}>
                            <PriceChart
                              input={convertToStrategyInput(strategy)}
                              compact={true}
                            />
                          </div>
                        </div>
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
