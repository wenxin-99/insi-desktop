/**
 * DiffViewer — Side-by-side 差异对比视图
 *
 * 解析 unified diff 格式，渲染为左右双栏对比:
 *   - 绿色: 新增行 (右侧)
 *   - 红色: 删除行 (左侧)
 *   - 灰色: 上下文行 (双侧)
 *   - 行号对齐
 *   - 文件级折叠
 */
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileCode } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  /** 单文件 diff 还是多文件 */
  className?: string;
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "hunk";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

interface DiffFile {
  oldFile: string;
  newFile: string;
  hunks: DiffLine[];
  additions: number;
  deletions: number;
}

/** 解析 unified diff 为结构化数据 */
function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let current: DiffFile | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 文件头: --- a/path
    if (line.startsWith("--- ")) {
      const next = lines[i + 1];
      if (next?.startsWith("+++ ")) {
        current = {
          oldFile: line.replace("--- a/", "").replace("--- /dev/null", "(new file)"),
          newFile: next.replace("+++ b/", "").replace("+++ /dev/null", "(deleted)"),
          hunks: [],
          additions: 0,
          deletions: 0,
        };
        files.push(current);
        i++; // skip +++ line
        continue;
      }
    }

    if (!current) continue;

    // Hunk 头: @@ -old,len +new,len @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]);
      newLine = parseInt(hunkMatch[2]);
      current.hunks.push({
        type: "hunk",
        content: `@@ ${hunkMatch[3] || ""}`.trim(),
      });
      continue;
    }

    // 跳过 diff --git 等元数据行
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("similarity") ||
      line.startsWith("rename") ||
      line.startsWith("Binary")
    ) {
      continue;
    }

    if (line.startsWith("+")) {
      current.hunks.push({
        type: "add",
        content: line.substring(1),
        newLineNo: newLine++,
      });
      current.additions++;
    } else if (line.startsWith("-")) {
      current.hunks.push({
        type: "del",
        content: line.substring(1),
        oldLineNo: oldLine++,
      });
      current.deletions++;
    } else if (line.startsWith(" ") || line === "") {
      current.hunks.push({
        type: "ctx",
        content: line.substring(1) || "",
        oldLineNo: oldLine++,
        newLineNo: newLine++,
      });
    }
  }

  return files;
}

function DiffFileView({ file }: { file: DiffFile }) {
  const [collapsed, setCollapsed] = useState(false);
  const fileName = file.newFile === "(deleted)" ? file.oldFile : file.newFile;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-3">
      {/* 文件头 */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary/80 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
        type="button"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-mono truncate flex-1">{fileName}</span>
        <span className="text-xs shrink-0">
          {file.additions > 0 && (
            <span className="text-green-600 dark:text-green-400 mr-2">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
          )}
        </span>
      </button>

      {/* Diff 内容 */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {file.hunks.map((line, i) => {
                if (line.type === "hunk") {
                  return (
                    <tr key={i} className="bg-blue-50/50 dark:bg-blue-950/30">
                      <td
                        colSpan={4}
                        className="px-3 py-1 text-blue-600 dark:text-blue-400 text-[11px]"
                      >
                        {line.content}
                      </td>
                    </tr>
                  );
                }

                const bgClass =
                  line.type === "add"
                    ? "bg-green-50/70 dark:bg-green-950/30"
                    : line.type === "del"
                    ? "bg-red-50/70 dark:bg-red-950/30"
                    : "";

                const textClass =
                  line.type === "add"
                    ? "text-green-800 dark:text-green-300"
                    : line.type === "del"
                    ? "text-red-800 dark:text-red-300"
                    : "text-foreground/80";

                return (
                  <tr key={i} className={bgClass}>
                    {/* 旧行号 */}
                    <td className="w-10 text-right pr-2 text-muted-foreground/50 select-none border-r border-border/50 text-[11px]">
                      {line.type !== "add" ? line.oldLineNo : ""}
                    </td>
                    {/* 新行号 */}
                    <td className="w-10 text-right pr-2 text-muted-foreground/50 select-none border-r border-border/50 text-[11px]">
                      {line.type !== "del" ? line.newLineNo : ""}
                    </td>
                    {/* 符号 */}
                    <td className="w-5 text-center select-none text-[11px]">
                      {line.type === "add" ? "+" : line.type === "del" ? "-" : ""}
                    </td>
                    {/* 内容 */}
                    <td className={cn("px-2 py-0 whitespace-pre-wrap break-all", textClass)}>
                      {line.content || " "}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const files = useMemo(() => parseDiff(diff), [diff]);

  if (!diff.trim() || files.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)}>
        没有差异内容
      </div>
    );
  }

  const totalAdd = files.reduce((s, f) => s + f.additions, 0);
  const totalDel = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div className={className}>
      {/* 统计摘要 */}
      <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
        <span>{files.length} 个文件变更</span>
        {totalAdd > 0 && <span className="text-green-600 dark:text-green-400">+{totalAdd}</span>}
        {totalDel > 0 && <span className="text-red-600 dark:text-red-400">-{totalDel}</span>}
      </div>
      {files.map((file, i) => (
        <DiffFileView key={i} file={file} />
      ))}
    </div>
  );
}
