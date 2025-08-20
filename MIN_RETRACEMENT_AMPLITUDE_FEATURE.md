# 最小回调波幅功能

## 功能概述

新增了"最小回调波幅"计算和显示功能，用于判断趋势回调的有效性。最小回调波幅基于ATR（平均真实波幅）和当前价格计算，为交易者提供量化的回调幅度参考。

## 计算公式

```
最小回调波幅 = ATR ÷ 当前价格
```

### 参数说明
- **ATR**: 根据用户选择的类型（4小时或日线）确定
- **当前价格**: 币种的实时价格
- **结果**: 以百分比形式表示的最小回调幅度

### ATR选择逻辑
- 用户选择**4小时ATR**: 使用4小时ATR最大值进行计算
- 用户选择**日线ATR**: 使用日线ATR最大值进行计算（更保守）
- 默认使用4小时ATR，与杠杆计算的ATR类型选择保持一致

## 功能特点

### 1. **动态计算**
- ✅ 与ATR类型选择联动：切换ATR类型时自动重新计算
- ✅ 实时更新：基于最新的ATR数据和当前价格
- ✅ 保守计算：使用ATR最大值确保更可靠的结果

### 2. **单策略页面显示**
- ✅ 独立的最小回调波幅显示区域
- ✅ 详细的计算公式提示
- ✅ 与ATR类型选择器联动
- ✅ 紫色标识，易于识别

### 3. **批量策略表格列**
- ✅ 新增"最小回调波幅"列
- ✅ 每个策略独立计算
- ✅ 支持表格排序
- ✅ 鼠标悬停显示详细计算过程

## 技术实现

### 1. **策略引擎计算函数**
```typescript
calculateMinRetracementAmplitude(input: StrategyInput): number {
  const leverageAtrType = input.leverageAtrType || '4h';
  
  let atr: number;
  let atrMax: number | undefined;
  
  if (leverageAtrType === '1d' && input.atr1d !== undefined && input.atr1d > 0) {
    atr = input.atr1d;
    atrMax = input.atr1dMax;
  } else {
    atr = input.atr4h;
    atrMax = input.atr4hMax;
  }
  
  const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
  const currentPrice = input.currentPrice || 0;
  
  if (currentPrice > 0 && atrForCalculation > 0) {
    return atrForCalculation / currentPrice; // 返回小数形式
  }
  
  return 0;
}
```

### 2. **类型定义更新**
```typescript
basic: {
  strategyName: string;
  riskLevel: "low" | "medium" | "high";
  recommendedLeverage: number;
  riskRewardRatio: string;
  confidence: number;
  minRetracementAmplitude: number; // 新增字段
};
```

### 3. **前端动态计算**
```typescript
const calculateDynamicMinRetracementAmplitude = (atrType: '4h' | '1d'): number => {
  let atr: number, atrMax: number | undefined;
  
  if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
    atr = strategy.atr1d;
    atrMax = strategy.atr1dMax;
  } else {
    atr = strategy.atr4h || 0;
    atrMax = strategy.atr4hMax;
  }
  
  const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
  const currentPrice = strategy.currentPrice || 0;
  
  if (currentPrice > 0 && atrForCalculation > 0) {
    return atrForCalculation / currentPrice;
  }
  
  return strategy.basic?.minRetracementAmplitude || 0;
};
```

## 用户界面展示

### 单策略页面
```
┌─────────────────────────────────────────┐
│ 最小回调波幅 (4小时ATR)                 │
│ 2.45%                                   │
│ ATR ÷ 当前价格                          │
└─────────────────────────────────────────┘
```

### 批量策略表格
```
┌──────┬────────┬────────┬────────┬────────────────┬────────┐
│ 币种 │日线ATR │最小回调波幅    │风险等级│ ...    │        │
├──────┼────────┼────────────────┼────────┼────────┼────────┤
│ BTC  │5.000000│4小时ATR波幅    │ 低风险 │ ...    │        │
│      │最大:   │2.45%           │        │        │        │
│      │6.000000│                │        │        │        │
├──────┼────────┼────────────────┼────────┼────────┼────────┤
│ ETH  │0.300000│日线ATR波幅     │ 中风险 │ ...    │        │
│      │最大:   │8.33%           │        │        │        │
│      │0.360000│                │        │        │        │
└──────┴────────┴────────────────┴────────┴────────┴────────┘
```

## 应用场景

### 1. **趋势回调判断**
- 当价格回调幅度 **< 最小回调波幅** 时：可能是噪音，趋势仍然有效
- 当价格回调幅度 **> 最小回调波幅** 时：可能是有效回调，需要重新评估趋势

### 2. **入场时机确认**
- **兜底区策略**：等待回调至少达到最小回调波幅后再考虑入场
- **探顶区策略**：突破后的回调如果小于最小回调波幅，可能是假突破

### 3. **止损设置参考**
- 可以将最小回调波幅作为止损距离的参考
- 避免因为正常的市场噪音而被止损

### 4. **风险评估**
- **较小的最小回调波幅**（如1-3%）：市场波动性较低，适合较高杠杆
- **较大的最小回调波幅**（如5-10%）：市场波动性较高，需要较低杠杆

## 数据示例

### 示例1：BTC（低波动性）
- 当前价格：100,000 USDT
- 4小时ATR最大值：2,500 USDT
- 最小回调波幅：2,500 ÷ 100,000 = 2.5%

### 示例2：小币种（高波动性）
- 当前价格：0.5 USDT
- 4小时ATR最大值：0.05 USDT
- 最小回调波幅：0.05 ÷ 0.5 = 10%

## 与其他指标的关系

### 1. **与杠杆倍数的关系**
- 最小回调波幅越大，建议杠杆倍数越低
- 两者都基于相同的ATR类型计算，保持一致性

### 2. **与滤波区间的关系**
- 滤波区间：基准价格 ± ATR（绝对值）
- 最小回调波幅：ATR ÷ 当前价格（相对值）
- 两者互补，提供不同维度的波动性参考

### 3. **与止损止盈的关系**
- 止损止盈基于15分钟ATR计算
- 最小回调波幅基于4小时/日线ATR计算
- 不同时间周期，适用于不同的交易决策

## 注意事项

### 1. **数据依赖**
- 需要有效的ATR数据和当前价格
- ATR数据不可用时显示原始策略中的值

### 2. **时间周期选择**
- 4小时ATR：适合短期交易，反应更敏感
- 日线ATR：适合长期持仓，更加保守

### 3. **市场条件适应**
- 在高波动市场中，最小回调波幅会相应增大
- 在低波动市场中，最小回调波幅会相应减小

现在交易者可以更精确地判断价格回调的有效性，提高交易决策的准确性！
