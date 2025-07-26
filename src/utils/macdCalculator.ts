// MACD指标计算工具 - TA-Lib风格实现
import { OHLCVData } from '../services/contractDataService';

export interface MACDData {
  timestamp: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface MACDAnalysis {
  current: MACDData;
  previous: MACDData;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  strength: 'STRONG' | 'WEAK' | 'NEUTRAL';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

/**
 * 计算指数移动平均线 (EMA) - TA-Lib风格
 * 返回与输入数组等长的结果，前面不足的数据用null填充
 */
function calculateEMA(data: number[], period: number): (number | null)[] {
  if (data.length === 0) return [];

  const result: (number | null)[] = new Array(data.length).fill(null);
  const multiplier = 2 / (period + 1);

  // 需要足够的数据才能开始计算
  if (data.length < period) return result;

  // 计算第一个EMA值（使用SMA）
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result[period - 1] = sum / period;

  // 计算后续的EMA值
  for (let i = period; i < data.length; i++) {
    const prevEMA = result[i - 1];
    if (prevEMA !== null) {
      result[i] = (data[i] - prevEMA) * multiplier + prevEMA;
    }
  }

  return result;
}

/**
 * 计算MACD指标 - TA-Lib风格实现
 * @param ohlcvData OHLCV数据数组
 * @param fastPeriod 快线周期，默认12
 * @param slowPeriod 慢线周期，默认26
 * @param signalPeriod 信号线周期，默认9
 * @returns MACD数据数组，长度与输入相同，前面不足的数据用null填充
 */
export function calculateMACD(
  ohlcvData: OHLCVData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  // 参数验证
  if (!ohlcvData || ohlcvData.length === 0) {
    return [];
  }

  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error('Periods must be positive numbers');
  }

  if (fastPeriod >= slowPeriod) {
    throw new Error('Fast period must be less than slow period');
  }

  console.log(`MACD计算: 输入数据${ohlcvData.length}条`);

  // 提取收盘价
  const closePrices = ohlcvData.map(item => item.close);

  // 计算快线和慢线EMA
  const fastEMA = calculateEMA(closePrices, fastPeriod);
  const slowEMA = calculateEMA(closePrices, slowPeriod);

  // 计算MACD线 (快线EMA - 慢线EMA)
  const macdLine: (number | null)[] = new Array(closePrices.length).fill(null);

  for (let i = 0; i < closePrices.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine[i] = fastEMA[i]! - slowEMA[i]!;
    }
  }

  // 计算信号线 (MACD线的EMA)
  // 需要过滤掉null值来计算信号线
  const validMACDValues: { index: number; value: number }[] = [];
  macdLine.forEach((value, index) => {
    if (value !== null) {
      validMACDValues.push({ index, value });
    }
  });

  // 如果有效的MACD值不足，返回全null结果
  const signalLine: (number | null)[] = new Array(closePrices.length).fill(null);

  if (validMACDValues.length >= signalPeriod) {
    // 只对有效的MACD值计算EMA
    const macdValues = validMACDValues.map(item => item.value);
    const signalEMA = calculateEMA(macdValues, signalPeriod);

    // 将信号线值映射回原始索引位置
    validMACDValues.forEach((item, idx) => {
      if (signalEMA[idx] !== null) {
        signalLine[item.index] = signalEMA[idx];
      }
    });
  }

  // 构建结果数组
  const result: MACDData[] = [];

  for (let i = 0; i < ohlcvData.length; i++) {
    const macd = macdLine[i];
    const signal = signalLine[i];
    const histogram = (macd !== null && signal !== null) ? macd - signal : null;

    result.push({
      timestamp: ohlcvData[i].timestamp,
      macd,
      signal,
      histogram
    });
  }

  return result;
}

/**
 * 分析MACD信号
 */
