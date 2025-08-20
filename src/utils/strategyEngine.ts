import { StrategyInput, StrategyOutput, RiskConfig, ValidationError } from '../types/strategy';

// 风险配置
const RISK_CONFIGS: RiskConfig = {
  conservative: {
    maxLeverage: 10,
    stopLossMultiplier: 0.5,
    takeProfitMultiplier: 1.5
  },
  balanced: {
    maxLeverage: 25,
    stopLossMultiplier: 1.0,
    takeProfitMultiplier: 2.0
  },
  aggressive: {
    maxLeverage: 50,
    stopLossMultiplier: 1.5,
    takeProfitMultiplier: 3.0
  }
};

export class StrategyEngine {
  
  // 验证输入数据
  validateInput(input: StrategyInput): { errors: ValidationError[], warnings: ValidationError[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const strictValidation = input.strictValidation !== false; // 默认为严格验证

    if (!input.symbol || input.symbol.trim().length === 0) {
      errors.push({ field: 'symbol', message: '请输入币种名称' });
    }

    if (input.schellingPoint <= 0) {
      errors.push({ field: 'schellingPoint', message: '谢林点位必须大于0' });
    }

    if (input.currentPrice <= 0) {
      errors.push({ field: 'currentPrice', message: '当前价格必须大于0' });
    }

    if (input.atr4h <= 0 || input.atr4h >= input.currentPrice * 0.5) {
      errors.push({ field: 'atr4h', message: '4小时ATR必须大于0且小于当前价格的50%' });
    }

    if (input.atr15m <= 0 || input.atr15m >= input.currentPrice * 0.3) {
      errors.push({ field: 'atr15m', message: '15分钟ATR必须大于0且小于当前价格的30%' });
    }

    // 检查谢林点位与当前价格的差距
    const priceDiff = Math.abs(input.schellingPoint - input.currentPrice) / input.currentPrice;
    if (priceDiff > 0.2) {
      const message = `谢林点位与当前价格差距为${(priceDiff * 100).toFixed(1)}%，超过建议的20%`;

      if (strictValidation) {
        errors.push({
          field: 'schellingPoint',
          message: message + '，请调整谢林点位'
        });
      } else {
        warnings.push({
          field: 'schellingPoint',
          message: message + '，策略风险较高'
        });
      }
    }

    return { errors, warnings };
  }
  
  // 计算杠杆倍数（支持用户选择ATR类型）
  calculateLeverage(input: StrategyInput): number {
    const leverageAtrType = input.leverageAtrType || '4h'; // 默认使用4h ATR

    console.log(`[StrategyEngine] ${input.symbol} - 杠杆计算开始，选择的ATR类型: ${leverageAtrType}`);
    console.log(`[StrategyEngine] ${input.symbol} - 输入数据:`, {
      atr4h: input.atr4h,
      atr4hMax: input.atr4hMax,
      atr1d: input.atr1d,
      atr1dMax: input.atr1dMax,
      leverageAtrType: input.leverageAtrType
    });

    let atr: number;
    let atrMax: number | undefined;

    if (leverageAtrType === '1d' && input.atr1d !== undefined && input.atr1d > 0) {
      // 使用日线ATR计算杠杆
      atr = input.atr1d;
      atrMax = input.atr1dMax;
      console.log(`[StrategyEngine] ${input.symbol} - 使用日线ATR计算杠杆: atr1d=${atr}, atr1dMax=${atrMax}`);
    } else {
      // 使用4小时ATR计算杠杆（默认）
      atr = input.atr4h;
      atrMax = input.atr4hMax;
      console.log(`[StrategyEngine] ${input.symbol} - 使用4小时ATR计算杠杆: atr4h=${atr}, atr4hMax=${atrMax}`);

      // 如果用户选择了日线ATR但数据不可用，给出警告
      if (leverageAtrType === '1d') {
        console.warn(`[StrategyEngine] ${input.symbol} - 用户选择日线ATR但数据不可用，回退到4小时ATR`);
      }
    }

    // 使用ATR最大值进行更保守的杠杆计算
    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const baseMultiplier = input.currentPrice / atrForCalculation;
    const leverage = Math.floor(baseMultiplier); // 删除保守系数，直接使用基础倍数

    console.log(`[StrategyEngine] ${input.symbol} - 杠杆计算: 当前价格=${input.currentPrice}, 使用ATR=${atrForCalculation}, 杠杆=${leverage}`);

    // 关闭风险限制，直接返回基于ATR计算的杠杆
    return leverage;
  }

  // 计算最小回调波幅（支持用户选择ATR类型）
  calculateMinRetracementAmplitude(input: StrategyInput): number {
    const leverageAtrType = input.leverageAtrType || '4h'; // 默认使用4h ATR

    let atr: number;
    let atrMax: number | undefined;

    if (leverageAtrType === '1d' && input.atr1d !== undefined && input.atr1d > 0) {
      // 使用日线ATR计算最小回调波幅
      atr = input.atr1d;
      atrMax = input.atr1dMax;
    } else {
      // 使用4小时ATR计算最小回调波幅（默认）
      atr = input.atr4h;
      atrMax = input.atr4hMax;
    }

    // 使用ATR最大值进行更保守的计算
    const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
    const currentPrice = input.currentPrice || 0;

    if (currentPrice > 0 && atrForCalculation > 0) {
      // 最小回调波幅 = ATR ÷ 当前价格
      const minRetracementAmplitude = atrForCalculation / currentPrice;

      console.log(`[StrategyEngine] ${input.symbol} - 最小回调波幅计算: ATR=${atrForCalculation}, 当前价格=${currentPrice}, 最小回调波幅=${(minRetracementAmplitude * 100).toFixed(2)}%`);

      return minRetracementAmplitude;
    }

    return 0;
  }
  
  // 生成兜底区策略
  generateSupportStrategy(input: StrategyInput): StrategyOutput {
    const riskConfig = RISK_CONFIGS['balanced']; // 使用默认的平衡型配置
    const leverage = this.calculateLeverage(input);
    const minRetracementAmplitude = this.calculateMinRetracementAmplitude(input);

    // 使用ATR最大值进行更保守的滤波区间计算
    const atr4hForFilter = input.atr4hMax && input.atr4hMax > input.atr4h ? input.atr4hMax : input.atr4h;
    const filterLower = input.schellingPoint - atr4hForFilter;
    const filterUpper = input.schellingPoint + atr4hForFilter;

    // 使用ATR最大值进行更保守的止损止盈计算
    const atr15mForStops = input.atr15mMax && input.atr15mMax > input.atr15m ? input.atr15mMax : input.atr15m;
    const stopLossDistance = atr15mForStops * riskConfig.stopLossMultiplier;
    const takeProfitDistance = atr15mForStops * riskConfig.takeProfitMultiplier;
    
    // 分析当前位置
    const distanceToTarget = (input.currentPrice - input.schellingPoint) / input.schellingPoint * 100;
    let recommendation = '';
    let confidence = 0;
    
    if (input.currentPrice < input.schellingPoint) {
      recommendation = '等待价格回到谢林兜底区再开仓';
      confidence = 60;
    } else if (input.currentPrice <= input.schellingPoint * 1.05) {
      recommendation = '当前位置接近兜底区，可考虑开仓';
      confidence = 85;
    } else {
      recommendation = '价格偏离兜底区较远，建议观察';
      confidence = 40;
    }
    
    return {
      // 批量处理需要的字段
      symbol: input.symbol,
      type: input.type,
      schellingPoint: input.schellingPoint,
      currentPrice: input.currentPrice,
      high24h: input.high24h,
      low24h: input.low24h,
      atr4h: input.atr4h,
      atr4hMax: input.atr4hMax,
      atr15m: input.atr15m,
      atr15mMax: input.atr15mMax,
      atr1d: input.atr1d,
      atr1dMax: input.atr1dMax,
      leverageAtrType: input.leverageAtrType,

      basic: {
        strategyName: `${input.symbol} - 兜底区滤波对冲策略`,
        riskLevel: leverage > 20 ? 'high' : leverage > 10 ? 'medium' : 'low',
        recommendedLeverage: leverage,
        riskRewardRatio: `1:${(takeProfitDistance / stopLossDistance).toFixed(1)}`,
        confidence,
        minRetracementAmplitude: minRetracementAmplitude
      },
      operations: {
        entry: {
          price: input.schellingPoint,
          timing: '价格回到滤波区间时',
          positionSize: `建议使用${leverage}倍杠杆`,
          conditions: [
            `价格进入${filterLower.toFixed(6)}-${filterUpper.toFixed(6)}区间`,
            '成交量放大确认',
            '15分钟K线收阳'
          ]
        },
        riskControl: {
          stopLoss: input.schellingPoint - stopLossDistance,
          takeProfit: input.schellingPoint + takeProfitDistance,
          hedgeStrategy: '滤波对冲策略',
          positionManagement: [
            '分批建仓，降低成本',
            '设置条件委托单',
            '严格执行止损'
          ],
          // ATR相关信息
          atrInfo: {
            atr15m: input.atr15m,
            atr15mMax: atr15mForStops,
            stopLossDistance,
            takeProfitDistance,
            stopLossPercent: (stopLossDistance / input.currentPrice) * 100,
            takeProfitPercent: (atr15mForStops / input.currentPrice) * 100, // 直接使用15分钟ATR最大值计算百分比
            riskMultiplier: riskConfig.stopLossMultiplier,
            takeProfitMultiplier: riskConfig.takeProfitMultiplier
          }
        },
        exit: {
          profitTargets: [
            input.schellingPoint + takeProfitDistance * 0.5,
            input.schellingPoint + takeProfitDistance,
            input.schellingPoint + takeProfitDistance * 1.5
          ],
          exitConditions: [
            '达到止盈目标',
            '技术形态破坏',
            '市场情绪转变'
          ],
          trailingStop: {
            enabled: true,
            percentage: 3
          }
        }
      },
      analysis: {
        successRate: 75,
        timeframe: '1-3天',
        capitalEfficiency: '高效',
        marketConditions: ['震荡市', '下跌后反弹'],
        distanceToTarget,
        recommendation
      },
      risks: {
        primaryRisks: [
          '价格持续下跌突破支撑',
          '市场流动性不足',
          '突发利空消息'
        ],
        mitigation: [
          '严格止损执行',
          '分批建仓',
          '关注市场情绪'
        ],
        worstCase: `最大亏损约${((stopLossDistance / input.currentPrice) * 100).toFixed(1)}%`
      }
    };
  }
  
  // 生成探顶区策略
  generateBreakoutStrategy(input: StrategyInput): StrategyOutput {
    const riskConfig = RISK_CONFIGS['balanced']; // 使用默认的平衡型配置
    const leverage = this.calculateLeverage(input);
    const minRetracementAmplitude = this.calculateMinRetracementAmplitude(input);

    // 计算观察和确认区间（用于后续扩展功能）
    // const observationZone = [input.currentPrice, input.schellingPoint];
    // const confirmationZone = [input.schellingPoint, input.schellingPoint * 1.05];

    // 使用ATR最大值进行更保守的止损止盈计算
    const atr15mForStops = input.atr15mMax && input.atr15mMax > input.atr15m ? input.atr15mMax : input.atr15m;
    const stopLossDistance = atr15mForStops * riskConfig.stopLossMultiplier;
    const takeProfitDistance = atr15mForStops * riskConfig.takeProfitMultiplier;
    
    // 分析距离探顶区的位置
    const distanceToTarget = (input.schellingPoint - input.currentPrice) / input.currentPrice * 100;
    let recommendation = '';
    let confidence = 0;
    
    if (distanceToTarget > 10) {
      recommendation = '距离探顶区较远，继续观察';
      confidence = 50;
    } else if (distanceToTarget > 0) {
      recommendation = '接近探顶区，准备突破策略';
      confidence = 80;
    } else {
      recommendation = '已突破探顶区，判断突破有效性';
      confidence = 70;
    }
    
    return {
      // 批量处理需要的字段
      symbol: input.symbol,
      type: input.type,
      schellingPoint: input.schellingPoint,
      currentPrice: input.currentPrice,
      high24h: input.high24h,
      low24h: input.low24h,
      atr4h: input.atr4h,
      atr4hMax: input.atr4hMax,
      atr15m: input.atr15m,
      atr15mMax: input.atr15mMax,
      atr1d: input.atr1d,
      atr1dMax: input.atr1dMax,
      leverageAtrType: input.leverageAtrType,

      basic: {
        strategyName: `${input.symbol} - 探顶区突破跟踪策略`,
        riskLevel: leverage > 20 ? 'high' : leverage > 10 ? 'medium' : 'low',
        recommendedLeverage: leverage,
        riskRewardRatio: `1:${(takeProfitDistance / stopLossDistance).toFixed(1)}`,
        confidence,
        minRetracementAmplitude: minRetracementAmplitude
      },
      operations: {
        entry: {
          price: input.schellingPoint * 1.02,
          timing: '突破探顶区并确认有效时',
          positionSize: `建议使用${leverage}倍杠杆`,
          conditions: [
            `价格突破${input.schellingPoint.toFixed(6)}`,
            '成交量显著放大',
            '连续两根15分钟K线收阳'
          ]
        },
        riskControl: {
          stopLoss: input.schellingPoint - stopLossDistance,
          takeProfit: input.schellingPoint + takeProfitDistance,
          hedgeStrategy: '突破跟踪策略',
          positionManagement: [
            '突破确认后快速建仓',
            '设置移动止损',
            '分批止盈'
          ],
          // ATR相关信息
          atrInfo: {
            atr15m: input.atr15m,
            atr15mMax: atr15mForStops,
            stopLossDistance,
            takeProfitDistance,
            stopLossPercent: (stopLossDistance / input.currentPrice) * 100,
            takeProfitPercent: (atr15mForStops / input.currentPrice) * 100, // 直接使用15分钟ATR最大值计算百分比
            riskMultiplier: riskConfig.stopLossMultiplier,
            takeProfitMultiplier: riskConfig.takeProfitMultiplier
          }
        },
        exit: {
          profitTargets: [
            input.schellingPoint + takeProfitDistance * 0.6,
            input.schellingPoint + takeProfitDistance * 1.2,
            input.schellingPoint + takeProfitDistance * 2.0
          ],
          exitConditions: [
            '达到止盈目标',
            '突破失败回落',
            '上涨动能衰竭'
          ],
          trailingStop: {
            enabled: true,
            percentage: 5
          }
        }
      },
      analysis: {
        successRate: 65,
        timeframe: '2-5天',
        capitalEfficiency: '中高效',
        marketConditions: ['上涨趋势', '突破行情'],
        distanceToTarget,
        recommendation
      },
      risks: {
        primaryRisks: [
          '假突破回落',
          '高位套牢',
          '市场情绪转冷'
        ],
        mitigation: [
          '等待突破确认',
          '设置移动止损',
          '关注成交量变化'
        ],
        worstCase: `最大亏损约${((stopLossDistance / input.currentPrice) * 100).toFixed(1)}%`
      }
    };
  }
  
  // 主要策略生成方法
  generateStrategy(input: StrategyInput): { strategy?: StrategyOutput; errors?: ValidationError[] } {
    // 验证输入
    const validation = this.validateInput(input);
    if (validation.errors.length > 0) {
      return { errors: validation.errors };
    }
    
    // 根据类型生成策略
    const strategy = input.type === '兜底区'
      ? this.generateSupportStrategy(input)
      : this.generateBreakoutStrategy(input);

    // 如果有警告信息，添加到策略中
    if (validation.warnings.length > 0) {
      strategy.warnings = validation.warnings;
    }

    return { strategy };
  }
}
