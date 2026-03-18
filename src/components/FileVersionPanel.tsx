/**
 * FileVersionPanel.tsx
 *
 * 文件版本历史面板 — 时间线 + 预览 + 回滚 + 下载
 */

import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, Download, Check, Clock, Eye, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { fileVersionStore, type FileVersion } from '@/lib/fileVersionStore';

interface FileVersionPanelProps {
  convId: string | number;
  filePath: string;
  onClose: () => void;
}

export function FileVersionPanel({ convId, filePath, onClose }: FileVersionPanelProps) {
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const snap = useSyncExternalStore(fileVersionStore.subscribe, fileVersionStore.getSnapshot);

  const versions = useMemo(() => {
    return fileVersionStore.getFileHistory(convId, filePath)?.versions ?? [];
  }, [snap, convId, filePath]);

  const previewCode = previewVersion !== null
    ? fileVersionStore.getVersionCode(convId, filePath, previewVersion) : null;

  const handleRollback = useCallback((tv: number) => {
    const nv = fileVersionStore.rollbackTo(convId, filePath, tv);
    if (nv) { toast.success(`已回滚到 v${tv}，生成 v${nv}`); setPreviewVersion(null); }
    else toast.error('回滚失败');
  }, [convId, filePath]);

  const handleDownload = useCallback((v: FileVersion) => {
    const blob = new Blob([v.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${filePath.split('/').pop() || 'file'}.v${v.version}`;
    a.click(); URL.revokeObjectURL(url);
  }, [filePath]);

  const handleCopy = useCallback(async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('复制失败'); }
  }, []);

  if (versions.length === 0) return (
    <div className="p-4 text-center text-sm text-muted-foreground">暂无修改历史</div>
  );

  const latest = versions[versions.length - 1].version;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="w-4 h-4" />
          <span className="font-mono truncate max-w-[200px]">{filePath}</span>
          <span className="text-xs text-muted-foreground">{versions.length} 个版本</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* 版本列表 */}
      <div className="max-h-[260px] overflow-y-auto">
        {[...versions].reverse().map((v) => {
          const isCur = v.version === latest;
          const isPrev = previewVersion === v.version;
          const ts = new Date(v.timestamp);
          const t = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}:${ts.getSeconds().toString().padStart(2, '0')}`;
          return (
            <div key={v.version}
              className={`flex items-center gap-3 px-3 py-2 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${isPrev ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
              onClick={() => setPreviewVersion(isPrev ? null : v.version)}
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isCur ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold">v{v.version}</span>
                  {isCur && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">当前</span>}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{t}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{v.reason || '代码修改'}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="下载" onClick={() => handleDownload(v)}><Download className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="复制" onClick={() => handleCopy(v.code)}><Copy className="w-3 h-3" /></Button>
                {!isCur && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    onClick={() => handleRollback(v.version)}>
                    <RotateCcw className="w-3 h-3 mr-0.5" />回滚
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 代码预览 */}
      {previewCode !== null && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" />预览 v{previewVersion}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleCopy(previewCode)}>
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}<span className="ml-1">复制</span>
            </Button>
          </div>
          <div className="max-h-[220px] overflow-auto bg-[#1e1e1e] rounded-b-lg">
            <pre className="p-3 text-xs font-mono text-gray-300 whitespace-pre overflow-x-auto">{previewCode}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
