import React, { useMemo } from 'react';
import { Card, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { OHLCVData } from '../services/contractDataService';
import { 
  calculateMACD, 
  analyzeMACDSignal, 
  detectMACDDivergence, 
  getMACDTradingAdvice,
  MACDData,
  MACDAnalysis 
} from '../utils/macdCalculator';

const { Text } = Typography;

interface MACDChartProps {
  ohlcvData: OHLCVData[];
  symbol: string;
  compact?: boolean;
}

const MACDChart: React.FC<MACDChartProps> = ({ ohlcvData, symbol, compact = false }) => {
  // 计算MACD数据
  const macdData = useMemo(() => {
    // 降低数据要求：26(慢线) + 9(信号线) = 35，但我们可以用更少的数据
    const minRequired = 30; // 降低要求
    if (ohlcvData.length < minRequired) {
      console.log(`MACD: ${symbol} - 数据不足，需要${minRequired}个数据点，当前只有${ohlcvData.length}个`);
      return [];
    }
    const result = calculateMACD(ohlcvData);
    console.log(`MACD: ${symbol} - 计算完成，生成${result.length}个MACD数据点`);
    if (result.length > 0) {
      console.log(`MACD: ${symbol} - 最新数据:`, result[result.length - 1]);
    }
    return result;
  }, [ohlcvData, symbol]);

  // 分析MACD信号
  const analysis = useMemo(() => {
    if (macdData.length < 2) return null;
    return analyzeMACDSignal(macdData);
  }, [macdData]);

  // 检测背离
  const divergence = useMemo(() => {
    if (ohlcvData.length < 20 || macdData.length < 20) {
      return { bullishDivergence: false, bearishDivergence: false, divergenceStrength: 0 };
    }
    return detectMACDDivergence(ohlcvData, macdData);
  }, [ohlcvData, macdData]);

  // 获取交易建议
  const tradingAdvice = useMemo(() => {
    if (!analysis) return null;
    return getMACDTradingAdvice(analysis);
  }, [analysis]);

  // 构建ECharts配置
  const chartOption = useMemo(() => {
    if (macdData.length === 0) {
      console.log(`MACD Chart: ${symbol} - 没有MACD数据，返回空配置`);
      return {};
    }

    console.log(`MACD Chart: ${symbol} - 构建图表配置，数据点数量: ${macdData.length}`);

    // 准备数据
    const timestamps = macdData.map(item => item.timestamp);
    const macdLine = macdData.map(item => [item.timestamp, item.macd]);
    const signalLine = macdData.map(item => [item.timestamp, item.signal]);
    const histogramData = macdData.map(item => [item.timestamp, item.histogram]);

    const macdRange = [Math.min(...macdLine.map(d => d[1])), Math.max(...macdLine.map(d => d[1]))];
    const signalRange = [Math.min(...signalLine.map(d => d[1])), Math.max(...signalLine.map(d => d[1]))];
    const histogramRange = [Math.min(...histogramData.map(d => d[1])), Math.max(...histogramData.map(d => d[1]))];

    console.log(`MACD Chart: ${symbol} - 数据范围:`, {
      macdRange,
      signalRange,
      histogramRange,
      dataCount: macdData.length,
      firstPoint: macdLine[0],
      lastPoint: macdLine[macdLine.length - 1]
    });

    const config = {
      animation: false,
      backgroundColor: 'transparent',
      grid: {
        left: '12%',
        right: '8%',
        top: '15%',
        bottom: '25%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          formatter: (value: number) => value.toFixed(4)
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      series: [
        {
          name: 'MACD',
          type: 'line',
          data: macdLine,
          lineStyle: {
            color: '#1890ff',
            width: compact ? 1 : 2
          },
          symbol: 'none',
          smooth: false
        },
        {
          name: 'Signal',
          type: 'line',
          data: signalLine,
          lineStyle: {
            color: '#ff4d4f',
            width: compact ? 1 : 2
          },
          symbol: 'none',
          smooth: false
        },
        {
          name: 'Histogram',
          type: 'bar',
          data: histogramData,
          itemStyle: {
            color: (params: any) => {
              const value = params.value[1];
              return value >= 0 ? '#52c41a' : '#ff4d4f';
            }
          },
          barWidth: compact ? '60%' : '80%'
        }
      ]
    };

    console.log(`MACD Chart: ${symbol} - 最终配置:`, {
      hasGrid: !!config.grid,
      hasXAxis: !!config.xAxis,
      hasYAxis: !!config.yAxis,
      seriesCount: config.series.length,
      macdDataPoints: config.series[0].data.length,
      signalDataPoints: config.series[1].data.length,
      histogramDataPoints: config.series[2].data.length
    });

    return config;
  }, [macdData, compact, symbol]);

  // 获取信号图标和颜色
  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      case 'SELL':
        return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <MinusOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getSignalColor = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return 'success';
      case 'SELL':
        return 'error';
      default:
        return 'default';
    }
  };

  if (macdData.length === 0) {
    return (
      <Card
        title={`${symbol} MACD指标`}
        size={compact ? 'small' : 'default'}
        style={{ minHeight: compact ? '380px' : '450px' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '250px',
          color: '#8c8c8c'
        }}>
          数据不足，无法计算MACD指标（需要至少30个数据点，当前：{ohlcvData.length}个）
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: compact ? '14px' : '16px' }}>
            {symbol} MACD指标
          </span>
          {analysis && (
            <Space size="small">
              {getSignalIcon(analysis.signalType)}
              <Tag color={getSignalColor(analysis.signalType)}>
                {analysis.signalType === 'BUY' ? '金叉' :
                 analysis.signalType === 'SELL' ? '死叉' : '观望'}
              </Tag>
              <Tag color={analysis.trend === 'BULLISH' ? 'green' :
                         analysis.trend === 'BEARISH' ? 'red' : 'default'}>
                {analysis.trend === 'BULLISH' ? '看涨' :
                 analysis.trend === 'BEARISH' ? '看跌' : '中性'}
              </Tag>
            </Space>
          )}
        </div>
      }
      size={compact ? 'small' : 'default'}
      style={{ minHeight: compact ? '380px' : '450px' }}
      extra={
        !compact && tradingAdvice && (
          <Tooltip title={tradingAdvice.reason}>
            <Tag color={
              tradingAdvice.action.includes('买入') ? 'green' :
              tradingAdvice.action.includes('卖出') ? 'red' : 'default'
            }>
              {tradingAdvice.action} ({(tradingAdvice.confidence * 100).toFixed(0)}%)
            </Tag>
          </Tooltip>
        )
      }
    >
      {/* MACD数值显示 */}
      {analysis && (
        <div style={{
          marginBottom: compact ? '8px' : '12px',
          fontSize: compact ? '11px' : '12px'
        }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>} size="small">
            <Text>
              MACD: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {analysis.current.macd.toFixed(compact ? 4 : 6)}
              </span>
            </Text>
            <Text>
              Signal: <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {analysis.current.signal.toFixed(compact ? 4 : 6)}
              </span>
            </Text>
            <Text>
              Histogram: <span style={{
                color: analysis.current.histogram >= 0 ? '#52c41a' : '#ff4d4f',
                fontWeight: 'bold'
              }}>
                {analysis.current.histogram.toFixed(compact ? 4 : 6)}
              </span>
            </Text>
            {!compact && (divergence.bullishDivergence || divergence.bearishDivergence) && (
              <Text>
                <Tag color={divergence.bullishDivergence ? 'green' : 'red'}>
                  {divergence.bullishDivergence ? '看涨背离' : '看跌背离'}
                </Tag>
              </Text>
            )}
          </Space>
        </div>
      )}

      {/* MACD图表 */}
      <ReactECharts
        option={chartOption}
        style={{ height: compact ? '300px' : '350px' }}
        opts={{ renderer: 'canvas' }}
      />
    </Card>
  );
};

export default MACDChart;
