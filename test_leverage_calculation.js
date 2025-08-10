// 测试杠杆计算的简单脚本
// 在浏览器控制台中运行

// 模拟策略输入数据
const testInput4h = {
  symbol: 'BTC',
  type: '兜底区',
  schellingPoint: 95000,
  currentPrice: 100000,
  atr4h: 2000,
  atr15m: 500,
  atr1d: 5000,
  atr4hMax: 2500,
  atr15mMax: 600,
  atr1dMax: 6000,
  leverageAtrType: '4h',
  operationCycle: '1分钟'
};

const testInput1d = {
  ...testInput4h,
  leverageAtrType: '1d'
};

console.log('=== 杠杆计算测试 ===');
console.log('测试数据:', {
  currentPrice: testInput4h.currentPrice,
  atr4h: testInput4h.atr4h,
  atr4hMax: testInput4h.atr4hMax,
  atr1d: testInput4h.atr1d,
  atr1dMax: testInput4h.atr1dMax
});

// 手动计算预期结果
const expected4h = Math.floor(testInput4h.currentPrice / testInput4h.atr4hMax);
const expected1d = Math.floor(testInput1d.currentPrice / testInput1d.atr1dMax);

console.log('预期杠杆计算:');
console.log('4h ATR:', `${testInput4h.currentPrice} / ${testInput4h.atr4hMax} = ${expected4h}`);
console.log('1d ATR:', `${testInput1d.currentPrice} / ${testInput1d.atr1dMax} = ${expected1d}`);

// 如果在浏览器环境中，可以测试实际的策略引擎
if (typeof window !== 'undefined' && window.strategyEngine) {
  console.log('\n=== 实际策略引擎测试 ===');
  
  const result4h = window.strategyEngine.generateStrategy(testInput4h);
  const result1d = window.strategyEngine.generateStrategy(testInput1d);
  
  console.log('4h ATR 结果:', result4h.strategy?.basic?.recommendedLeverage);
  console.log('1d ATR 结果:', result1d.strategy?.basic?.recommendedLeverage);
  
  console.log('计算正确性:');
  console.log('4h ATR:', expected4h === result4h.strategy?.basic?.recommendedLeverage ? '✓' : '✗');
  console.log('1d ATR:', expected1d === result1d.strategy?.basic?.recommendedLeverage ? '✓' : '✗');
} else {
  console.log('请在浏览器控制台中运行此脚本');
}
