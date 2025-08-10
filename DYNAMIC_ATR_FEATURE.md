# 动态ATR类型选择功能

## 功能概述

现在用户可以在策略生成后动态切换ATR类型，实时重新计算杠杆倍数，无需重新生成策略。这大大提升了用户体验和操作灵活性。

## 主要功能

### 1. 单策略动态ATR选择
- ✅ 在策略结果页面的杠杆显示区域添加ATR类型选择器
- ✅ 支持4小时ATR和日线ATR两种选择
- ✅ 实时重新计算并显示杠杆倍数
- ✅ 鼠标悬停显示详细计算公式和使用的ATR类型

### 2. 批量策略动态ATR选择
- ✅ 每个策略都有独立的ATR类型选择下拉框
- ✅ 批量设置功能：一键为所有策略设置相同的ATR类型
- ✅ 实时重新计算所有策略的杠杆倍数
- ✅ 表格排序功能支持动态杠杆值

### 3. 智能计算逻辑
- ✅ 动态杠杆计算：`Math.floor(当前价格 / 选择的ATR最大值)`
- ✅ 数据验证：如果日线ATR数据不可用，自动回退到4小时ATR
- ✅ 实时更新：ATR类型切换后立即重新计算杠杆

## 用户界面改进

### 单策略页面
```
推荐杠杆
┌─────────────────────┐
│ [4小时ATR ▼]        │  <- ATR类型选择器
│                     │
│    🔺 25倍          │  <- 动态杠杆显示
│                     │
└─────────────────────┘
```

### 批量策略页面
```
批量设置杠杆ATR类型： [选择ATR类型 ▼] 一键为所有策略设置相同的ATR类型

┌──────────┬─────────────────────┬──────────┐
│ 币种     │ 建议杠杆            │ 入场价格 │
├──────────┼─────────────────────┼──────────┤
│ BTC      │ [4小时ATR ▼]        │ 95000    │
│          │    🏷️ 25x           │          │
├──────────┼─────────────────────┼──────────┤
│ ETH      │ [日线ATR（保守）▼]  │ 3500     │
│          │    🏷️ 15x (1d)      │          │
└──────────┴─────────────────────┴──────────┘
```

## 技术实现

### 1. 状态管理
```typescript
// 单策略
const [selectedAtrType, setSelectedAtrType] = useState<'4h' | '1d'>(strategy.leverageAtrType || '4h');

// 批量策略
const [atrTypeSelections, setAtrTypeSelections] = useState<Record<string, '4h' | '1d'>>(() => {
  const initialSelections: Record<string, '4h' | '1d'> = {};
  strategies.forEach(strategy => {
    if (strategy.symbol) {
      initialSelections[strategy.symbol] = strategy.leverageAtrType || '4h';
    }
  });
  return initialSelections;
});
```

### 2. 动态杠杆计算
```typescript
const calculateDynamicLeverage = (atrType: '4h' | '1d'): number => {
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
    return Math.floor(currentPrice / atrForCalculation);
  }
  
  return strategy.basic?.recommendedLeverage || 0;
};
```

### 3. 批量设置功能
```typescript
const updateAllAtrTypes = (atrType: '4h' | '1d') => {
  const newSelections: Record<string, '4h' | '1d'> = {};
  strategies.forEach(strategy => {
    if (strategy.symbol) {
      newSelections[strategy.symbol] = atrType;
    }
  });
  setAtrTypeSelections(newSelections);
};
```

## 用户体验优势

### 1. 实时性
- ✅ 无需重新生成策略
- ✅ 切换ATR类型后立即看到杠杆变化
- ✅ 所有计算都在前端实时完成

### 2. 灵活性
- ✅ 每个策略可以独立选择ATR类型
- ✅ 批量设置功能提高操作效率
- ✅ 支持混合使用不同ATR类型

### 3. 透明性
- ✅ 详细的计算公式显示
- ✅ 清楚标识使用的ATR类型
- ✅ 鼠标悬停显示完整计算过程

## 测试场景

### 场景1：单策略ATR切换
1. 生成一个BTC策略（默认4小时ATR）
2. 记录初始杠杆倍数
3. 切换到日线ATR
4. 观察杠杆倍数变化（应该更低）
5. 切换回4小时ATR
6. 验证杠杆倍数恢复到初始值

### 场景2：批量策略混合ATR
1. 生成多个币种的批量策略
2. 为不同币种选择不同的ATR类型
3. 观察杠杆倍数的差异
4. 使用批量设置功能统一设置为日线ATR
5. 观察所有杠杆倍数都变得更保守

### 场景3：数据验证
1. 选择一个没有日线ATR数据的币种
2. 尝试切换到日线ATR
3. 验证系统自动回退到4小时ATR
4. 检查是否有适当的提示信息

## 预期效果

### 杠杆差异示例
假设BTC当前价格100000，4小时ATR最大值2500，日线ATR最大值6000：

- **4小时ATR杠杆**：Math.floor(100000 / 2500) = 40倍
- **日线ATR杠杆**：Math.floor(100000 / 6000) = 16倍

用户可以根据自己的风险偏好和交易周期选择合适的ATR类型。

## 向后兼容性

- ✅ 现有策略默认使用原来选择的ATR类型
- ✅ 如果没有指定ATR类型，默认使用4小时ATR
- ✅ 所有原有功能保持不变
- ✅ 新功能为可选增强功能
