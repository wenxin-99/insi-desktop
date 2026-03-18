import { memo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect, useState } from "react";

export interface SendMessagePayload {
  text: string;
  attachments?: {
    images: Array<{ url: string; name: string; progress?: number }>;
    files: Array<{ url: string; name: string; size: number; progress?: number; error?: string; file?: File; id?: string }>;
  };
}

interface ChatInputProps {
  onSend: (payload: SendMessagePayload) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  onChange?: (value: string) => void; // 输入变化回调
  onFileUpload?: (files: Array<{ file: File; url: string; name: string; size: number; type: string }>) => void; // 文件上传回调（超长文本自动打包时使用）
  disabled?: boolean;
  placeholder?: string;
  defaultValue?: string; // 用于初始化输入框的值
  // 附件数组，由父组件管理
  uploadedImages?: Array<{ url: string; name: string; progress?: number }>;
  uploadedFiles?: Array<{ url: string; name: string; size: number; progress?: number; error?: string; file?: File; id?: string }>;
}

export interface ChatInputRef {
  focus: () => void;
  setInput: (value: string) => void;
  clear: () => void;
  getValue: () => string;
}

/**
 * 优化的聊天输入框组件
 * 
 * 使用内部状态管理输入值，避免父组件重渲染
 * 使用React.memo和useCallback优化性能
 */
export const ChatInput = memo(forwardRef<ChatInputRef, ChatInputProps>(
  ({ 
    onSend, 
    onPaste,
    onChange,
    onFileUpload,
    disabled, 
    placeholder = "输入您的问题...", 
    defaultValue = "",
    uploadedImages = [],
    uploadedFiles = []
  }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // 将输入状态内部化，避免父组件重渲染
    const [value, setValue] = useState(defaultValue);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
      setInput: (newValue: string) => {
        setValue(newValue);
        // ★ 通知父组件输入变化（语音识别、中间结果等外部写入时触发）
        onChange?.(newValue);
        // 延迟调整高度，确保值已更新
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          }
        }, 0);
      },
      clear: () => {
        setValue("");
        onChange?.("");
        if (textareaRef.current) {
          textareaRef.current.style.height = '36px';
        }
      },
      getValue: () => value
    }), [value, onChange]);

    // 自动调整高度
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      // 计算新高度（最小36px，最大约8行后滚动）
      const lineHeight = 24; // 大约一行的高度
      const padding = 16; // 上下padding总和
      const maxLines = 8;
      const maxHeight = lineHeight * maxLines + padding;
      
      // 保存当前高度
      const currentHeight = textarea.offsetHeight;
      
      // 临时重置高度以获取正确的scrollHeight
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      
      // 计算新高度
      const newHeight = Math.min(scrollHeight, maxHeight);
      
      // 只有当高度确实需要变化时才更新（阈值提高到5px）
      if (Math.abs(newHeight - currentHeight) > 5) {
        textarea.style.height = `${newHeight}px`;
      } else {
        // 恢复原高度
        textarea.style.height = `${currentHeight}px`;
      }
    }, []);

    // 当value变化时调整高度（使用防抖避免频繁调整）
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        adjustHeight();
      }, 50); // 增加防抖延迟到50ms
      return () => clearTimeout(timeoutId);
    }, [value, adjustHeight]);

    // 使用useCallback包裹事件处理函数，避免每次渲染都创建新函数
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      // 超过1500字符时自动打包成txt文件
      if (newValue.length > 1500) {
        const blob = new Blob([newValue], { type: 'text/plain' });
        const file = new File([blob], `文本内容_${Date.now()}.txt`, { type: 'text/plain' });
        // 通知父组件上传文件（不传 blob URL — 后端无法访问 blob: 协议）
        // 传 File 对象，让父组件通过 /api/upload 上传获取服务端 URL
        onFileUpload?.([{ file, url: '', name: file.name, size: file.size, type: 'text/plain' }]);
        // 清空输入框
        setValue('');
        onChange?.('');
        return;
      }
      
      setValue(newValue);
      // 通知父组件输入变化
      onChange?.(newValue);
      // 不立即调整高度，由useEffect的防抖处理
    }, [onChange, onFileUpload]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // ★ IME 输入法正在组合中（中文/日文选词）→ 不触发发送
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // 如果有文件/图片正在上传，阻止发送（不清空输入框）
        const hasUploadingItems = uploadedImages.some((img) => img.progress !== undefined) ||
          uploadedFiles.some((f) => f.progress !== undefined);
        if (hasUploadingItems) return;
        // 检查是否有内容或附件
        if (value.trim() || uploadedImages.length > 0 || uploadedFiles.length > 0) {
          // 1. 先传递数据给父组件
          onSend({
            text: value,
            attachments: {
              images: uploadedImages,
              files: uploadedFiles
            }
          });
          // 2. 然后清空本地输入状态
          setValue("");
          // 重置高度
          if (textareaRef.current) {
            textareaRef.current.style.height = '36px';
            // 移动端：收起键盘
            textareaRef.current.blur();
          }
        }
      }
    }, [onSend, value, uploadedImages, uploadedFiles]);

    // 移动端优化：输入框获得焦点时，利用 visualViewport 确保可见
    // ★ 不再使用 setTimeout + scrollIntoView（会与流式自动滚动打架）
    const handleFocus = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const vv = window.visualViewport;
      if (!vv) return; // 不支持则不做额外处理，浏览器默认行为即可

      // 等待键盘完全弹出后检查可见性
      const checkVisibility = () => {
        const rect = textarea.getBoundingClientRect();
        const viewportBottom = vv.offsetTop + vv.height;
        // 如果输入框底部超出了视觉视口，说明被键盘遮挡
        if (rect.bottom > viewportBottom) {
          // 找到最近的滚动容器，向上滚动刚好露出输入框的距离
          const scrollParent = textarea.closest('[class*="overflow-y"]') || textarea.parentElement;
          if (scrollParent) {
            const overshoot = rect.bottom - viewportBottom + 12; // 12px 余量
            scrollParent.scrollTop += overshoot;
          }
        }
      };

      // visualViewport resize 事件会在键盘弹出时触发
      const onceResize = () => {
        vv.removeEventListener('resize', onceResize);
        // 再等一帧让布局稳定
        requestAnimationFrame(checkVisibility);
      };
      vv.addEventListener('resize', onceResize);

      // 安全回退：500ms 后如果 resize 没触发，也检查一次然后清理
      const fallbackTimer = setTimeout(() => {
        vv.removeEventListener('resize', onceResize);
        checkVisibility();
      }, 500);

      // 清理 fallback
      const cleanup = () => { clearTimeout(fallbackTimer); };
      vv.addEventListener('resize', cleanup, { once: true });
    }, []);

    return (
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onPaste={onPaste}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        disabled={disabled}
        className="w-full min-h-[36px] resize-none bg-transparent border-none outline-none text-base md:text-base placeholder:text-muted-foreground py-1.5 overflow-y-auto leading-relaxed"
        rows={1}
        style={{ height: '36px', maxHeight: '136px', fontSize: 'max(16px, 1rem)' }}
        enterKeyHint="send"
      />
    );
  }
));

ChatInput.displayName = "ChatInput";
