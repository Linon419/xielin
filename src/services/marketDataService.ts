import ccxt from 'ccxt';

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

// 支持的交易所配置
const EXCHANGES = {
  binance: () => new ccxt.binance({
    sandbox: false,
    rateLimit: 1200,
    enableRateLimit: true,
  }),
  okx: () => new ccxt.okx({
    sandbox: false,
    rateLimit: 1000,
    enableRateLimit: true,
  }),
  bybit: () => new ccxt.bybit({
    sandbox: false,
    rateLimit: 1000,
    enableRateLimit: true,
  })
};

class MarketDataService {
  private exchanges: { [key: string]: any } = {};
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30秒缓存

  constructor() {
    this.initializeExchanges();
  }

  private initializeExchanges() {
    try {
      Object.entries(EXCHANGES).forEach(([name, createExchange]) => {
        try {
          this.exchanges[name] = createExchange();
        } catch (error) {
          console.warn(`Failed to initialize ${name} exchange:`, error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize exchanges:', error);
    }
  }

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

  // 标准化币种符号
  private normalizeSymbol(symbol: string): string {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // 常见的币种符号映射
    const symbolMap: { [key: string]: string } = {
      'BTC': 'BTC/USDT',
      'ETH': 'ETH/USDT',
      'UXLINK': 'UXLINK/USDT',
      'SWARMS': 'SWARMS/USDT',
      'SOL': 'SOL/USDT',
      'ADA': 'ADA/USDT',
      'DOT': 'DOT/USDT',
      'LINK': 'LINK/USDT',
      'UNI': 'UNI/USDT',
      'AAVE': 'AAVE/USDT'
    };

    return symbolMap[normalized] || `${normalized}/USDT`;
  }

  // 获取实时价格数据
  async getMarketData(symbol: string): Promise<MarketData | null> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const cacheKey = `market_${normalizedSymbol}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 尝试从多个交易所获取数据
    const exchangeNames = Object.keys(this.exchanges);
    
    for (const exchangeName of exchangeNames) {
      try {
        const exchange = this.exchanges[exchangeName];
        if (!exchange) continue;

        // 获取ticker数据
        const ticker = await exchange.fetchTicker(normalizedSymbol);
        
        const marketData: MarketData = {
          symbol: symbol.toUpperCase(),
          price: ticker.last || ticker.close || 0,
          change24h: ticker.percentage || 0,
          volume24h: ticker.quoteVolume || ticker.baseVolume || 0,
          high24h: ticker.high || 0,
          low24h: ticker.low || 0,
          lastUpdated: new Date().toISOString()
        };

        // 缓存数据
        this.setCache(cacheKey, marketData);
        
        return marketData;
      } catch (error) {
        console.warn(`Failed to fetch data from ${exchangeName}:`, error);
        continue;
      }
    }

    return null;
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

  // 获取ATR数据
  async getATRData(symbol: string): Promise<ATRData | null> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const cacheKey = `atr_${normalizedSymbol}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const exchangeNames = Object.keys(this.exchanges);
    
    for (const exchangeName of exchangeNames) {
      try {
        const exchange = this.exchanges[exchangeName];
        if (!exchange) continue;

        // 获取不同时间周期的OHLCV数据
        const [ohlcv4h, ohlcv15m, ohlcv1h] = await Promise.all([
          exchange.fetchOHLCV(normalizedSymbol, '4h', undefined, 50),
          exchange.fetchOHLCV(normalizedSymbol, '15m', undefined, 100),
          exchange.fetchOHLCV(normalizedSymbol, '1h', undefined, 50)
        ]);

        // 转换数据格式
        const convert = (data: number[][]): OHLCVData[] => 
          data.map(([timestamp, open, high, low, close, volume]) => ({
            timestamp,
            open,
            high,
            low,
            close,
            volume
          }));

        const atrData: ATRData = {
          atr4h: this.calculateATR(convert(ohlcv4h), 14),
          atr15m: this.calculateATR(convert(ohlcv15m), 14),
          atr1h: this.calculateATR(convert(ohlcv1h), 14)
        };

        // 缓存数据
        this.setCache(cacheKey, atrData);
        
        return atrData;
      } catch (error) {
        console.warn(`Failed to fetch ATR data from ${exchangeName}:`, error);
        continue;
      }
    }

    return null;
  }

  // 搜索币种
  async searchSymbols(query: string): Promise<string[]> {
    const cacheKey = `search_${query.toLowerCase()}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const results: Set<string> = new Set();
    
    // 预定义的热门币种
    const popularSymbols = [
      'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE',
      'MATIC', 'AVAX', 'ATOM', 'NEAR', 'FTM', 'ALGO', 'XRP', 'LTC',
      'UXLINK', 'SWARMS', 'PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK'
    ];

    // 模糊匹配
    const queryLower = query.toLowerCase();
    popularSymbols.forEach(symbol => {
      if (symbol.toLowerCase().includes(queryLower)) {
        results.add(symbol);
      }
    });

    // 尝试从交易所获取市场列表
    for (const exchangeName of Object.keys(this.exchanges)) {
      try {
        const exchange = this.exchanges[exchangeName];
        if (!exchange) continue;

        const markets = await exchange.loadMarkets();
        
        Object.keys(markets).forEach(marketSymbol => {
          const baseSymbol = markets[marketSymbol].base;
          if (baseSymbol && baseSymbol.toLowerCase().includes(queryLower)) {
            results.add(baseSymbol);
          }
        });

        break; // 只从一个交易所获取即可
      } catch (error) {
        console.warn(`Failed to search symbols from ${exchangeName}:`, error);
        continue;
      }
    }

    const resultArray = Array.from(results).slice(0, 10); // 限制结果数量
    
    // 缓存结果
    this.setCache(cacheKey, resultArray);
    
    return resultArray;
  }

  // 获取历史价格数据用于图表
  async getHistoricalData(symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCVData[]> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const cacheKey = `history_${normalizedSymbol}_${timeframe}_${limit}`;
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const exchangeNames = Object.keys(this.exchanges);
    
    for (const exchangeName of exchangeNames) {
      try {
        const exchange = this.exchanges[exchangeName];
        if (!exchange) continue;

        const ohlcv = await exchange.fetchOHLCV(normalizedSymbol, timeframe, undefined, limit);
        
        const historicalData: OHLCVData[] = ohlcv.map(([timestamp, open, high, low, close, volume]: [number, number, number, number, number, number]) => ({
          timestamp,
          open,
          high,
          low,
          close,
          volume
        }));

        // 缓存数据
        this.setCache(cacheKey, historicalData);
        
        return historicalData;
      } catch (error) {
        console.warn(`Failed to fetch historical data from ${exchangeName}:`, error);
        continue;
      }
    }

    return [];
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取支持的交易所列表
  getSupportedExchanges(): string[] {
    return Object.keys(this.exchanges);
  }
}

// 导出单例实例
export const marketDataService = new MarketDataService();
export default MarketDataService;
