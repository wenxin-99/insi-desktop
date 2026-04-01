/**
 * src/components/RouteErrorBoundary.tsx — P2 新增
 *
 * 专为 lazy route 设计的错误边界，提供比全局 ErrorBoundary 更好的恢复体验：
 *   - 尝试路由级恢复（重新渲染当前页面，而非刷新整个 SPA）
 *   - 自动上报错误到 /api/errors（如果可用）
 *   - 对 chunk 加载失败自动刷新
 *   - 提供 "返回首页" 按钮
 *
 * 用法 (在 App.tsx 中包裹每个 lazy route):
 *   <Route path="/chat" element={
 *     <RouteErrorBoundary>
 *       <Suspense fallback={<PageLoader />}>
 *         <Chat />
 *       </Suspense>
 *     </RouteErrorBoundary>
 *   } />
 */
import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  /** 可选的路由名称，用于错误日志 */
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

function isDynamicImportError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    (error.name === 'TypeError' && msg.includes('fetch'))
  );
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Chunk 加载失败自动刷新（同一页面 5s 内只刷一次）
    if (isDynamicImportError(error)) {
      const key = `routeEB_reload_${this.props.routeName || 'default'}`;
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last > 5000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return;
      }
    }

    // 上报错误（静默，不阻塞 UI）
    this._reportError(error, errorInfo);
  }

  private async _reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      await fetch('/api/trpc/aiOps.submitPassiveSignal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            signalType: 'js_error',
            pageUrl: window.location.pathname,
            detail: `[RouteErrorBoundary] ${error.message}\n${errorInfo.componentStack?.slice(0, 500)}`,
            context: {
              routeName: this.props.routeName,
              stack: error.stack?.slice(0, 1000),
            },
          },
        }),
      });
    } catch {
      // 上报失败不影响用户体验
    }
  }

  private handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isChunkError = this.state.error && isDynamicImportError(this.state.error);
    const canRetry = this.state.retryCount < 3;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="flex flex-col items-center max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <h2 className="text-lg font-semibold mb-2">
            {isChunkError ? '页面加载失败' : '页面出现了问题'}
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            {isChunkError
              ? '可能是网络问题或应用已更新，请尝试刷新。'
              : '该页面遇到了意外错误，您的数据不受影响。'}
          </p>

          {/* 错误详情（仅开发环境或非 chunk 错误时显示） */}
          {!isChunkError && this.state.error && (
            <details className="w-full mb-6 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                查看错误详情
              </summary>
              <pre className="mt-2 p-3 text-xs bg-muted rounded-lg overflow-auto max-h-40 whitespace-pre-wrap break-all">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
              </pre>
            </details>
          )}

          <div className="flex gap-3">
            {canRetry && (
              <button
                onClick={this.handleRetry}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                  'bg-primary text-primary-foreground hover:opacity-90',
                )}
              >
                <RotateCcw className="w-4 h-4" />
                重试{this.state.retryCount > 0 ? ` (${this.state.retryCount}/3)` : ''}
              </button>
            )}
            <button
              onClick={this.handleGoHome}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                'bg-secondary text-secondary-foreground hover:opacity-90',
              )}
            >
              <Home className="w-4 h-4" />
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default RouteErrorBoundary;
