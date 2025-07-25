// 测试时间修复的脚本
// 可以在浏览器控制台中运行

console.log('🕐 测试时间格式化修复');

// 模拟不同的时间格式
const testDates = [
    // 当前时间（应该显示"刚刚"）
    new Date().toISOString(),
    
    // 5分钟前
    new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    
    // 1小时前
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    
    // SQLite格式（YYYY-MM-DD HH:mm:ss）
    new Date().toISOString().replace('T', ' ').substring(0, 19),
    
    // 5分钟前的SQLite格式
    new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
    
    // 无效日期
    'invalid-date',
    
    // 未来时间（测试时区问题检测）
    new Date(Date.now() + 60 * 60 * 1000).toISOString()
];

// formatDistanceToNow 函数（从修复后的代码复制）
function formatDistanceToNow(date) {
  const now = new Date();
  let targetDate;
  
  if (typeof date === 'string') {
    // 处理不同的日期字符串格式
    if (date.includes('T') && !date.endsWith('Z')) {
      // 如果是ISO格式但没有时区标识，假设是本地时间
      targetDate = new Date(date);
    } else if (date.includes(' ') && !date.includes('T')) {
      // 如果是 "YYYY-MM-DD HH:mm:ss" 格式，假设是本地时间
      targetDate = new Date(date.replace(' ', 'T'));
    } else {
      // 其他格式直接解析
      targetDate = new Date(date);
    }
  } else {
    targetDate = date;
  }
  
  // 检查日期是否有效
  if (isNaN(targetDate.getTime())) {
    console.warn('Invalid date provided to formatDistanceToNow:', date);
    return '时间未知';
  }
  
  const diffInMs = now.getTime() - targetDate.getTime();
  
  // 如果时间差为负数（未来时间），可能是时区问题
  if (diffInMs < 0) {
    console.warn('Future date detected, possible timezone issue:', {
      now: now.toISOString(),
      target: targetDate.toISOString(),
      original: date
    });
    return '刚刚';
  }
  
  // 转换为秒、分钟、小时、天
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInSeconds < 60) {
    return '刚刚';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  } else if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  } else if (diffInDays < 30) {
    return `${diffInDays}天前`;
  } else if (diffInMonths < 12) {
    return `${diffInMonths}个月前`;
  } else {
    return `${diffInYears}年前`;
  }
}

// 测试所有日期格式
console.log('\n📊 测试结果:');
testDates.forEach((date, index) => {
    const result = formatDistanceToNow(date);
    console.log(`${index + 1}. 输入: ${date}`);
    console.log(`   输出: ${result}`);
    console.log(`   原始Date: ${new Date(typeof date === 'string' && date.includes(' ') && !date.includes('T') ? date.replace(' ', 'T') : date)}`);
    console.log('');
});

console.log('✅ 时间格式化测试完成');
console.log('💡 在订阅管理页面刷新，查看时间是否正确显示');
