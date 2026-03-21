import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';

/**
 * 消息内容构建 Hook
 * - _buildMessageContent
 */
export function useMessageBuilder(state: ChatStateReturn) {
  const { uploadedImages, uploadedFiles ,
    nextMsgId
  } = state as any;

  const _buildMessageContent = (
    textToSend: string, enhancedMessage: string,
    effectiveImages: any[], effectiveFiles: any[],
    shouldIgnoreUploadedImages: boolean, hasImageGenerationIntent: boolean, hasImageEditIntent: boolean
  ) => {
    let messageContent: any;

    if ((effectiveImages.length > 0 && !shouldIgnoreUploadedImages) || effectiveFiles.length > 0) {
      const contentParts: any[] = [];
      if (enhancedMessage.trim()) contentParts.push({ type: 'text', text: enhancedMessage });
      if (!shouldIgnoreUploadedImages) {
        effectiveImages.forEach((img: any) => contentParts.push({ type: 'image_url', image_url: { url: img.url } }));
      }
      if (effectiveFiles.length > 0) {
        effectiveFiles.forEach((file: any) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          // 完整的 MIME 类型映射表
          const mimeMap: Record<string, string> = {
            // 文档
            pdf: 'application/pdf',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            doc: 'application/msword',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            xls: 'application/vnd.ms-excel',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ppt: 'application/vnd.ms-powerpoint',
            rtf: 'application/rtf',
            odt: 'application/vnd.oasis.opendocument.text',
            ods: 'application/vnd.oasis.opendocument.spreadsheet',
            odp: 'application/vnd.oasis.opendocument.presentation',
            // 文本/标记
            txt: 'text/plain',
            md: 'text/markdown',
            csv: 'text/csv',
            tsv: 'text/tab-separated-values',
            json: 'application/json',
            xml: 'application/xml',
            html: 'text/html',
            htm: 'text/html',
            css: 'text/css',
            svg: 'image/svg+xml',
            yaml: 'text/yaml',
            yml: 'text/yaml',
            toml: 'text/plain',
            ini: 'text/plain',
            cfg: 'text/plain',
            conf: 'text/plain',
            env: 'text/plain',
            log: 'text/plain',
            // 代码
            js: 'text/javascript',
            jsx: 'text/javascript',
            ts: 'text/typescript',
            tsx: 'text/typescript',
            py: 'text/x-python',
            java: 'text/x-java',
            c: 'text/x-c',
            cpp: 'text/x-c++',
            h: 'text/x-c',
            hpp: 'text/x-c++',
            cs: 'text/x-csharp',
            go: 'text/x-go',
            rs: 'text/x-rust',
            rb: 'text/x-ruby',
            php: 'text/x-php',
            sh: 'text/x-shellscript',
            bash: 'text/x-shellscript',
            zsh: 'text/x-shellscript',
            sql: 'text/x-sql',
            swift: 'text/x-swift',
            kt: 'text/x-kotlin',
            scala: 'text/x-scala',
            r: 'text/x-r',
            lua: 'text/x-lua',
            perl: 'text/x-perl',
            pl: 'text/x-perl',
            dart: 'text/x-dart',
            vue: 'text/plain',
            svelte: 'text/plain',
            graphql: 'text/plain',
            gql: 'text/plain',
            proto: 'text/plain',
            dockerfile: 'text/plain',
            makefile: 'text/plain',
            cmake: 'text/plain',
            gradle: 'text/plain',
            // 压缩包
            zip: 'application/zip',
            gz: 'application/gzip',
            tgz: 'application/gzip',
            tar: 'application/x-tar',
            rar: 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            bz2: 'application/x-bzip2',
            xz: 'application/x-xz',
            // 视频
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            webm: 'video/webm',
            mkv: 'video/x-matroska',
            flv: 'video/x-flv',
            wmv: 'video/x-ms-wmv',
          };
          const mimeType = mimeMap[ext] || 'application/octet-stream';
          if (file.url) contentParts.push({ type: 'file_url', file_url: { url: file.url, mime_type: mimeType, filename: file.name } });
        });
      }
      messageContent = contentParts;
    } else {
      messageContent = enhancedMessage;
    }

    let displayContent = textToSend.trim();
    if (effectiveFiles.length > 0 && !displayContent) displayContent = '';
    if (!displayContent && uploadedImages.length > 0) displayContent = '[图片]';

    const sentAt = Date.now();
    const userMessageForDisplay = {
      id: nextMsgId(),
      role: 'user' as const,
      content: displayContent,
      images: effectiveImages.length > 0 ? effectiveImages : undefined,
      files: effectiveFiles.length > 0 ? effectiveFiles : undefined,
      timestamp: sentAt,
      sentAt,
    };
    const userMessageForAPI = {
      role: 'user' as const,
      content: messageContent,
      ...(enhancedMessage !== textToSend.trim() ? { _displayContent: displayContent } : {}),
    } as any;

    return { messageContent, userMessageForDisplay, userMessageForAPI, displayContent };
  };

  // ═══════════ 内部方法：SSE 流式回调 ═══════════


  return { _buildMessageContent };
}
