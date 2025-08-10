// 测试日线ATR功能的简单脚本
const { StrategyEngine } = require('./src/utils/strategyEngine.ts');

// 模拟测试数据
const testInput = {
  symbol: 'BTC',
  type: '兜底区',
  schellingPoint: 50000,
  currentPrice: 52000,
  atr4h: 1000,
  atr15m: 300,
  atr1d: 2500,  // 日线ATR
  atr4hMax: 1200,
  atr15mMax: 350,
  atr1dMax: 3000,  // 日线ATR最大值
  leverageAtrType: '1d',  // 使用日线ATR计算杠杆
  operationCycle: '1分钟'
};

console.log('测试日线ATR功能');
console.log('输入数据:', testInput);

const strategyEngine = new StrategyEngine();
const result = strategyEngine.generateStrategy(testInput);

if (result.strategy) {
  console.log('\n策略生成成功:');
  console.log('推荐杠杆:', result.strategy.basic.recommendedLeverage);
  console.log('杠杆计算ATR类型:', result.strategy.leverageAtrType);
  console.log('使用的ATR值:', testInput.leverageAtrType === '1d' ? testInput.atr1dMax : testInput.atr4hMax);
  
  // 验证杠杆计算
  const expectedLeverage = Math.floor(testInput.currentPrice / testInput.atr1dMax);
  console.log('预期杠杆:', expectedLeverage);
  console.log('实际杠杆:', result.strategy.basic.recommendedLeverage);
  console.log('计算正确:', expectedLeverage === result.strategy.basic.recommendedLeverage ? '✓' : '✗');
} else {
  console.log('策略生成失败:', result.errors);
}

// 测试4h ATR
const testInput4h = {
  ...testInput,
  leverageAtrType: '4h'
};

console.log('\n\n测试4小时ATR功能');
const result4h = strategyEngine.generateStrategy(testInput4h);

if (result4h.strategy) {
  console.log('推荐杠杆:', result4h.strategy.basic.recommendedLeverage);
  console.log('杠杆计算ATR类型:', result4h.strategy.leverageAtrType);
  
  // 验证杠杆计算
  const expectedLeverage4h = Math.floor(testInput.currentPrice / testInput.atr4hMax);
  console.log('预期杠杆:', expectedLeverage4h);
  console.log('实际杠杆:', result4h.strategy.basic.recommendedLeverage);
  console.log('计算正确:', expectedLeverage4h === result4h.strategy.basic.recommendedLeverage ? '✓' : '✗');
}
