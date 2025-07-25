// MACD指标计算工具
import { OHLCVData } from '../services/contractDataService';

export interface MACDData {
  timestamp: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface MACDAnalysis {
  current: MACDData;
  previous: MACDData;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  strength: 'STRONG' | 'WEAK' | 'NEUTRAL';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

/**
 * 计算指数移动平均线 (EMA)
 */
function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // 第一个EMA值使用简单移动平均
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema.push(sum / period);
  
  // 后续EMA值使用指数移动平均公式
  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }
  
  return ema;
}

/**
 * 计算MACD指标
 * @param ohlcvData OHLCV数据数组
 * @param fastPeriod 快线周期，默认12
 * @param slowPeriod 慢线周期，默认26
 * @param signalPeriod 信号线周期，默认9
 * @returns MACD数据数组
 */
export function calculateMACD(
  ohlcvData: OHLCVData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  if (ohlcvData.length < slowPeriod + signalPeriod) {
    return [];
  }

  // 提取收盘价
  const closePrices = ohlcvData.map(item => item.close);
  
  // 计算快线和慢线EMA
  const fastEMA = calculateEMA(closePrices, fastPeriod);
  const slowEMA = calculateEMA(closePrices, slowPeriod);
  
  if (fastEMA.length === 0 || slowEMA.length === 0) {
    return [];
  }
  
  // 计算MACD线 (快线EMA - 慢线EMA)
  const macdLine: number[] = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < slowEMA.length; i++) {
    const fastValue = fastEMA[i + startIndex];
    const slowValue = slowEMA[i];
    macdLine.push(fastValue - slowValue);
  }
  
  // 计算信号线 (MACD线的EMA)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // 计算MACD柱状图 (MACD线 - 信号线)
  const histogram: number[] = [];
  const signalStartIndex = signalPeriod - 1;
  
  for (let i = 0; i < signalLine.length; i++) {
    const macdValue = macdLine[i + signalStartIndex];
    const signalValue = signalLine[i];
    histogram.push(macdValue - signalValue);
  }
  
  // 构建结果数组
  const result: MACDData[] = [];
  const dataStartIndex = slowPeriod + signalPeriod - 2;
  
  for (let i = 0; i < histogram.length; i++) {
    const dataIndex = dataStartIndex + i;
    if (dataIndex < ohlcvData.length) {
      result.push({
        timestamp: ohlcvData[dataIndex].timestamp,
        macd: macdLine[signalStartIndex + i],
        signal: signalLine[i],
        histogram: histogram[i]
      });
    }
  }
  
  return result;
}

/**
 * 分析MACD信号
 */
export function analyzeMACDSignal(macdData: MACDData[]): MACDAnalysis | null {
  if (macdData.length < 2) return null;
  
  const current = macdData[macdData.length - 1];
  const previous = macdData[macdData.length - 2];
  
  // 判断信号类型
  let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  
  // 金叉：MACD柱状图从负转正
  if (current.histogram > 0 && previous.histogram <= 0) {
    signalType = 'BUY';
  }
  // 死叉：MACD柱状图从正转负
  else if (current.histogram < 0 && previous.histogram >= 0) {
    signalType = 'SELL';
  }
  
  // 判断强度
  let strength: 'STRONG' | 'WEAK' | 'NEUTRAL' = 'NEUTRAL';
  const histogramChange = Math.abs(current.histogram - previous.histogram);
  const avgHistogram = macdData.slice(-10).reduce((sum, item) => sum + Math.abs(item.histogram), 0) / 10;
  
  if (histogramChange > avgHistogram * 0.5) {
    strength = 'STRONG';
  } else if (histogramChange > avgHistogram * 0.2) {
    strength = 'WEAK';
  }
  
  // 判断趋势
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (current.macd > current.signal && current.histogram > 0) {
    trend = 'BULLISH';
  } else if (current.macd < current.signal && current.histogram < 0) {
    trend = 'BEARISH';
  }
  
  return {
    current,
    previous,
    signalType,
    strength,
    trend
  };
}

/**
 * 检测MACD背离
 */
export function detectMACDDivergence(
  ohlcvData: OHLCVData[],
  macdData: MACDData[],
  lookbackPeriod: number = 20
): {
  bullishDivergence: boolean;
  bearishDivergence: boolean;
  divergenceStrength: number;
} {
  if (ohlcvData.length < lookbackPeriod || macdData.length < lookbackPeriod) {
    return {
      bullishDivergence: false,
      bearishDivergence: false,
      divergenceStrength: 0
    };
  }
  
  const recentPrices = ohlcvData.slice(-lookbackPeriod).map(item => item.close);
  const recentMACD = macdData.slice(-lookbackPeriod).map(item => item.macd);
  
  // 简化的背离检测：比较最近的高点和低点
  const priceHigh = Math.max(...recentPrices);
  const priceLow = Math.min(...recentPrices);
  const macdHigh = Math.max(...recentMACD);
  const macdLow = Math.min(...recentMACD);
  
  const currentPrice = recentPrices[recentPrices.length - 1];
  const currentMACD = recentMACD[recentMACD.length - 1];
  
  // 看涨背离：价格创新低，MACD不创新低
  const bullishDivergence = currentPrice <= priceLow * 1.01 && currentMACD > macdLow * 1.1;
  
  // 看跌背离：价格创新高，MACD不创新高
  const bearishDivergence = currentPrice >= priceHigh * 0.99 && currentMACD < macdHigh * 0.9;
  
  // 计算背离强度
  let divergenceStrength = 0;
  if (bullishDivergence) {
    divergenceStrength = (currentMACD - macdLow) / Math.abs(macdLow);
  } else if (bearishDivergence) {
    divergenceStrength = (macdHigh - currentMACD) / Math.abs(macdHigh);
  }
  
  return {
    bullishDivergence,
    bearishDivergence,
    divergenceStrength: Math.min(divergenceStrength, 1)
  };
}

/**
 * 获取MACD交易建议
 */
export function getMACDTradingAdvice(analysis: MACDAnalysis): {
  action: string;
  confidence: number;
  reason: string;
} {
  const { signalType, strength, trend } = analysis;
  
  let action = '观望';
  let confidence = 0;
  let reason = '';
  
  if (signalType === 'BUY' && trend === 'BULLISH') {
    action = '买入';
    confidence = strength === 'STRONG' ? 0.8 : 0.6;
    reason = `MACD金叉${strength === 'STRONG' ? '，信号强烈' : ''}，趋势看涨`;
  } else if (signalType === 'SELL' && trend === 'BEARISH') {
    action = '卖出';
    confidence = strength === 'STRONG' ? 0.8 : 0.6;
    reason = `MACD死叉${strength === 'STRONG' ? '，信号强烈' : ''}，趋势看跌`;
  } else if (signalType === 'BUY' && trend === 'NEUTRAL') {
    action = '谨慎买入';
    confidence = 0.4;
    reason = 'MACD金叉，但趋势不明确';
  } else if (signalType === 'SELL' && trend === 'NEUTRAL') {
    action = '谨慎卖出';
    confidence = 0.4;
    reason = 'MACD死叉，但趋势不明确';
  } else {
    reason = '无明确信号，建议观望';
  }
  
  return { action, confidence, reason };
}
