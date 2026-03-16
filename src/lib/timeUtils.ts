/**
 * 将时间戳转换为绝对时间字符串
 * @param timestamp Unix时间戳（毫秒）
 * @returns 绝对时间字符串，如“26-01-27 下午 10:28”
 */
export function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString().slice(-2); // 取后两位
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? '下午' : '上午';
  const displayHours = hours % 12 || 12; // 12小时制
  
  return `${year}-${month}-${day} ${period} ${displayHours}:${minutes}`;
}

/**
 * 将时间戳转换为相对时间字符串
 * @param timestamp Unix时间戳（毫秒）
 * @returns 相对时间字符串，如“刚刚”、“5分钟前”、“2小时前”等
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  // 小于1分钟
  if (diff < 60 * 1000) {
    return "刚刚";
  }
  
  // 小于1小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }
  
  // 小于24小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }
  
  // 小于7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }
  
  // 超过7天，显示具体日期
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}


/**
 * 判断时间戳是否是今天
 * @param timestamp Unix时间戳（毫秒）
 * @returns 是否是今天
 */
function isToday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

/**
 * 判断时间戳是否是昨天
 * @param timestamp Unix时间戳（毫秒）
 * @returns 是否是昨天
 */
function isYesterday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
}

/**
 * 智能格式化时间显示
 * - 今天的消息：只显示时间（如"上午 9:46"）
 * - 昨天的消息：显示"昨天 上午 9:46"
 * - 更早的消息：显示完整日期（如"26-02-01 上午 9:46"）
 * @param timestamp Unix时间戳（毫秒）
 * @returns 格式化的时间字符串
 */
export function formatSmartTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? '下午' : '上午';
  const displayHours = hours % 12 || 12; // 12小时制
  const timeStr = `${period} ${displayHours}:${minutes}`;
  
  if (isToday(timestamp)) {
    // 今天：只显示时间
    return timeStr;
  } else if (isYesterday(timestamp)) {
    // 昨天：显示"昨天 + 时间"
    return `昨天 ${timeStr}`;
  } else {
    // 更早：显示完整日期
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${timeStr}`;
  }
}
