import React, { useMemo } from 'react';
import { Card, Space, Tag, Tooltip, Typography } from 'antd';
import { TrendingUpOutlined, TrendingDownOutlined, MinusOutlined } from '@ant-design/icons';
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
    if (ohlcvData.length < 35) return []; // 需要足够的数据点
    return calculateMACD(ohlcvData);
  }, [ohlcvData]);

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
    if (macdData.length === 0) return {};

    // 准备数据
    const timestamps = macdData.map(item => item.timestamp);
    const macdLine = macdData.map(item => [item.timestamp, item.macd]);
    const signalLine = macdData.map(item => [item.timestamp, item.signal]);
    const histogramData = macdData.map(item => [item.timestamp, item.histogram]);

    return {
      animation: false,
      grid: {
        left: compact ? '8%' : '10%',
        right: compact ? '8%' : '10%',
        top: compact ? '15%' : '20%',
        bottom: compact ? '15%' : '20%'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          
          const timestamp = params[0].axisValue;
          const date = new Date(timestamp).toLocaleString();
          
          let content = `<div style="font-size: 12px;">
            <div style="margin-bottom: 4px;"><strong>${date}</strong></div>`;
          
          params.forEach((param: any) => {
            const value = typeof param.value === 'number' ? param.value : param.value[1];
            content += `<div style="color: ${param.color};">
              ${param.seriesName}: ${value.toFixed(6)}
            </div>`;
          });
          
          content += '</div>';
          return content;
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: compact ? 10 : 12,
          formatter: (value: number) => {
            const date = new Date(value);
            return compact ? 
              `${date.getMonth() + 1}/${date.getDate()}` :
              `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: compact ? 10 : 12,
          formatter: (value: number) => value.toFixed(4)
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
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
  }, [macdData, compact]);

  // 获取信号图标和颜色
  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return <TrendingUpOutlined style={{ color: '#52c41a' }} />;
      case 'SELL':
        return <TrendingDownOutlined style={{ color: '#ff4d4f' }} />;
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
        style={{ height: compact ? '300px' : '400px' }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '200px',
          color: '#8c8c8c'
        }}>
          数据不足，无法计算MACD指标
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
              <Tag color={getSignalColor(analysis.signalType)} size="small">
                {analysis.signalType === 'BUY' ? '金叉' : 
                 analysis.signalType === 'SELL' ? '死叉' : '观望'}
              </Tag>
              <Tag color={analysis.trend === 'BULLISH' ? 'green' : 
                         analysis.trend === 'BEARISH' ? 'red' : 'default'} size="small">
                {analysis.trend === 'BULLISH' ? '看涨' : 
                 analysis.trend === 'BEARISH' ? '看跌' : '中性'}
              </Tag>
            </Space>
          )}
        </div>
      }
      size={compact ? 'small' : 'default'}
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
      {!compact && analysis && (
        <div style={{ marginBottom: '12px', fontSize: '12px' }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
            <Text>
              MACD: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {analysis.current.macd.toFixed(6)}
              </span>
            </Text>
            <Text>
              Signal: <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {analysis.current.signal.toFixed(6)}
              </span>
            </Text>
            <Text>
              Histogram: <span style={{ 
                color: analysis.current.histogram >= 0 ? '#52c41a' : '#ff4d4f', 
                fontWeight: 'bold' 
              }}>
                {analysis.current.histogram.toFixed(6)}
              </span>
            </Text>
            {(divergence.bullishDivergence || divergence.bearishDivergence) && (
              <Text>
                <Tag color={divergence.bullishDivergence ? 'green' : 'red'} size="small">
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
        style={{ height: compact ? '200px' : '280px' }}
        opts={{ renderer: 'canvas' }}
      />
    </Card>
  );
};

export default MACDChart;
