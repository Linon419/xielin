import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Card, Spin, Alert, Radio, Space, Switch, Tooltip, notification, Badge } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SyncOutlined, SoundOutlined, BellOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { StrategyInput } from '../types/strategy';
import { contractDataService, OHLCVData } from '../services/contractDataService';
import { calculateMACD } from '../utils/macdCalculator';

interface PriceChartProps {
  input: StrategyInput;
  compact?: boolean; // 紧凑模式，用于多图表展示
}

// 时间周期选项配置
const timeframeOptions = [
  { label: '1分钟', value: '1m', limit: 60, description: '最近1小时' },
  { label: '15分钟', value: '15m', limit: 96, description: '最近24小时' },
  { label: '1小时', value: '1h', limit: 48, description: '最近48小时' },
  { label: '4小时', value: '4h', limit: 42, description: '最近7天' }
];

// 获取时间间隔（毫秒）
const getIntervalMs = (timeframe: string): number => {
  switch (timeframe) {
    case '1m': return 60 * 1000; // 1分钟
    case '15m': return 15 * 60 * 1000; // 15分钟
    case '1h': return 60 * 60 * 1000; // 1小时
    case '4h': return 4 * 60 * 60 * 1000; // 4小时
    default: return 60 * 60 * 1000; // 默认1小时
  }
};

// 实时更新配置
const REAL_TIME_INTERVALS = {
  '1m': 10000,   // 1分钟图：每10秒更新
  '15m': 30000,  // 15分钟图：每30秒更新
  '1h': 60000,   // 1小时图：每1分钟更新
  '4h': 300000   // 4小时图：每5分钟更新
};

