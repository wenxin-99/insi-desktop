/**
 * CsvPreviewCard — CSV/Excel 上传即时预览分析
 *
 * 上传 CSV/Excel 后在对话区内联渲染表格预览 + "AI 分析" 按钮。
 * - CSV/TSV：用 PapaParse 前端解析
 * - Excel：用 SheetJS (xlsx) 前端解析
 * - 显示前 20 行预览 + 统计信息
 * - "用 AI 分析" / "生成图表" 按钮注入 prompt
 */

import { memo, useState, useEffect, useMemo } from 'react';
import { BarChart3, Sparkles, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CsvPreviewCardProps {
  file: File;
  /** 注入 prompt 到输入框的回调 */
  onInjectPrompt?: (prompt: string) => void;
}

interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalCols: number;
}

const MAX_PREVIEW_ROWS = 20;

/** 简易 CSV 解析器（避免引入 PapaParse 依赖） */
function parseCSV(text: string): ParsedData {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [], totalRows: 0, totalCols: 0 };

  // 检测分隔符
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const sep = tabCount > commaCount ? '\t' : ',';

  function splitRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitRow(lines[0]);
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, MAX_PREVIEW_ROWS).map(splitRow);

  return {
    headers,
    rows,
    totalRows: dataLines.length,
    totalCols: headers.length,
  };
}

/** 解析 Excel 文件（使用 SheetJS） */
async function parseExcel(file: File): Promise<ParsedData> {
  let XLSX: any;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('Excel 解析需要 xlsx 依赖，请先安装：pnpm add xlsx');
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!jsonData.length) return { headers: [], rows: [], totalRows: 0, totalCols: 0 };

  const headers = jsonData[0].map(String);
  const dataRows = jsonData.slice(1);
  const rows = dataRows.slice(0, MAX_PREVIEW_ROWS).map(r => r.map(String));

  return {
    headers,
    rows,
    totalRows: dataRows.length,
    totalCols: headers.length,
  };
}

function CsvPreviewCardInner({ file, onInjectPrompt }: CsvPreviewCardProps) {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const isExcel = useMemo(() =>
    /\.(xlsx|xls|xlsm)$/i.test(file.name), [file.name]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let result: ParsedData;
        if (isExcel) {
          result = await parseExcel(file);
        } else {
          const text = await file.text();
          result = parseCSV(text);
        }
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [file, isExcel]);

  const handleAnalyze = () => {
    if (!data || !onInjectPrompt) return;
    const prompt = `请分析上传的数据文件 ${file.name}，包含 ${data.totalRows} 行 ${data.totalCols} 列。\n列名：${data.headers.join(', ')}\n请提供：1) 数据概况 2) 关键发现 3) 可视化建议`;
    onInjectPrompt(prompt);
  };

  const handleGenerateChart = () => {
    if (!data || !onInjectPrompt) return;
    const prompt = `基于上传的数据文件 ${file.name}（${data.totalRows} 行 × ${data.totalCols} 列），请用 \`\`\`chart 格式生成合适的可视化图表，展示数据中最有价值的趋势或对比。`;
    onInjectPrompt(prompt);
  };

  // 加载中
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">解析 {file.name}...</span>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
        <span className="font-medium">文件解析失败：</span>{error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{file.name}</span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
            {data.totalRows} 行 × {data.totalCols} 列
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onInjectPrompt && (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleGenerateChart}>
                <BarChart3 className="w-3 h-3" />
                生成图表
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAnalyze}>
                <Sparkles className="w-3 h-3" />
                AI 分析
              </Button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 表格预览 */}
      {expanded && (
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border w-10">#</th>
                {data.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border whitespace-nowrap">
                    {h || `列${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 text-muted-foreground border-b border-border/50 tabular-nums">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 border-b border-border/50 max-w-[200px] truncate" title={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalRows > MAX_PREVIEW_ROWS && (
            <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/20 border-t border-border">
              仅显示前 {MAX_PREVIEW_ROWS} 行，共 {data.totalRows} 行
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const CsvPreviewCard = memo(CsvPreviewCardInner);
