# 日线ATR功能实现说明

## 功能概述

本次更新为单策略和多策略（批量策略）添加了日线ATR数据支持，用户可以选择使用4小时ATR或日线ATR来计算杠杆倍数。默认使用4小时ATR，日线ATR提供更保守的杠杆计算选项。

## 主要变更

### 1. 类型定义更新

#### `src/types/strategy.ts`
- `StrategyInput` 接口新增：
  - `atr1d?: number` - 日线ATR
  - `atr1dMax?: number` - 日线ATR最大值
  - `leverageAtrType?: '4h' | '1d'` - 杠杆计算使用的ATR类型

- `StrategyOutput` 接口新增：
  - `atr1d?: number` - 日线ATR
  - `atr1dMax?: number` - 日线ATR最大值
  - `leverageAtrType?: '4h' | '1d'` - 杠杆计算使用的ATR类型

### 2. 数据服务更新

#### `src/services/contractDataService.ts`
- `ATRData` 接口新增日线ATR字段：
  - `atr1d: number`
  - `atr1d_max: number`
  - 分析数据和交易所信息中新增 `'1d'` 支持

#### `src/services/marketDataService.ts` 和 `src/services/mockMarketDataService.ts`
- 获取日线OHLCV数据：`exchange.fetchOHLCV(symbol, '1d', undefined, 30)`
- 计算日线ATR：`atr1d: this.calculateATR(convert(ohlcv1d), 14)`

### 3. 策略引擎更新

#### `src/utils/strategyEngine.ts`
- `calculateLeverage()` 方法重构：
  - 支持用户选择ATR类型（4h或1d）
  - 根据选择的类型使用相应的ATR和ATR最大值
  - 默认使用4小时ATR，保持向后兼容

```typescript
calculateLeverage(input: StrategyInput): number {
  const leverageAtrType = input.leverageAtrType || '4h';
  
  let atr: number;
  let atrMax: number | undefined;
  
  if (leverageAtrType === '1d' && input.atr1d) {
    atr = input.atr1d;
    atrMax = input.atr1dMax;
  } else {
    atr = input.atr4h;
    atrMax = input.atr4hMax;
  }
  
  const atrForCalculation = atrMax && atrMax > atr ? atrMax : atr;
  return Math.floor(input.currentPrice / atrForCalculation);
}
```

### 4. 用户界面更新

#### `src/components/StrategyForm.tsx`
- 新增日线ATR输入字段，支持自动获取和显示
- 高级选项中新增"杠杆计算ATR类型"选择器：
  - 4小时ATR（默认）
  - 日线ATR（保守）
- 自动填充逻辑包含日线ATR数据

#### `src/components/BatchStrategyForm.tsx`
- 批量策略支持日线ATR数据
- 默认使用4小时ATR保持兼容性

#### `src/components/StrategyResult.tsx`
- 杠杆计算说明更新，显示使用的ATR类型
- 动态显示计算公式和使用的ATR类型标签

#### `src/components/BatchStrategyResult.tsx`
- 批量结果表格中杠杆显示包含ATR类型信息
- 使用日线ATR时显示 "(1d)" 标识

### 5. 后端API更新

#### `backend-example/main.py`
- `/api/contracts/{symbol}/atr` 接口新增日线数据获取：
  - 获取日线OHLCV数据：`ohlcv_1d, exchange_1d`
  - 计算日线ATR分析：`atr_1d_analysis`
  - 返回数据包含 `atr1d` 和 `atr1d_max` 字段

## 用户体验

### 单策略模式
1. 用户在策略表单中可以看到新的"日线ATR"字段
2. 在高级选项中可以选择杠杆计算使用的ATR类型
3. 策略结果会显示使用的ATR类型和相应的计算公式

### 批量策略模式
1. 自动获取所有币种的日线ATR数据
2. 默认使用4小时ATR保持兼容性
3. 结果表格中显示杠杆计算使用的ATR类型

## 技术特点

1. **向后兼容**: 默认使用4小时ATR，现有功能不受影响
2. **用户选择**: 提供灵活的ATR类型选择，满足不同交易风格
3. **保守选项**: 日线ATR提供更保守的杠杆计算，适合长期持仓
4. **完整支持**: 单策略和批量策略都支持新功能
5. **清晰显示**: 界面清楚显示使用的ATR类型和计算过程

## 使用建议

- **4小时ATR**: 适合短期交易，杠杆相对较高
- **日线ATR**: 适合长期持仓，杠杆更保守，风险更低
- **新手用户**: 建议使用日线ATR获得更保守的杠杆建议
- **经验用户**: 可根据交易策略和风险偏好选择合适的ATR类型

## 测试验证

创建了 `test_daily_atr.js` 测试脚本验证：
- 日线ATR杠杆计算正确性
- 4小时ATR杠杆计算兼容性
- 不同ATR类型的切换功能

## 批量策略增强功能

### 新增功能
1. **每个币种独立选择ATR类型**：
   - 表格中每个币种都有ATR类型选择下拉框
   - 支持4小时ATR和日线ATR两种选择
   - 默认使用4小时ATR保持兼容性

2. **批量设置功能**：
   - 在配置选项中提供批量ATR类型设置
   - 一键为所有币种设置相同的ATR类型
   - 避免逐个修改的繁琐操作

3. **智能结果显示**：
   - 杠杆标签显示ATR类型标识（1d标记）
   - 鼠标悬停显示详细计算公式
   - 清楚标识使用的ATR类型

### 用户体验优化
- 解析数据后自动显示ATR类型选择列
- 处理过程中禁用选择器防止误操作
- 格式说明包含ATR类型选择的详细说明
- 批量设置实时更新所有币种选择

## 部署注意事项

1. 确保后端API支持日线数据获取
2. 前端缓存策略需要包含日线ATR数据
3. 现有用户数据迁移时默认使用4小时ATR
4. 监控日线数据获取的性能影响
5. 批量策略表格列宽度适配新增的ATR类型选择列
