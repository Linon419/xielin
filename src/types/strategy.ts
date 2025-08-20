// 策略输入数据结构
export interface StrategyInput {
  symbol: string;           // 币种名称
  type: "兜底区" | "探顶区"; // 谢林点类型
  schellingPoint: number;   // 谢林点位
  currentPrice: number;     // 当前价格
  high24h?: number;        // 24小时最高价格
  low24h?: number;         // 24小时最低价格
  atr4h: number;           // 4小时ATR
  atr15m: number;          // 15分钟ATR
  atr1d?: number;          // 日线ATR
  atr4hMax?: number;       // ATR 4小时最大值（用于保守计算）
  atr15mMax?: number;      // ATR 15分钟最大值（用于保守计算）
  atr1dMax?: number;       // ATR 日线最大值（用于保守计算）
  leverageAtrType?: '4h' | '1d'; // 杠杆计算使用的ATR类型，默认4h
  operationCycle?: string; // 操作周期
  atrLookback?: number;    // ATR回看画幅数量，默认3
  strictValidation?: boolean; // 是否严格验证，默认true，批量模式设为false
}

// 策略输出数据结构
export interface StrategyOutput {
  // 批量处理需要的字段
  symbol?: string;
  type?: "兜底区" | "探顶区";
  schellingPoint?: number;
  currentPrice?: number;
  high24h?: number;         // 24小时最高价格
  low24h?: number;          // 24小时最低价格
  atr4h?: number;           // 4小时ATR
  atr4hMax?: number;        // 4小时ATR最大值
  atr15m?: number;          // 15分钟ATR
  atr15mMax?: number;       // 15分钟ATR最大值
  atr1d?: number;           // 日线ATR
  atr1dMax?: number;        // 日线ATR最大值
  leverageAtrType?: '4h' | '1d'; // 杠杆计算使用的ATR类型

  basic: {
    strategyName: string;
    riskLevel: "low" | "medium" | "high";
    recommendedLeverage: number;
    riskRewardRatio: string;
    confidence: number; // 置信度 0-100
    minRetracementAmplitude: number; // 最小回调波幅（百分比）
  };

  // 警告信息（用于批量模式的非严格验证）
  warnings?: Array<{
    field: string;
    message: string;
  }>;
  
  operations: {
    entry: {
      price: number;
      timing: string;
      positionSize: string;
      conditions: string[];
    };
    
    riskControl: {
      stopLoss: number;
      takeProfit: number;
      hedgeStrategy: string;
      positionManagement: string[];
      // ATR相关信息
      atrInfo?: {
        atr15m: number;           // 当前15分钟ATR
        atr15mMax: number;        // 15分钟ATR最大值
        stopLossDistance: number; // 止损距离
        takeProfitDistance: number; // 止盈距离
        stopLossPercent: number;  // 止损百分比 (ATR/价格)
        takeProfitPercent: number; // 止盈百分比 (ATR/价格)
        riskMultiplier: number;   // 止损风险倍数
        takeProfitMultiplier: number; // 止盈风险倍数
      };
    };
    
    exit: {
      profitTargets: number[];
      exitConditions: string[];
      trailingStop: {
        enabled: boolean;
        percentage: number;
      };
    };
  };
  
  analysis: {
    successRate: number;
    timeframe: string;
    capitalEfficiency: string;
    marketConditions: string[];
    distanceToTarget: number; // 距离目标点位的百分比
    recommendation: string;   // 操作建议
  };
  
  risks: {
    primaryRisks: string[];
    mitigation: string[];
    worstCase: string;
  };
}

// 风险偏好配置
export interface RiskConfig {
  conservative: {
    maxLeverage: number;
    stopLossMultiplier: number;
    takeProfitMultiplier: number;
  };
  balanced: {
    maxLeverage: number;
    stopLossMultiplier: number;
    takeProfitMultiplier: number;
  };
  aggressive: {
    maxLeverage: number;
    stopLossMultiplier: number;
    takeProfitMultiplier: number;
  };
}

// 表单验证错误
export interface ValidationError {
  field: string;
  message: string;
}

// 市场数据
export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}
