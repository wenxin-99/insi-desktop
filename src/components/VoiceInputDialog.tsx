import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Square, Loader2 } from 'lucide-react';
import { VoiceWaveform } from './VoiceWaveform';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface VoiceInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranscribed: (text: string) => void;
  packageId?: number;
}

const SUPPORTED_LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
];

export function VoiceInputDialog({ open, onOpenChange, onTranscribed, packageId }: VoiceInputDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('zh');
  const [audioStream, setAudioStream] = useState<MediaStream>();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const transcribeAudioMutation = trpc.ai.transcribeVoiceInput.useMutation();

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // 停止并释放 stream（真正 stop tracks，不是 disable）
  const killStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setAudioStream(undefined);
  }, []);

  // 对话框关闭时清理
  useEffect(() => {
    if (!open) {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      killStream();
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [open, killStream]);

  // 组件卸载兜底
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecordingRef.current) {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // 空格键快捷键支持（使用 ref 避免闭包捕获过期 state）
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果是空格键且没有在输入框中
      if (e.code === 'Space' && !isRecordingRef.current && !isProcessingRef.current) {
        const target = e.target as HTMLElement;
        // 避免在输入框、按钮等元素中触发
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
          return;
        }
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecordingRef.current) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isProcessingRef.current) return;
    try {
      // ★ 核心修复：每次录音都请求全新的 getUserMedia stream
      // 不使用预热缓存 — Chrome 桌面端 track.enabled 从 false 切回 true 后
      // 底层音频管道可能不恢复，导致 MediaRecorder 录到的全是静音（~1KB）
      console.log('[VoiceInput] Requesting fresh getUserMedia stream...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        } 
      });
      streamRef.current = stream;

      // 验证 track 状态
      const track = stream.getAudioTracks()[0];
      console.log(`[VoiceInput] Got fresh stream, track: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);

      const recMimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
        'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType: recMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsProcessing(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
          
          console.log(`[VoiceInput] Recording stopped, blob size: ${audioBlob.size} bytes, chunks: ${audioChunksRef.current.length}`);

          // 停止 stream tracks（释放麦克风）
          killStream();

          if (audioBlob.size > 16 * 1024 * 1024) {
            toast.error('录音文件过大，请控制在16MB以内');
            setIsProcessing(false);
            return;
          }

          if (audioBlob.size < 2000) {
            toast.warning('录音时间太短，请长按说话');
            setIsProcessing(false);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            try {
              const result = await transcribeAudioMutation.mutateAsync({
                audioData: base64Audio,
                language: language,
                packageId,
              });

              setTranscript(result.text);
            } catch (error: any) {
              console.error('语音识别失败:', error);
              toast.error(error.message || '语音识别失败');
            } finally {
              setIsProcessing(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (error: any) {
          console.error('处理录音失败:', error);
          toast.error('处理录音失败');
          setIsProcessing(false);
          killStream();
        }
      };

      // timeslice=250ms 确保数据定期收集
      mediaRecorder.start(250);

      isRecordingRef.current = true;
      setAudioStream(stream);
      setIsRecording(true);
      console.log('[VoiceInput] Recording started');
    } catch (error: any) {
      console.error('启动录音失败:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('麦克风权限已被拒绝，请在浏览器设置中开启后刷新页面');
      } else {
        toast.error('无法访问麦克风，请检查权限设置');
      }
    }
  }, [language, packageId, transcribeAudioMutation, killStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, []);

  const handleConfirm = () => {
    if (transcript.trim()) {
      onTranscribed(transcript);
      handleClose();
    }
  };

  const handleClose = () => {
    if (isRecordingRef.current) {
      stopRecording();
    }
    setTranscript('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>语音输入</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 语言选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">识别语言</label>
            <Select value={language} onValueChange={setLanguage} disabled={isRecording || isProcessing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 录音控制区域 */}
          <div className="relative flex flex-col items-center justify-center py-8 bg-muted/30 rounded-lg">
            <VoiceWaveform isRecording={isRecording} audioStream={audioStream} />
            
            {isRecording ? (
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-16 h-16"
                onClick={stopRecording}
              >
                <Square className="w-6 h-6" />
              </Button>
            ) : isProcessing ? (
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full w-16 h-16"
                disabled
              >
                <Loader2 className="w-6 h-6 animate-spin" />
              </Button>
            ) : (
              <Button
                size="lg"
                variant="default"
                className="rounded-full w-16 h-16"
                onClick={startRecording}
              >
                <Mic className="w-6 h-6" />
              </Button>
            )}

            <p className="mt-4 text-sm text-muted-foreground">
              {isRecording ? '正在录音中... (松开空格键停止)' : isProcessing ? '正在识别...' : '点击开始录音或按住空格键'}
            </p>
          </div>

          {/* 识别结果预览 */}
          {transcript && (
            <div className="space-y-2">
              <label className="text-sm font-medium">识别结果</label>
              <div className="p-3 bg-muted rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{transcript}</p>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isRecording || isProcessing}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={!transcript || isRecording || isProcessing}>
              确认使用
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
