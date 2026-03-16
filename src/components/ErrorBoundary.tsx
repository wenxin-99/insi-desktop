import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// 检测是否为动态 import 失败（部署更新导致旧 chunk 文件不存在）
function isDynamicImportError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    (error.name === 'TypeError' && msg.includes('fetch'))
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // 动态 import 失败时自动刷新（防止无限刷新：同一页面 5 秒内只刷一次）
    if (isDynamicImportError(error)) {
      const key = 'errorBoundary_lastReload';
      const lastReload = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - lastReload > 5000) {
        console.log('[ErrorBoundary] Dynamic import failed, auto-reloading...');
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return;
      }
      console.warn('[ErrorBoundary] Dynamic import failed again after reload, showing error page');
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && isDynamicImportError(this.state.error);

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">
              {isChunkError ? '页面版本已更新，正在刷新...' : 'An unexpected error occurred.'}
            </h2>

            {!isChunkError && (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.message || this.state.error?.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              {isChunkError ? '点击刷新' : 'Reload Page'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