export function analyzeMACDSignal(macdData: MACDData[]): MACDAnalysis | null {
  // 找到最近两个有效的MACD数据点
  const validData = macdData.filter(d =>
    d.macd !== null && d.signal !== null && d.histogram !== null
  );

  if (validData.length < 2) return null;

  const current = validData[validData.length - 1];
  const previous = validData[validData.length - 2];

  // 判断信号类型
  let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

  // 金叉：MACD柱状图从负转正
  if (current.histogram! > 0 && previous.histogram! <= 0) {
    signalType = 'BUY';
  }
  // 死叉：MACD柱状图从正转负
  else if (current.histogram! < 0 && previous.histogram! >= 0) {
    signalType = 'SELL';
  }

  // 判断强度
  let strength: 'STRONG' | 'WEAK' | 'NEUTRAL' = 'NEUTRAL';
  const histogramChange = Math.abs(current.histogram! - previous.histogram!);

  // 计算最近10个有效柱状图的平均值
  const recentValidHistograms = validData
    .slice(-10)
    .map(d => Math.abs(d.histogram!))
    .filter(h => !isNaN(h));

  if (recentValidHistograms.length > 0) {
    const avgHistogram = recentValidHistograms.reduce((sum, h) => sum + h, 0) / recentValidHistograms.length;

    if (histogramChange > avgHistogram * 0.5) {
      strength = 'STRONG';
    } else if (histogramChange > avgHistogram * 0.2) {
      strength = 'WEAK';
    }
  }

  // 判断趋势
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (current.macd! > current.signal! && current.histogram! > 0) {
    trend = 'BULLISH';
  } else if (current.macd! < current.signal! && current.histogram! < 0) {
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
  const defaultResult = {
    bullishDivergence: false,
    bearishDivergence: false,
    divergenceStrength: 0
  };

  // 确保数据长度足够
  if (ohlcvData.length < lookbackPeriod || macdData.length < lookbackPeriod) {
    return defaultResult;
  }

  // 获取最近的有效数据
  const recentData = ohlcvData.slice(-lookbackPeriod);
  const recentMACD = macdData.slice(-lookbackPeriod);

  // 过滤出有效的MACD值
  const validMACDIndices: number[] = [];
  const validMACDValues: number[] = [];

  recentMACD.forEach((data, index) => {
    if (data.macd !== null) {
      validMACDIndices.push(index);
      validMACDValues.push(data.macd);
    }
  });

  if (validMACDValues.length < 5) {  // 需要足够的数据点
    return defaultResult;
  }

  // 获取对应的价格
  const validPrices = validMACDIndices.map(i => recentData[i].close);

  // 找出价格和MACD的高低点
  const priceHigh = Math.max(...validPrices);
  const priceLow = Math.min(...validPrices);
  const macdHigh = Math.max(...validMACDValues);
  const macdLow = Math.min(...validMACDValues);

  const currentPrice = validPrices[validPrices.length - 1];
  const currentMACD = validMACDValues[validMACDValues.length - 1];

  // 看涨背离：价格创新低，MACD不创新低
  const bullishDivergence = currentPrice <= priceLow * 1.01 && currentMACD > macdLow * 1.1;

  // 看跌背离：价格创新高，MACD不创新高
  const bearishDivergence = currentPrice >= priceHigh * 0.99 && currentMACD < macdHigh * 0.9;

  // 计算背离强度
  let divergenceStrength = 0;
  if (bullishDivergence) {
    divergenceStrength = (currentMACD - macdLow) / Math.abs(macdLow || 1);
  } else if (bearishDivergence) {
    divergenceStrength = (macdHigh - currentMACD) / Math.abs(macdHigh || 1);
  }
  
  return {
    bullishDivergence,
    bearishDivergence,
    divergenceStrength: Math.min(Math.abs(divergenceStrength), 1)
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

/**
 * 获取最新的有效MACD值
 */
export function getLatestValidMACD(macdData: MACDData[]): MACDData | null {
  for (let i = macdData.length - 1; i >= 0; i--) {
    const data = macdData[i];
    if (data.macd !== null && data.signal !== null && data.histogram !== null) {
      return data;
    }
  }
  return null;
}

/**
 * 计算MACD的统计信息
 */
export function calculateMACDStats(macdData: MACDData[]): {
  avgMACD: number;
  avgSignal: number;
  avgHistogram: number;
  validDataPoints: number;
} {
  const validData = macdData.filter(d =>
    d.macd !== null && d.signal !== null && d.histogram !== null
  );

  if (validData.length === 0) {
    return {
      avgMACD: 0,
      avgSignal: 0,
      avgHistogram: 0,
      validDataPoints: 0
    };
  }

  const sum = validData.reduce((acc, d) => ({
    macd: acc.macd + d.macd!,
    signal: acc.signal + d.signal!,
    histogram: acc.histogram + d.histogram!
  }), { macd: 0, signal: 0, histogram: 0 });

  return {
    avgMACD: sum.macd / validData.length,
    avgSignal: sum.signal / validData.length,
    avgHistogram: sum.histogram / validData.length,
    validDataPoints: validData.length
  };
}
