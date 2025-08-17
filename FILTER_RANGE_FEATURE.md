# 滤波区间显示功能

## 功能概述

为单策略和批量策略页面添加了滤波区间显示功能。用户可以选择基于当前价格或谢林点，结合选择的ATR类型来计算和显示滤波区间。

## 主要功能特点

### 1. **单策略页面滤波区间**
- ✅ 滤波区间基准选择：谢林点 / 当前价格
- ✅ 动态ATR类型：4小时ATR / 日线ATR
- ✅ 实时计算：基准价格 ± ATR最大值
- ✅ 详细提示：鼠标悬停显示完整计算公式

### 2. **批量策略表格滤波区间列**
- ✅ 每个策略独立的基准类型选择
- ✅ 与ATR类型选择联动计算
- ✅ 批量设置功能：一键设置所有策略的基准类型
- ✅ 表格排序：支持按滤波区间下限排序

### 3. **智能计算逻辑**
```typescript
滤波区间计算公式：
下限 = 基准价格 - ATR最大值
上限 = 基准价格 + ATR最大值

其中：
- 基准价格 = 当前价格 OR 谢林点（用户选择）
- ATR最大值 = 4小时ATR最大值 OR 日线ATR最大值（用户选择）
```

## 用户界面展示

### 单策略页面
```
┌─────────────────────────────────────────┐
│ 滤波区间基准： [谢林点 ▼]               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 滤波区间 (4小时ATR)                 │ │
│ │ 94500.000000 - 95500.000000         │ │
│ │ 基于谢林点 ± ATR                    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 批量策略表格
```
批量设置杠杆ATR类型： [选择ATR类型 ▼]    批量设置滤波区间基准： [选择基准类型 ▼]

┌──────┬────────┬────────┬────────┬────────┬────────┬────────────────┬────────┐
│ 币种 │策略类型│ 谢林点 │当前价格│建议杠杆│入场价格│ 滤波区间       │止盈百分│
├──────┼────────┼────────┼────────┼────────┼────────┼────────────────┼────────┤
│ BTC  │ 兜底区 │ 95000  │ 100000 │[4h▼]   │ 95000  │[谢林点基准▼]   │ 5.26%  │
│      │        │        │        │  40x   │        │4小时ATR区间    │        │
│      │        │        │        │        │        │92500-97500     │        │
├──────┼────────┼────────┼────────┼────────┼────────┼────────────────┼────────┤
│ ETH  │ 探顶区 │ 3500   │ 3600   │[1d▼]   │ 3500   │[当前价格基准▼] │ 2.86%  │
│      │        │        │        │  12x(1d)│       │日线ATR区间     │        │
│      │        │        │        │        │        │3240-3960       │        │
└──────┴────────┴────────┴────────┴────────┴────────┴────────────────┴────────┘
```

## 技术实现

### 1. **状态管理**
```typescript
// 单策略
const [selectedAtrType, setSelectedAtrType] = useState<'4h' | '1d'>('4h');
const [filterBaseType, setFilterBaseType] = useState<'currentPrice' | 'schellingPoint'>('schellingPoint');

// 批量策略
const [atrTypeSelections, setAtrTypeSelections] = useState<Record<string, '4h' | '1d'>>();
const [filterBaseSelections, setFilterBaseSelections] = useState<Record<string, 'currentPrice' | 'schellingPoint'>>();
```

### 2. **滤波区间计算函数**
```typescript
const calculateFilterRange = (atrType: '4h' | '1d', baseType: 'currentPrice' | 'schellingPoint') => {
  let atr: number, atrMax: number | undefined;
  
  if (atrType === '1d' && strategy.atr1d !== undefined && strategy.atr1d > 0) {
    atr = strategy.atr1d;
    atrMax = strategy.atr1dMax;
  } else {
    atr = strategy.atr4h || 0;
    atrMax = strategy.atr4hMax;
  }
  
  const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
  const basePrice = baseType === 'currentPrice' ? currentPrice : schellingPoint;
  
  if (basePrice > 0 && atrForCalculation > 0) {
    return {
      lower: basePrice - atrForCalculation,
      upper: basePrice + atrForCalculation,
      basePrice,
      atr: atrForCalculation
    };
  }
  
  return null;
};
```

### 3. **批量设置功能**
```typescript
// 批量设置ATR类型
const updateAllAtrTypes = (atrType: '4h' | '1d') => {
  const newSelections: Record<string, '4h' | '1d'> = {};
  strategies.forEach(strategy => {
    if (strategy.symbol) {
      newSelections[strategy.symbol] = atrType;
    }
  });
  setAtrTypeSelections(newSelections);
};

// 批量设置滤波区间基准
const updateAllFilterBases = (baseType: 'currentPrice' | 'schellingPoint') => {
  const newSelections: Record<string, 'currentPrice' | 'schellingPoint'> = {};
  strategies.forEach(strategy => {
    if (strategy.symbol) {
      newSelections[strategy.symbol] = baseType;
    }
  });
  setFilterBaseSelections(newSelections);
};
```

## 用户体验优势

### 1. **灵活的基准选择**
- **谢林点基准**：适合支撑/阻力位策略，区间相对固定
- **当前价格基准**：适合跟踪当前市场价格的动态策略

### 2. **实时联动计算**
- ATR类型变化时，滤波区间自动重新计算
- 基准类型变化时，滤波区间中心点自动调整
- 所有变化都是实时的，无需重新生成策略

### 3. **直观的区间显示**
- 清晰的数值范围显示
- 颜色标识不同的ATR类型
- 详细的计算公式提示

### 4. **批量操作效率**
- 一键设置所有策略的ATR类型
- 一键设置所有策略的基准类型
- 支持混合使用不同设置

## 应用场景

### 1. **兜底区策略**
- 推荐使用**谢林点基准**
- 滤波区间围绕支撑位形成
- 适合在支撑位附近建仓

### 2. **探顶区策略**
- 可选择**当前价格基准**
- 滤波区间跟随价格变化
- 适合突破后的跟踪策略

### 3. **保守vs激进**
- **日线ATR**：更大的滤波区间，更保守
- **4小时ATR**：较小的滤波区间，更激进

## 数据验证

### 1. **输入验证**
- 检查ATR数据是否可用
- 验证基准价格是否有效
- 自动处理数据缺失情况

### 2. **计算验证**
- 确保滤波区间上限 > 下限
- 验证ATR最大值的使用
- 处理极端数值情况

### 3. **显示验证**
- 数值精度控制（4-6位小数）
- 颜色和样式一致性
- 响应式布局适配

## 测试建议

### 1. **功能测试**
- 测试不同ATR类型的区间计算
- 验证不同基准类型的区间变化
- 检查批量设置功能

### 2. **界面测试**
- 验证滤波区间显示正确
- 测试鼠标悬停提示
- 检查表格排序功能

### 3. **数据测试**
- 测试ATR数据不可用的情况
- 验证极端价格值的处理
- 检查计算精度

现在用户可以更精确地了解每个策略的交易区间，为入场时机选择提供重要参考！
