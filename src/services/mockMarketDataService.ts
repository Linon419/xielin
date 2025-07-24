// 模拟市场数据服务 - 用于演示和开发

// 市场数据接口
export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
}

// OHLCV数据接口
export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ATR计算结果接口
export interface ATRData {
  atr4h: number;
  atr15m: number;
  atr1h: number;
}

// 模拟的币种数据
const MOCK_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE',
  'MATIC', 'AVAX', 'ATOM', 'NEAR', 'FTM', 'ALGO', 'XRP', 'LTC',
  'UXLINK', 'SWARMS', 'PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK'
];

// 模拟价格数据
const MOCK_PRICES: { [key: string]: number } = {
  'BTC': 43250.50,
  'ETH': 2650.75,
  'UXLINK': 0.425,
  'SWARMS': 0.850,
  'SOL': 98.45,
  'ADA': 0.485,
  'DOT': 7.25,
  'LINK': 14.80,
  'UNI': 6.95,
  'AAVE': 95.20
};

class MockMarketDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30秒缓存

  // 获取缓存数据
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // 设置缓存数据
  private setCache(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // 生成随机价格变化
  private generateRandomChange(basePrice: number, volatility: number = 0.05): number {
    const change = (Math.random() - 0.5) * volatility * 2;
    return basePrice * (1 + change);
  }

  // 计算ATR (Average True Range)
  private calculateATR(ohlcvData: OHLCVData[], period: number = 14): number {
    if (ohlcvData.length < period + 1) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < ohlcvData.length; i++) {
      const current = ohlcvData[i];
      const previous = ohlcvData[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }

    // 计算ATR (简单移动平均)
    const recentTRs = trueRanges.slice(-period);
    const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
    
    return atr;
  }

  // 生成模拟OHLCV数据
  private generateMockOHLCV(symbol: string, periods: number, basePrice?: number): OHLCVData[] {
    const price = basePrice || MOCK_PRICES[symbol] || 1.0;
    const data: OHLCVData[] = [];
    let currentPrice = price;

    for (let i = 0; i < periods; i++) {
      const timestamp = Date.now() - (periods - i) * 3600000; // 每小时
      const volatility = 0.02; // 2% 波动率
      
      const open = currentPrice;
      const change = (Math.random() - 0.5) * volatility;
      const close = open * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000;

      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });

      currentPrice = close;
    }

    return data;
  }

  // 获取实时价格数据
  async getMarketData(symbol: string): Promise<MarketData | null> {
    const cacheKey = `market_${symbol.toUpperCase()}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const normalizedSymbol = symbol.toUpperCase();
    const basePrice = MOCK_PRICES[normalizedSymbol] || 1.0;
    
    // 生成模拟数据
    const currentPrice = this.generateRandomChange(basePrice, 0.02);
    const change24h = (Math.random() - 0.5) * 10; // -5% 到 +5%
    
    const marketData: MarketData = {
      symbol: normalizedSymbol,
      price: currentPrice,
      change24h,
      volume24h: Math.random() * 10000000,
      high24h: currentPrice * (1 + Math.random() * 0.05),
      low24h: currentPrice * (1 - Math.random() * 0.05),
      lastUpdated: new Date().toISOString()
    };

    // 缓存数据
    this.setCache(cacheKey, marketData);
    
    return marketData;
  }

  // 获取ATR数据
  async getATRData(symbol: string): Promise<ATRData | null> {
    const cacheKey = `atr_${symbol.toUpperCase()}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    const normalizedSymbol = symbol.toUpperCase();
    const basePrice = MOCK_PRICES[normalizedSymbol] || 1.0;
    
    // 生成模拟OHLCV数据用于ATR计算
    const ohlcv4h = this.generateMockOHLCV(normalizedSymbol, 50, basePrice);
    const ohlcv15m = this.generateMockOHLCV(normalizedSymbol, 100, basePrice);
    const ohlcv1h = this.generateMockOHLCV(normalizedSymbol, 50, basePrice);

    const atrData: ATRData = {
      atr4h: this.calculateATR(ohlcv4h, 14),
      atr15m: this.calculateATR(ohlcv15m, 14),
      atr1h: this.calculateATR(ohlcv1h, 14)
    };

    // 缓存数据
    this.setCache(cacheKey, atrData);
    
    return atrData;
  }

  // 搜索币种
  async searchSymbols(query: string): Promise<string[]> {
    // 模拟搜索延迟
    await new Promise(resolve => setTimeout(resolve, 200));

    const queryLower = query.toLowerCase();
    const results = MOCK_SYMBOLS.filter(symbol => 
      symbol.toLowerCase().includes(queryLower)
    );

    return results.slice(0, 10); // 限制结果数量
  }

  // 获取历史价格数据用于图表
  async getHistoricalData(symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCVData[]> {
    const cacheKey = `history_${symbol.toUpperCase()}_${timeframe}_${limit}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const normalizedSymbol = symbol.toUpperCase();
    const basePrice = MOCK_PRICES[normalizedSymbol] || 1.0;
    
    const historicalData = this.generateMockOHLCV(normalizedSymbol, limit, basePrice);

    // 缓存数据
    this.setCache(cacheKey, historicalData);
    
    return historicalData;
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取支持的交易所列表
  getSupportedExchanges(): string[] {
    return ['Mock Exchange (Demo)'];
  }
}

// 导出单例实例
export const marketDataService = new MockMarketDataService();
export default MockMarketDataService;