const PriceChart: React.FC<PriceChartProps> = ({ input, compact = false }) => {
  const [historicalData, setHistoricalData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('1h'); // 默认1小时
  const [realTimeEnabled, setRealTimeEnabled] = useState(true); // 实时更新开关
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 成交量通知相关状态
  const [volumeNotificationEnabled, setVolumeNotificationEnabled] = useState(true); // 成交量通知开关
  const [volumeAlerts, setVolumeAlerts] = useState<Array<{
    id: string;
    timestamp: number;
    volume: number;
    avgVolume: number;
    multiplier: number;
    price: number;
  }>>([]);
  const [volumeThreshold, setVolumeThreshold] = useState(2.0); // 成交量放大倍数阈值

  // 成交量分析函数
  const analyzeVolumeAnomaly = (data: OHLCVData[]) => {
    if (data.length < 20) return null; // 需要至少20个数据点进行分析

    const latest = data[data.length - 1];
    const recent20 = data.slice(-20, -1); // 最近19个数据点（不包括最新的）

    // 计算平均成交量
    const avgVolume = recent20.reduce((sum, item) => sum + item.volume, 0) / recent20.length;

    // 计算标准差
    const variance = recent20.reduce((sum, item) => sum + Math.pow(item.volume - avgVolume, 2), 0) / recent20.length;
    const stdDev = Math.sqrt(variance);

    // 计算当前成交量相对于平均值的倍数
    const multiplier = latest.volume / avgVolume;

    // 检查是否为异常放量（超过阈值且超过2个标准差）
    const isAnomaly = multiplier >= volumeThreshold && latest.volume > (avgVolume + 2 * stdDev);

    return {
      isAnomaly,
      currentVolume: latest.volume,
      avgVolume,
      multiplier,
      stdDev,
      timestamp: latest.timestamp,
      price: latest.close
    };
  };

  // 触发成交量通知
  const triggerVolumeNotification = (analysis: any) => {
    const alertId = `volume_${analysis.timestamp}`;

    // 检查是否已经发送过相同的通知
    if (volumeAlerts.some(alert => alert.id === alertId)) {
      return;
    }

    // 添加到通知列表
    const newAlert = {
      id: alertId,
      timestamp: analysis.timestamp,
      volume: analysis.currentVolume,
      avgVolume: analysis.avgVolume,
      multiplier: analysis.multiplier,
      price: analysis.price
    };

    setVolumeAlerts(prev => [...prev.slice(-9), newAlert]); // 保留最近10条通知

    // 显示通知
    const formatVolume = (vol: number) => {
      if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
      if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
      if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
      return vol.toFixed(0);
    };

    notification.warning({
      message: '🔊 成交量异常放大',
      description: (
        <div>
          <div><strong>{input.symbol}</strong> 检测到异常放量</div>
          <div>当前成交量: <span style={{color: '#1890ff', fontWeight: 'bold'}}>{formatVolume(analysis.currentVolume)}</span></div>
          <div>平均成交量: {formatVolume(analysis.avgVolume)}</div>
          <div>放大倍数: <span style={{color: '#ff4d4f', fontWeight: 'bold'}}>{analysis.multiplier.toFixed(2)}x</span></div>
          <div>当前价格: <span style={{color: '#52c41a'}}>{analysis.price.toFixed(6)}</span></div>
        </div>
      ),
      duration: 8,
      placement: 'topRight',
      icon: <SoundOutlined style={{ color: '#ff4d4f' }} />
    });
  };

  // 获取历史数据的函数
  const fetchHistoricalData = async (isRealTimeUpdate = false) => {
    if (!input.symbol) return;

    if (!isRealTimeUpdate) {
      setLoading(true);
    }
    setError(null);

    try {
      // 根据选择的时间周期获取对应的数据量
      const selectedOption = timeframeOptions.find(opt => opt.value === timeframe);
      const limit = selectedOption?.limit || 48;

      const data = await contractDataService.getContractHistoricalData(input.symbol, timeframe, limit);
      setHistoricalData(data);
      setLastUpdateTime(new Date());

      // 成交量异常检测（仅在实时更新时进行）
      if (isRealTimeUpdate && volumeNotificationEnabled && data.length > 0) {
        const analysis = analyzeVolumeAnomaly(data);
        if (analysis && analysis.isAnomaly) {
          triggerVolumeNotification(analysis);
        }
      }
    } catch (err) {
      console.error('获取历史数据失败:', err);
      if (!isRealTimeUpdate) {
        setError('无法获取历史数据，显示模拟数据');
      }

      // 生成模拟数据作为后备
      const mockData: OHLCVData[] = [];
      const basePrice = input.currentPrice;
      const volatility = input.atr4h * 0.5;
      const selectedOption = timeframeOptions.find(opt => opt.value === timeframe);
      const limit = selectedOption?.limit || 48;

      // 根据时间周期计算时间间隔（毫秒）
      const intervalMs = getIntervalMs(timeframe);

      for (let i = 0; i < limit; i++) {
        const timestamp = Date.now() - (limit - i) * intervalMs;
        const randomChange = (Math.random() - 0.5) * volatility;
        const price = basePrice + randomChange;

        mockData.push({
          timestamp,
          open: price,
          high: price * (1 + Math.random() * 0.02),
          low: price * (1 - Math.random() * 0.02),
          close: price,
          volume: Math.random() * 1000000
        });
      }

      setHistoricalData(mockData);
      setLastUpdateTime(new Date());

      // 成交量异常检测（仅在实时更新时进行）
      if (isRealTimeUpdate && volumeNotificationEnabled && mockData.length > 0) {
        const analysis = analyzeVolumeAnomaly(mockData);
        if (analysis && analysis.isAnomaly) {
          triggerVolumeNotification(analysis);
        }
      }
    } finally {
      if (!isRealTimeUpdate) {
        setLoading(false);
      }
    }
  };

  // 初始数据加载
  useEffect(() => {
    fetchHistoricalData();
  }, [input.symbol, input.currentPrice, input.atr4h, timeframe]);

  // 实时更新机制
  useEffect(() => {
    // 清除之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 如果启用实时更新且有币种数据
    if (realTimeEnabled && input.symbol) {
      const updateInterval = REAL_TIME_INTERVALS[timeframe as keyof typeof REAL_TIME_INTERVALS] || 60000;

      intervalRef.current = setInterval(() => {
        fetchHistoricalData(true); // 实时更新，不显示loading
      }, updateInterval);
    }

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [realTimeEnabled, input.symbol, timeframe]);

  const chartOption = useMemo(() => {
    const { currentPrice, schellingPoint, type } = input;

    // 转换历史数据为蜡烛图格式 [timestamp, open, close, low, high]
    const candlestickData = historicalData.map((item) => [
      item.timestamp,
      item.open,
      item.close,
      item.low,
      item.high
    ]);

    // 转换成交量数据格式 [timestamp, volume]
    const volumeData = historicalData.map((item) => [
      item.timestamp,
      item.volume
    ]);

    // 计算MACD数据
    const macdData = historicalData.length >= 30 ? calculateMACD(historicalData) : [];

    // 过滤出有效的MACD数据
    const validMACDData = macdData.filter(item =>
      item.macd !== null && item.signal !== null && item.histogram !== null
    );

    const macdLine = validMACDData.map(item => [item.timestamp, item.macd!]);
    const signalLine = validMACDData.map(item => [item.timestamp, item.signal!]);
    const histogramData = validMACDData.map(item => [item.timestamp, item.histogram!]);
    
    // 获取当前时间周期的标签
    const currentTimeframeOption = timeframeOptions.find(opt => opt.value === timeframe);
    const timeframeLabel = currentTimeframeOption?.label || '1小时';
    const timeframeDescription = currentTimeframeOption?.description || '最近48小时';

    // 构建标题文本
    const titleText = `${input.symbol} 价格走势 (${timeframeLabel})`;
    const realtimeIndicator = realTimeEnabled ? ' 🔴 实时' : '';
    const subtitleText = `${timeframeDescription}${realtimeIndicator}`;

    return {
      title: {
        text: titleText,
        subtext: subtitleText,
        left: 'center',
        textStyle: {
          fontSize: compact ? 18 : 16,
          fontWeight: 'bold'
        },
        subtextStyle: {
          fontSize: compact ? 14 : 12,
          color: realTimeEnabled ? '#1890ff' : '#666'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';

          // 找到蜡烛图和成交量数据
          const candlestickPoint = params.find((p: any) => p.seriesName === '价格');
          const volumePoint = params.find((p: any) => p.seriesName === '成交量');

          if (!candlestickPoint || !candlestickPoint.value) return '';

          const [timestamp, open, close, low, high] = candlestickPoint.value;
          const volume = volumePoint ? volumePoint.value[1] : 0;

          const date = new Date(timestamp);
          const timeStr = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          // 计算涨跌幅
          const change = close - open;
          const changePercent = ((change / open) * 100).toFixed(2);
          const changeColor = change >= 0 ? '#22c55e' : '#ef4444'; // 涨绿跌红

          // 格式化成交量
          const formatVolume = (vol: number) => {
            if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
            if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
            if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
            return vol.toFixed(2);
          };

          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${timeStr}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div>开盘: <span style="color: #666;">${open.toFixed(6)}</span></div>
                <div>收盘: <span style="color: ${changeColor}; font-weight: bold;">${close.toFixed(6)}</span></div>
                <div>最高: <span style="color: #22c55e;">${high.toFixed(6)}</span></div>
                <div>最低: <span style="color: #ef4444;">${low.toFixed(6)}</span></div>
                <div>涨跌: <span style="color: ${changeColor};">${change >= 0 ? '+' : ''}${change.toFixed(6)} (${changePercent}%)</span></div>
                <div>成交量: <span style="color: #1890ff; font-weight: bold;">${formatVolume(volume)}</span></div>
              </div>
            </div>
          `;
        }
      },
      grid: compact ? [
        // 价格图表区域
        {
          left: '8%',
          right: '8%',
          top: '12%',
          height: '45%',
          containLabel: true
        },
        // 成交量区域
        {
          left: '8%',
          right: '8%',
          top: '62%',
          height: '12%',
          containLabel: true
        },
        // MACD区域
        {
          left: '8%',
          right: '8%',
          top: '78%',
          height: '18%',
          containLabel: true
        }
      ] : [
        // 价格图表区域
        {
          left: '3%',
          right: '4%',
          top: '15%',
          height: '45%',
          containLabel: true
        },
        // 成交量区域
        {
          left: '3%',
          right: '4%',
          top: '65%',
          height: '12%',
          containLabel: true
        },
        // MACD区域
        {
          left: '3%',
          right: '4%',
          top: '82%',
          height: '15%',
          containLabel: true
        }
      ],
      xAxis: compact ? [
        {
          type: 'time',
          gridIndex: 0,
          axisLabel: {
            show: false
          },
          axisTick: {
            show: false
          }
        },
        {
          type: 'time',
          gridIndex: 1,
          axisLabel: {
            show: false
          },
          axisTick: {
            show: false
          }
        },
        {
          type: 'time',
          gridIndex: 2,
          axisLabel: {
            fontSize: compact ? 11 : 10,
            formatter: function (value: number) {
              const date = new Date(value);
              return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          }
        }
      ] : [
        {
          type: 'time',
          gridIndex: 0,
          axisLabel: {
            show: false
          },
          axisTick: {
            show: false
          }
        },
        {
          type: 'time',
          gridIndex: 1,
          axisLabel: {
            show: false
          },
          axisTick: {
            show: false
          }
        },
        {
          type: 'time',
          gridIndex: 2,
          name: '时间',
          nameLocation: 'middle',
          nameGap: 25,
          axisLabel: {
            formatter: function (value: number) {
              const date = new Date(value);
              // 根据时间周期选择不同的显示格式
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
          }
        }
      ],
      yAxis: compact ? [
        {
          type: 'value',
          scale: true,
          gridIndex: 0,
          axisLabel: {
            fontSize: compact ? 11 : 10,
            formatter: function (value: number) {
              return value.toFixed(4);
            }
          }
        },
        {
          type: 'value',
          scale: true,
          gridIndex: 1,
          axisLabel: {
            fontSize: compact ? 10 : 9,
            formatter: function (value: number) {
              if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
              if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
              if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
              return value.toString();
            }
          }
        },
        {
          type: 'value',
          scale: true,
          gridIndex: 2,
          axisLabel: {
            fontSize: compact ? 10 : 9,
            formatter: function (value: number) {
              return value.toFixed(4);
            }
          }
        }
      ] : [
        {
          type: 'value',
          name: '价格',
          nameLocation: 'middle',
          nameGap: 40,
          scale: true,
          gridIndex: 0
        },
        {
          type: 'value',
          name: '成交量',
          nameLocation: 'middle',
          nameGap: 30,
          scale: true,
          gridIndex: 1,
          axisLabel: {
            formatter: function (value: number) {
              if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
              if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
              if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
              return value.toString();
            }
          }
        },
        {
          type: 'value',
          name: 'MACD',
          nameLocation: 'middle',
          nameGap: 30,
          scale: true,
          gridIndex: 2,
          axisLabel: {
            formatter: function (value: number) {
              return value.toFixed(4);
            }
          }
        }
      ],
      series: compact ? [
        {
          name: '价格',
          type: 'candlestick',
          data: candlestickData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#22c55e',      // 阳线颜色（绿色）
            color0: '#ef4444',     // 阴线颜色（红色）
            borderColor: '#22c55e', // 阳线边框
            borderColor0: '#ef4444' // 阴线边框
          },
          markLine: {
            silent: true,
            data: [
              {
                name: '谢林点位',
                yAxis: schellingPoint,
                lineStyle: {
                  color: type === '兜底区' ? '#52c41a' : '#ff4d4f',
                  type: 'dashed',
                  width: 1
                },
                label: {
                  formatter: `${schellingPoint.toFixed(4)}`,
                  position: 'end',
                  fontSize: 9
                }
              }
            ]
          }
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumeData,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: {
            color: function(params: any) {
              const dataIndex = params.dataIndex;
              if (dataIndex < candlestickData.length) {
                const [, open, close] = candlestickData[dataIndex];
                return close >= open ? '#22c55e80' : '#ef444480';
              }
              return '#1890ff80';
            }
          }
        },
        // MACD系列
        ...(validMACDData.length > 0 ? [
          {
            name: 'MACD',
            type: 'line',
            data: macdLine,
            xAxisIndex: 2,
            yAxisIndex: 2,
            lineStyle: {
              color: '#1890ff',
              width: 1
            },
            symbol: 'none',
            smooth: false
          },
          {
            name: 'Signal',
            type: 'line',
            data: signalLine,
            xAxisIndex: 2,
            yAxisIndex: 2,
            lineStyle: {
              color: '#ff4d4f',
              width: 1
            },
            symbol: 'none',
            smooth: false
          },
          {
            name: 'Histogram',
            type: 'bar',
            data: histogramData,
            xAxisIndex: 2,
            yAxisIndex: 2,
            itemStyle: {
              color: (params: any) => {
                const value = params.value[1];
                return value >= 0 ? '#52c41a' : '#ff4d4f';
              },
              opacity: 0.6
            },
            barWidth: '60%'
          }
        ] : [])
      ] : [
        {
          name: '价格',
          type: 'candlestick',
          data: candlestickData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#22c55e',      // 阳线颜色（绿色）
            color0: '#ef4444',     // 阴线颜色（红色）
            borderColor: '#22c55e', // 阳线边框
            borderColor0: '#ef4444' // 阴线边框
          },
          emphasis: {
            itemStyle: {
              color: '#16a34a',
              color0: '#dc2626',
              borderColor: '#16a34a',
              borderColor0: '#dc2626'
            }
          },
          markLine: {
            silent: true,
            data: [
              {
                name: '谢林点位',
                yAxis: schellingPoint,
                lineStyle: {
                  color: type === '兜底区' ? '#52c41a' : '#ff4d4f',
                  type: 'dashed',
                  width: 2
                },
                label: {
                  formatter: `谢林点位: ${schellingPoint.toFixed(6)}`,
                  position: 'end'
                }
              }
            ]
          }
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumeData,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: {
            color: function(params: any) {
              // 根据价格涨跌设置成交量柱子颜色
              const dataIndex = params.dataIndex;
              if (dataIndex < candlestickData.length) {
                const [, open, close] = candlestickData[dataIndex];
                return close >= open ? '#22c55e80' : '#ef444480'; // 半透明：涨绿跌红
              }
              return '#1890ff80';
            }
          },
          emphasis: {
            itemStyle: {
              color: function(params: any) {
                const dataIndex = params.dataIndex;
                if (dataIndex < candlestickData.length) {
                  const [, open, close] = candlestickData[dataIndex];
                  return close >= open ? '#22c55e' : '#ef4444'; // 涨绿跌红
                }
                return '#1890ff';
              }
            }
          }
        },
        // MACD系列
        ...(validMACDData.length > 0 ? [
          {
            name: 'MACD',
            type: 'line',
            data: macdLine,
            xAxisIndex: 2,
            yAxisIndex: 2,
            lineStyle: {
              color: '#1890ff',
              width: 2
            },
            symbol: 'none',
            smooth: false
          },
          {
            name: 'Signal',
            type: 'line',
            data: signalLine,
            xAxisIndex: 2,
            yAxisIndex: 2,
            lineStyle: {
              color: '#ff4d4f',
              width: 2
            },
            symbol: 'none',
            smooth: false
          },
          {
            name: 'Histogram',
            type: 'bar',
            data: histogramData,
            xAxisIndex: 2,
            yAxisIndex: 2,
            itemStyle: {
              color: (params: any) => {
                const value = params.value[1];
                return value >= 0 ? '#52c41a' : '#ff4d4f';
              },
              opacity: 0.8
            },
            barWidth: '60%'
          },
          // 零线参考
          {
            name: '零线',
            type: 'line',
            data: macdLine.map(item => [item[0], 0]),
            xAxisIndex: 2,
            yAxisIndex: 2,
            lineStyle: {
              color: '#666666',
              width: 1,
              type: 'dashed',
              opacity: 0.5
            },
            symbol: 'none',
            silent: true,
            z: 1
          }
        ] : [])
      ]
    };
  }, [input, historicalData, timeframe, compact, realTimeEnabled]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '20px 0' : '60px 0' }}>
        <Spin size={compact ? "default" : "large"} />
        <p style={{ marginTop: 8, color: '#666', fontSize: compact ? '12px' : '14px' }}>
          正在获取历史数据...
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        {/* 紧凑模式控制面板 */}
        <div style={{
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <Space size="small">
            <Radio.Group
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              size="small"
            >
              {timeframeOptions.map(option => (
                <Radio.Button key={option.value} value={option.value} style={{ fontSize: '11px', padding: '0 6px' }}>
                  {option.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Space>

          <Space size="small">
            <Tooltip title={realTimeEnabled ? "关闭实时更新" : "开启实时更新"}>
              <Switch
                checked={realTimeEnabled}
                onChange={setRealTimeEnabled}
                size="small"
              />
            </Tooltip>
            <Tooltip title={volumeNotificationEnabled ? "关闭成交量通知" : "开启成交量通知"}>
              <Badge count={volumeAlerts.length} size="small" offset={[3, -3]}>
                <Switch
                  checked={volumeNotificationEnabled}
                  onChange={setVolumeNotificationEnabled}
                  checkedChildren={<SoundOutlined />}
                  unCheckedChildren={<BellOutlined />}
                  size="small"
                />
              </Badge>
            </Tooltip>
          </Space>
        </div>

        {error && (
          <Alert
            message={error}
            type="warning"
            style={{ marginBottom: 8, fontSize: '12px' }}
            showIcon
          />
        )}

        <ReactECharts
          option={chartOption}
          style={{ height: compact ? '550px' : '420px' }}
          opts={{ renderer: 'canvas' }}
        />



        {/* 紧凑模式成交量通知历史 */}
        {volumeNotificationEnabled && volumeAlerts.length > 0 && (
          <div style={{
            marginTop: 8,
            padding: '6px',
            background: '#fff2e8',
            borderRadius: 4,
            border: '1px solid #ffec8b',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <SoundOutlined style={{ color: '#ff4d4f', marginRight: 4, fontSize: '12px' }} />
              <span style={{ fontWeight: 'bold', color: '#d46b08' }}>成交量通知</span>
              <Badge count={volumeAlerts.length} size="small" style={{ marginLeft: 4 }} />
            </div>
            <div style={{ maxHeight: '60px', overflowY: 'auto' }}>
              {volumeAlerts.slice(-3).reverse().map((alert, index) => {
                const formatVolume = (vol: number) => {
                  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
                  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
                  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
                  return vol.toFixed(0);
                };

                return (
                  <div key={alert.id} style={{
                    padding: '2px 4px',
                    marginBottom: index < 2 ? 2 : 0,
                    background: '#fff',
                    borderRadius: 2,
                    fontSize: '10px',
                    border: '1px solid #ffe7ba'
                  }}>
                    <span style={{ color: '#d46b08', fontWeight: 'bold' }}>
                      {new Date(alert.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ margin: '0 4px', color: '#666' }}>|</span>
                    <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                      {alert.multiplier.toFixed(1)}x
                    </span>
                    <span style={{ color: '#666', margin: '0 2px' }}>@</span>
                    <span style={{ color: '#52c41a' }}>
                      {alert.price.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      title="价格分析图表"
      style={{ marginBottom: 16 }}
      extra={
        <Space wrap>
          <Space>
            <span style={{ color: '#666', fontSize: '14px' }}>时间周期:</span>
            <Radio.Group
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              size="small"
            >
              {timeframeOptions.map(option => (
                <Radio.Button key={option.value} value={option.value}>
                  {option.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Space>

          <Space>
            <Tooltip title={realTimeEnabled ? "关闭实时更新" : "开启实时更新"}>
              <Switch
                checked={realTimeEnabled}
                onChange={setRealTimeEnabled}
                checkedChildren={<PlayCircleOutlined />}
                unCheckedChildren={<PauseCircleOutlined />}
                size="small"
              />
            </Tooltip>
            <span style={{ color: '#666', fontSize: '12px' }}>实时更新</span>
          </Space>

          <Space>
            <Tooltip title={volumeNotificationEnabled ? "关闭成交量通知" : "开启成交量通知"}>
              <Badge count={volumeAlerts.length} size="small" offset={[5, -5]}>
                <Switch
                  checked={volumeNotificationEnabled}
                  onChange={setVolumeNotificationEnabled}
                  checkedChildren={<SoundOutlined />}
                  unCheckedChildren={<BellOutlined />}
                  size="small"
                />
              </Badge>
            </Tooltip>
            <span style={{ color: '#666', fontSize: '12px' }}>成交量通知</span>
          </Space>

          {lastUpdateTime && (
            <Tooltip title="最后更新时间">
              <Space size={4}>
                <SyncOutlined spin={realTimeEnabled} style={{ color: realTimeEnabled ? '#1890ff' : '#999' }} />
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {lastUpdateTime.toLocaleTimeString('zh-CN')}
                </span>
              </Space>
            </Tooltip>
          )}
        </Space>
      }
    >
      {error && (
        <Alert
          message={error}
          type="warning"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <ReactECharts
        option={chartOption}
        style={{ height: '450px' }}
        opts={{ renderer: 'canvas' }}
      />



      <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ color: '#666' }}>当前价格: </span>
            <span style={{ fontWeight: 'bold', color: '#722ed1' }}>
              {input.currentPrice.toFixed(6)}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>谢林点位: </span>
            <span style={{ 
              fontWeight: 'bold', 
              color: input.type === '兜底区' ? '#52c41a' : '#ff4d4f' 
            }}>
              {input.schellingPoint.toFixed(6)}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>价格差距: </span>
            <span style={{ 
              fontWeight: 'bold',
              color: Math.abs(input.currentPrice - input.schellingPoint) / input.currentPrice <= 0.05 ? '#52c41a' : '#faad14'
            }}>
              {((input.currentPrice - input.schellingPoint) / input.schellingPoint * 100).toFixed(2)}%
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>策略类型: </span>
            <span style={{ 
              fontWeight: 'bold',
              color: input.type === '兜底区' ? '#52c41a' : '#ff4d4f'
            }}>
              {input.type}
            </span>
          </div>
        </div>
      </div>

      {/* 成交量通知历史 */}
      {volumeNotificationEnabled && volumeAlerts.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px', background: '#fff2e8', borderRadius: 6, border: '1px solid #ffec8b' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <SoundOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            <span style={{ fontWeight: 'bold', color: '#d46b08' }}>成交量异常通知历史</span>
            <Badge count={volumeAlerts.length} style={{ marginLeft: 8 }} />
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {volumeAlerts.slice().reverse().map((alert, index) => {
              const formatVolume = (vol: number) => {
                if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
                if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
                if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
                return vol.toFixed(0);
              };

              return (
                <div key={alert.id} style={{
                  padding: '6px 8px',
                  marginBottom: index < volumeAlerts.length - 1 ? 4 : 0,
                  background: '#fff',
                  borderRadius: 4,
                  fontSize: '12px',
                  border: '1px solid #ffe7ba'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#d46b08', fontWeight: 'bold' }}>
                        {new Date(alert.timestamp).toLocaleTimeString('zh-CN')}
                      </span>
                      <span style={{ margin: '0 8px', color: '#666' }}>|</span>
                      <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                        {formatVolume(alert.volume)}
                      </span>
                      <span style={{ color: '#666', margin: '0 4px' }}>vs</span>
                      <span style={{ color: '#999' }}>
                        {formatVolume(alert.avgVolume)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                        {alert.multiplier.toFixed(2)}x
                      </span>
                      <span style={{ color: '#666', margin: '0 4px' }}>@</span>
                      <span style={{ color: '#52c41a' }}>
                        {alert.price.toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PriceChart;
