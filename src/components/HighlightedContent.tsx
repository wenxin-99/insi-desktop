import { useMemo, useRef } from 'react';
import { SafeMarkdownWithDownload } from './SafeMarkdownWithDownload';
import { CitationOverlay, citationStyles } from './CitationOverlay';

/**
 * 关键信息高亮组件
 * 自动识别并高亮AI回复中的关键信息（物体、场景、文字等）
 * 使用Safe Markdown渲染，避免XSS风险
 */

interface HighlightedContentProps {
  content: string;
  hasImages?: boolean;
  /** v2: 版本历史追踪 */
  conversationId?: string | number;
  messageIndex?: number;
  /** v3: 文件包下载 */
  filePackageUrl?: string;
  /** ★ 统一渲染：流式输出时跳过 Prism 高亮，用轻量高亮 */
  streaming?: boolean;
  /** ★ 联网搜索来源（用于内联引用角标） */
  webSearchSources?: Array<{ title: string; url: string }>;
}

// 定义关键词类别和对应的样式
const KEYWORD_CATEGORIES = {
  // 物体识别关键词
  objects: {
    keywords: [
      '人物', '男性', '女性', '儿童', '老人', '动物', '猫', '狗', '鸟',
      '建筑', '房屋', '桥梁', '塔', '车辆', '汽车', '自行车', '飞机',
      '植物', '树木', '花朵', '草地', '食物', '水果', '蔬菜'
    ],
    marker: '🔵',
    className: 'keyword-object'
  },
  // 场景描述关键词
  scenes: {
    keywords: [
      '室内', '室外', '街道', '公园', '海滩', '山脉', '森林', '城市', '乡村',
      '白天', '夜晚', '黄昏', '清晨', '晴天', '阴天', '雨天', '雪天'
    ],
    marker: '🟢',
    className: 'keyword-scene'
  },
  // 颜色关键词
  colors: {
    keywords: [
      '红色', '蓝色', '绿色', '黄色', '黑色', '白色', '灰色', '紫色', '橙色', '粉色'
    ],
    marker: '🟣',
    className: 'keyword-color'
  },
  // 情感/氛围关键词
  emotions: {
    keywords: [
      '快乐', '悲伤', '愤怒', '平静', '紧张', '轻松', '温馨', '冷清', '热闹'
    ],
    marker: '🟡',
    className: 'keyword-emotion'
  },
  // 文字识别关键词
  text: {
    keywords: [
      '文字', '文本', '标题', '标签', '标识', '数字', '字母', '符号'
    ],
    marker: '🔴',
    className: 'keyword-text'
  }
};

export function HighlightedContent({ content, hasImages = false, conversationId, messageIndex, filePackageUrl, streaming, webSearchSources }: HighlightedContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasCitations = !streaming && webSearchSources && webSearchSources.length > 0;

  // 只对包含图片的消息进行高亮处理
  const processedContent = useMemo(() => {
    if (!hasImages || !content) {
      return content;
    }

    // 构建所有关键词的映射
    const keywordMap = new Map<string, { marker: string; className: string }>();
    
    Object.values(KEYWORD_CATEGORIES).forEach(config => {
      config.keywords.forEach(keyword => {
        keywordMap.set(keyword, { 
          marker: config.marker, 
          className: config.className 
        });
      });
    });

    // 按关键词长度降序排序，优先匹配长关键词
    const sortedKeywords = Array.from(keywordMap.keys()).sort((a, b) => b.length - a.length);

    let result = content;
    const replacements = new Map<string, string>();

    // 查找所有匹配的关键词并标记
    sortedKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = result.match(regex);
      
      if (matches) {
        const config = keywordMap.get(keyword)!;
        // 使用特殊标记包裹关键词，稍后通过CSS高亮
        const replacement = `**${keyword}**`;
        replacements.set(keyword, replacement);
      }
    });

    // 应用替换
    replacements.forEach((replacement, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      result = result.replace(regex, replacement);
    });

    return result;
  }, [content, hasImages]);

  return (
    <div className="highlighted-content-wrapper" ref={contentRef}>
      <SafeMarkdownWithDownload content={processedContent} conversationId={conversationId} messageIndex={messageIndex} filePackageUrl={filePackageUrl} streaming={streaming} />
      {hasCitations && <CitationOverlay containerRef={contentRef} sources={webSearchSources!} />}
      {hasCitations && <style>{citationStyles}</style>}
      {hasImages && (
        <style>{`
          .highlighted-content-wrapper strong {
            background: linear-gradient(120deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.25) 100%);
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 600;
            color: rgb(37, 99, 235);
          }
          .dark .highlighted-content-wrapper strong {
            background: linear-gradient(120deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.3) 100%);
            color: rgb(147, 197, 253);
          }
        `}</style>
      )}
    </div>
  );
}
