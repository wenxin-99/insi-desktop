import { FileText, FileSpreadsheet, File, FileType } from 'lucide-react';

/**
 * 根据文件名获取对应的图标组件和颜色
 * @param fileName 文件名
 * @returns 包含图标组件和颜色类名的对象
 */
export function getFileIcon(fileName: string): {
  Icon: typeof File;
  colorClass: string;
  bgClass: string;
} {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return {
        Icon: FileText,
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50'
      };
    
    case 'doc':
    case 'docx':
      return {
        Icon: FileText,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50'
      };
    
    case 'xls':
    case 'xlsx':
      return {
        Icon: FileSpreadsheet,
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50'
      };
    
    case 'ppt':
    case 'pptx':
      return {
        Icon: FileType,
        colorClass: 'text-orange-600',
        bgClass: 'bg-orange-50'
      };
    
    case 'txt':
      return {
        Icon: FileText,
        colorClass: 'text-gray-600',
        bgClass: 'bg-gray-50'
      };
    
    default:
      return {
        Icon: File,
        colorClass: 'text-gray-500',
        bgClass: 'bg-gray-50'
      };
  }
}

/**
 * 获取文件类型的显示名称
 * @param fileName 文件名
 * @returns 文件类型的显示名称
 */
export function getFileTypeName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toUpperCase() || '';
  return extension || 'FILE';
}
