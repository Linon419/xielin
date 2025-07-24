// 合约市场数据接口
export interface ContractMarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  openInterest?: number;
  fundingRate?: number;
  lastUpdated: string;
  contractType: 'perpetual' | 'futures';
  exchange?: string;
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

// ATR分析数据接口
export interface ATRAnalysis {
  current_atr: number;
  atr_max: number;
  atr_min: number;
  atr_mean: number;
  atr_values: number[];
  volatility_trend: 'increasing' | 'decreasing' | 'unknown';
}

// ATR计算结果接口
export interface ATRData {
  // 当前ATR值
  atr4h: number;
  atr15m: number;
  atr1h: number;

  // ATR最大值（用于保守计算）
  atr4h_max: number;
  atr15m_max: number;
  atr1h_max: number;

  // 详细分析数据
  analysis?: {
    '4h': ATRAnalysis;
    '15m': ATRAnalysis;
    '1h': ATRAnalysis;
  };

  // 交易所信息
  exchange?: string;
  exchanges?: {
    '4h': string;
    '15m': string;
    '1h': string;
  };
}

// API响应接口
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 后端API配置
const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: 10000, // 10秒超时
};

class ContractDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30秒缓存
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.baseUrl;
  }

  // HTTP请求封装
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[ContractDataService] 发起请求: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const defaultOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    };

    console.log(`[ContractDataService] 请求选项:`, defaultOptions);

    try {
      console.log(`[ContractDataService] 开始fetch请求...`);
      const response = await fetch(url, defaultOptions);
      console.log(`[ContractDataService] fetch响应:`, response);
      console.log(`[ContractDataService] 响应状态:`, response.status, response.statusText);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`[ContractDataService] 开始解析JSON...`);
      const data = await response.json();
      console.log(`[ContractDataService] JSON解析完成:`, data);
      return data; // 返回完整的响应对象，包含 success 和 data 字段
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[ContractDataService] API请求失败 ${endpoint}:`, error);
      if (error instanceof Error) {
        console.error(`[ContractDataService] 错误详情:`, error.message, error.stack);
      }
      throw error;
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



  // 获取合约市场数据
  async getContractMarketData(symbol: string): Promise<ContractMarketData | null> {
    const cacheKey = `contract_market_${symbol.toUpperCase()}`;
    console.log(`[ContractDataService] 获取市场数据: ${symbol}`);

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[ContractDataService] 使用缓存数据:`, cached);
      return cached;
    }

    try {
      console.log(`[ContractDataService] 调用API: /contracts/${symbol}/market`);
      const response = await this.makeRequest<ContractMarketData>(`/contracts/${symbol}/market`);
      console.log(`[ContractDataService] API响应:`, response);
      console.log(`[ContractDataService] 响应类型:`, typeof response);
      console.log(`[ContractDataService] 响应success:`, response?.success);
      console.log(`[ContractDataService] 响应data:`, response?.data);

      if (response && response.success && response.data) {
        // 缓存数据
        this.setCache(cacheKey, response.data);
        console.log(`[ContractDataService] 数据获取成功:`, response.data);
        return response.data;
      }

      console.error(`[ContractDataService] API响应无效 - success: ${response?.success}, data:`, response?.data);
      return null;
    } catch (error) {
      console.error('[ContractDataService] 获取合约市场数据失败:', error);
      if (error instanceof Error) {
        console.error('[ContractDataService] 错误详情:', error.message, error.stack);
      }
      return null;
    }
  }

  // 获取合约ATR数据
  async getContractATRData(symbol: string, atrLookback: number = 3): Promise<ATRData | null> {
    const cacheKey = `contract_atr_${symbol.toUpperCase()}_${atrLookback}`;
    console.log(`[ContractDataService] 获取ATR数据: ${symbol}, lookback=${atrLookback}`);

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[ContractDataService] 使用ATR缓存数据:`, cached);
      return cached;
    }

    try {
      console.log(`[ContractDataService] 调用ATR API: /contracts/${symbol}/atr?lookback=${atrLookback}`);
      const response = await this.makeRequest<ATRData>(`/contracts/${symbol}/atr?lookback=${atrLookback}`);
      console.log(`[ContractDataService] ATR API响应:`, response);
      console.log(`[ContractDataService] ATR响应类型:`, typeof response);
      console.log(`[ContractDataService] ATR响应success:`, response?.success);
      console.log(`[ContractDataService] ATR响应data:`, response?.data);

      if (response && response.success && response.data) {
        // 缓存数据
        this.setCache(cacheKey, response.data);
        console.log(`[ContractDataService] ATR数据获取成功:`, response.data);
        return response.data;
      }

      console.error(`[ContractDataService] ATR API响应无效 - success: ${response?.success}, data:`, response?.data);
      return null;
    } catch (error) {
      console.error('[ContractDataService] 获取合约ATR数据失败:', error);
      if (error instanceof Error) {
        console.error('[ContractDataService] ATR错误详情:', error.message, error.stack);
      }
      return null;
    }
  }

  // 搜索合约币种
  async searchContractSymbols(query: string): Promise<string[]> {
    const cacheKey = `contract_search_${query.toLowerCase()}`;

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<string[]>(`/contracts/search?q=${encodeURIComponent(query)}`);

      if (response.success && response.data) {
        // 缓存结果
        this.setCache(cacheKey, response.data);
        return response.data;
      }

      return [];
    } catch (error) {
      console.error('搜索合约币种失败:', error);

      // 降级到本地搜索
      const popularContracts = [
        'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE',
        'MATIC', 'AVAX', 'ATOM', 'NEAR', 'FTM', 'ALGO', 'XRP', 'LTC',
        'UXLINK', 'SWARMS', 'PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK',
        'ARB', 'OP', 'SUI', 'APT', 'SEI', 'TIA', 'ORDI', 'SATS'
      ];

      const queryLower = query.toLowerCase();
      const results = popularContracts.filter(symbol =>
        symbol.toLowerCase().includes(queryLower)
      ).slice(0, 10);

      return results;
    }
  }

  // 获取合约历史价格数据用于图表
  async getContractHistoricalData(symbol: string, timeframe: string = '1h', limit: number = 100): Promise<OHLCVData[]> {
    const cacheKey = `contract_history_${symbol.toUpperCase()}_${timeframe}_${limit}`;

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        symbol,
        timeframe,
        limit: limit.toString()
      });

      const response = await this.makeRequest<OHLCVData[]>(`/contracts/${symbol}/history?${params}`);

      if (response.success && response.data) {
        // 缓存数据
        this.setCache(cacheKey, response.data);
        return response.data;
      }

      return [];
    } catch (error) {
      console.error('获取合约历史数据失败:', error);
      return [];
    }
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取支持的交易所列表
  getSupportedExchanges(): string[] {
    return ['Binance', 'OKX', 'Bybit'];
  }
}

// 导出单例实例
export const contractDataService = new ContractDataService();
export default ContractDataService;
