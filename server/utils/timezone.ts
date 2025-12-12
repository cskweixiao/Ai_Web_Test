/**
 * 时区处理工具
 * 解决数据库存储时间时区不一致问题
 * 
 * 问题说明：
 * - MySQL TIMESTAMP 字段存储的是 UTC 时间
 * - 当使用 new Date() 创建时间并存入数据库时，Prisma 会将本地时间转换为 UTC
 * - 但在某些情况下，时区处理不一致导致存储的时间比实际时间少8小时
 * 
 * 解决方案：
 * - 创建统一的时间获取函数，确保存储的时间是正确的中国时区时间
 */

/**
 * 获取当前的中国时区时间（UTC+8）
 * 用于数据库存储，确保时间正确
 */
export function getChinaTime(): Date {
  const now = new Date();
  // 获取当前 UTC 时间的毫秒数
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // 添加中国时区偏移（UTC+8 = 8小时 = 8 * 60 * 60 * 1000 毫秒）
  const chinaOffset = 8 * 60 * 60 * 1000;
  return new Date(utcTime + chinaOffset);
}

/**
 * 将 Date 对象转换为中国时区时间
 * @param date - 需要转换的日期
 */
export function toChinaTime(date: Date): Date {
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const chinaOffset = 8 * 60 * 60 * 1000;
  return new Date(utcTime + chinaOffset);
}

/**
 * 获取当前时间（用于数据库存储）
 * 
 * 问题分析：
 * - Prisma 在存储 DateTime 到 MySQL TIMESTAMP 字段时，会将时间转换为 UTC
 * - 但数据库读取时显示的是 UTC 时间，而不是本地时间
 * - 这导致显示的时间比实际时间少8小时
 * 
 * 解决方案：
 * - 在存储前手动添加8小时偏移
 * - 这样存储到数据库的时间经过 Prisma 转换后，显示的就是正确的中国时间
 */
export function getNow(): Date {
  const now = new Date();
  // 手动添加8小时偏移量来补偿 Prisma/MySQL 的 UTC 转换
  const chinaOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  return new Date(now.getTime() + chinaOffset);
}

/**
 * 格式化时间为本地时间字符串（YYYY-MM-DD HH:mm:ss）
 * @param date - 需要格式化的日期，默认为当前时间
 */
export function formatDateTime(date: Date = getNow()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化时间为本地时间字符串（带毫秒）
 * @param date - 需要格式化的日期，默认为当前时间
 */
export function formatDateTimeWithMs(date: Date = getNow()): string {
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${formatDateTime(date)}.${milliseconds}`;
}

export default {
  getChinaTime,
  toChinaTime,
  getNow,
  formatDateTime,
  formatDateTimeWithMs
};

