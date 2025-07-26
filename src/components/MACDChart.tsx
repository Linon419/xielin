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
  timeframe?: string; // 添加时间周期参数，用于时间轴格式化
}

const MACDChart: React.FC<MACDChartProps> = ({ ohlcvData, symbol, compact = false, timeframe = '1h' }) => {
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

    // 过滤出有效数据并准备图表数据
    const validData = macdData.filter(item =>
      item.macd !== null && item.signal !== null && item.histogram !== null
    );

    if (validData.length === 0) {
      console.log(`MACD Chart: ${symbol} - 没有有效的MACD数据`);
      return {};
    }

    const macdLine = validData.map(item => [item.timestamp, item.macd!]);
    const signalLine = validData.map(item => [item.timestamp, item.signal!]);
    const histogramData = validData.map(item => [item.timestamp, item.histogram!]);

    const macdValues = macdLine.map(d => d[1] as number);
    const signalValues = signalLine.map(d => d[1] as number);
    const histogramValues = histogramData.map(d => d[1] as number);

    const macdRange = [Math.min(...macdValues), Math.max(...macdValues)];
    const signalRange = [Math.min(...signalValues), Math.max(...signalValues)];
    const histogramRange = [Math.min(...histogramValues), Math.max(...histogramValues)];

    console.log(`MACD Chart: ${symbol} - 数据范围:`, {
      macdRange,
      signalRange,
      histogramRange,
      validDataCount: validData.length,
      totalDataCount: macdData.length,
      firstPoint: macdLine[0],
      lastPoint: macdLine[macdLine.length - 1]
    });

    // 检查数据格式
    console.log(`MACD Chart: ${symbol} - 数据样本:`, {
      macdSample: macdLine.slice(0, 3),
      signalSample: signalLine.slice(0, 3),
      histogramSample: histogramData.slice(0, 3),
      timeRange: [new Date(macdLine[0][0]).toISOString(), new Date(macdLine[macdLine.length-1][0]).toISOString()]
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
          fontSize: 10,
          formatter: function (value: number) {
            const date = new Date(value);
            // 根据时间周期选择不同的显示格式，与价格图表保持一致
            switch (timeframe) {
              case '1m':
                return date.toLocaleString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                });
              case '15m':
                return date.toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              case '1h':
                return date.toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              case '4h':
                return date.toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit'
                });
              default:
                return date.toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
            }
          }
        },
        axisTick: {
          show: true
        },
        axisLine: {
          show: true
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
        },
        // 强制设置Y轴范围，确保数据可见
        min: (value: any) => {
          const min = Math.min(...macdRange, ...signalRange, ...histogramRange);
          return min * 1.1; // 留10%边距
        },
        max: (value: any) => {
          const max = Math.max(...macdRange, ...signalRange, ...histogramRange);
          return max * 1.1; // 留10%边距
        }
      },
      series: [
        {
          name: 'MACD',
          type: 'line',
          data: macdLine,
          lineStyle: {
            color: '#1890ff',
            width: 2, // 强制使用较粗的线条
            opacity: 1
          },
          symbol: 'none',
          smooth: false,
          emphasis: {
            lineStyle: {
              width: 3
            }
          }
        },
        {
          name: 'Signal',
          type: 'line',
          data: signalLine,
          lineStyle: {
            color: '#ff4d4f',
            width: 2, // 强制使用较粗的线条
            opacity: 1
          },
          symbol: 'none',
          smooth: false,
          emphasis: {
            lineStyle: {
              width: 3
            }
          }
        },
        {
          name: 'Histogram',
          type: 'bar',
          data: histogramData,
          itemStyle: {
            color: (params: any) => {
              const value = params.value[1];
              return value >= 0 ? '#52c41a' : '#ff4d4f';
            },
            opacity: 0.8
          },
          barWidth: '60%',
          emphasis: {
            itemStyle: {
              opacity: 1
            }
          }
        },
        // 添加零线参考
        {
          name: '零线',
          type: 'line',
          data: macdLine.map(item => [item[0], 0]),
          lineStyle: {
            color: '#666666',
            width: 1,
            type: 'dashed',
            opacity: 0.5
          },
          symbol: 'none',
          silent: true, // 不响应鼠标事件
          z: 1 // 置于底层
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
      <div className="macd-chart-container" style={{
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        backgroundColor: '#fff',
        padding: compact ? '12px' : '16px',
        minHeight: compact ? '380px' : '450px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#8c8c8c',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#262626', marginBottom: '16px' }}>
            {symbol} MACD指标
          </h3>
          <p>数据不足，无法计算MACD指标</p>
          <p>需要至少30个数据点，当前：{ohlcvData.length}个</p>
        </div>
      </div>
    );
  }

  // 检查chartOption是否为空
  if (!chartOption || Object.keys(chartOption).length === 0) {
    console.error(`MACD Chart: ${symbol} - chartOption为空！`, chartOption);
    return (
      <div className="macd-chart-container" style={{
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        backgroundColor: '#fff',
        padding: compact ? '12px' : '16px',
        minHeight: compact ? '380px' : '450px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ff4d4f',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#262626', marginBottom: '16px' }}>
            {symbol} MACD指标
          </h3>
          <p>图表配置错误，无法显示MACD指标</p>
        </div>
      </div>
    );
  }

  return (
    <div className="macd-chart-container" style={{
      border: '1px solid #f0f0f0',
      borderRadius: '8px',
      backgroundColor: '#fff',
      padding: compact ? '12px' : '16px',
      minHeight: compact ? '380px' : '450px'
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: compact ? '12px' : '16px',
        paddingBottom: '8px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: compact ? '14px' : '16px',
            fontWeight: 'bold',
            color: '#262626'
          }}>
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

        {!compact && tradingAdvice && (
          <Tooltip title={tradingAdvice.reason}>
            <Tag color={
              tradingAdvice.action.includes('买入') ? 'green' :
              tradingAdvice.action.includes('卖出') ? 'red' : 'default'
            }>
              {tradingAdvice.action} ({(tradingAdvice.confidence * 100).toFixed(0)}%)
            </Tag>
          </Tooltip>
        )}
      </div>
      {/* MACD数值显示 */}
      {analysis && analysis.current.macd !== null && analysis.current.signal !== null && analysis.current.histogram !== null && (
        <div style={{
          marginBottom: compact ? '8px' : '12px',
          fontSize: compact ? '11px' : '12px'
        }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>} size="small">
            <Text>
              MACD: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {analysis.current.macd!.toFixed(compact ? 4 : 6)}
              </span>
            </Text>
            <Text>
              Signal: <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                {analysis.current.signal!.toFixed(compact ? 4 : 6)}
              </span>
            </Text>
            <Text>
              Histogram: <span style={{
                color: analysis.current.histogram! >= 0 ? '#52c41a' : '#ff4d4f',
                fontWeight: 'bold'
              }}>
                {analysis.current.histogram!.toFixed(compact ? 4 : 6)}
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
      <div className="macd-chart-wrapper">
        <ReactECharts
          option={chartOption}
          style={{
            width: '100%',
            height: '100%',
            minHeight: compact ? '300px' : '350px',
            display: 'block'
          }}
          opts={{
            renderer: 'canvas',
            width: 'auto',
            height: 'auto',
            devicePixelRatio: window.devicePixelRatio || 1
          }}
          onChartReady={(chart: any) => {
            console.log(`MACD Chart: ${symbol} - 图表渲染完成`, chart);
            // 强制重新渲染和调整大小
            setTimeout(() => {
              chart.resize();
              console.log(`MACD Chart: ${symbol} - 图表大小调整完成`);
            }, 100);
          }}
          onEvents={{
            'finished': () => {
              console.log(`MACD Chart: ${symbol} - 图表绘制完成`);
            }
          }}
        />
      </div>
    </div>
  );
};

export default MACDChart;
