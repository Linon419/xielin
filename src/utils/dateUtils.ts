/**
 * 日期时间工具函数
 */

/**
 * 格式化相对时间
 * @param date 日期字符串或Date对象
 * @returns 相对时间字符串
 */
export function formatDistanceToNow(date: string | Date): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffInMs = now.getTime() - targetDate.getTime();
  
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

/**
 * 格式化日期为可读格式
 * @param date 日期字符串或Date对象
 * @returns 格式化的日期字符串
 */
export function formatDate(date: string | Date): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const hours = String(targetDate.getHours()).padStart(2, '0');
  const minutes = String(targetDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化日期为简短格式
 * @param date 日期字符串或Date对象
 * @returns 简短的日期字符串
 */
export function formatShortDate(date: string | Date): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // 如果是今天，只显示时间
  if (targetDate.toDateString() === now.toDateString()) {
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    return `今天 ${hours}:${minutes}`;
  }
  
  // 如果是昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (targetDate.toDateString() === yesterday.toDateString()) {
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    return `昨天 ${hours}:${minutes}`;
  }
  
  // 如果是今年，不显示年份
  if (targetDate.getFullYear() === now.getFullYear()) {
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }
  
  // 完整日期
  return formatDate(date);
}
