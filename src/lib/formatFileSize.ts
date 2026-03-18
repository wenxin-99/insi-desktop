/**
 * 格式化文件大小，将字节转换为人类可读的格式
 * @param bytes 文件大小（字节）
 * @returns 格式化后的文件大小字符串（如 "1.23 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0 || !isFinite(bytes)) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}
