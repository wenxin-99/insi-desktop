/**
 * MindMapBlock — ```mindmap 代码块渲染组件
 *
 * AI 输出缩进文本，前端用纯 SVG 渲染树形思维导图。
 *
 * 输入格式（纯缩进文本）：
 * ```mindmap
 * 机器学习
 *   监督学习
 *     分类
 *       SVM
 *       决策树
 *   无监督学习
 *     聚类
 *       K-Means
 * ```
 */

import { memo, useState, useMemo, useRef } from 'react';
import { Download, Maximize2, Minimize2, GitBranch, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════ 层级色彩 ═══════
const LEVEL_COLORS = [
  { bg: '#6366f1', text: '#ffffff' },  // L0 root - indigo
  { bg: '#3b82f6', text: '#ffffff' },  // L1 - blue
  { bg: '#10b981', text: '#ffffff' },  // L2 - emerald
  { bg: '#f59e0b', text: '#ffffff' },  // L3 - amber
  { bg: '#ef4444', text: '#ffffff' },  // L4 - red
  { bg: '#8b5cf6', text: '#ffffff' },  // L5 - violet
  { bg: '#ec4899', text: '#ffffff' },  // L6 - pink
  { bg: '#06b6d4', text: '#ffffff' },  // L7 - cyan
];

// ═══════ 树节点类型 ═══════
interface TreeNode {
  label: string;
  children: TreeNode[];
  depth: number;
  collapsed?: boolean;
}

interface LayoutNode {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  children: LayoutNode[];
  collapsed?: boolean;
  parent?: LayoutNode;
}

// ═══════ 解析缩进文本 → 树 ═══════
function parseIndentedText(text: string): TreeNode | null {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return null;

  // 检测缩进单元（2 空格 / 4 空格 / tab）
  let indentUnit = 2;
  for (const line of lines.slice(1)) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const spaces = match[1].replace(/\t/g, '  ').length;
      if (spaces > 0) { indentUnit = spaces; break; }
    }
  }

  const root: TreeNode = { label: lines[0].trim(), children: [], depth: 0 };
  const stack: { node: TreeNode; indent: number }[] = [{ node: root, indent: -1 }];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\t/g, '  '); // tab → 2 空格（与缩进检测一致）
    const leadingSpaces = stripped.match(/^(\s*)/)?.[1].length || 0;
    const label = raw.trim().replace(/^[-*•]\s*/, ''); // 去掉列表符号
    if (!label) continue;

    const depth = Math.floor(leadingSpaces / indentUnit) + 1;
    const node: TreeNode = { label, children: [], depth };

    // 找到正确的父节点
    while (stack.length > 1 && stack[stack.length - 1].indent >= leadingSpaces) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent: leadingSpaces });
  }

  return root;
}

// ═══════ 布局计算 ═══════
const NODE_H = 32;
const NODE_PAD_X = 16;
const LEVEL_GAP_X = 40;
const SIBLING_GAP_Y = 8;

function measureTextWidth(text: string, fontSize = 13): number {
  // 近似：中文字符 ~fontSize，英文字符 ~fontSize*0.6
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 127 ? fontSize : fontSize * 0.6;
  }
  return w + NODE_PAD_X * 2;
}

function layoutTree(node: TreeNode, startX: number, startY: number): { root: LayoutNode; totalHeight: number } {
  const width = Math.max(60, measureTextWidth(node.label));
  const layoutNode: LayoutNode = {
    label: node.label, x: startX, y: 0,
    width, height: NODE_H, depth: node.depth,
    children: [], collapsed: node.collapsed,
  };

  if (!node.children.length || node.collapsed) {
    layoutNode.y = startY;
    return { root: layoutNode, totalHeight: NODE_H };
  }

  let childY = startY;
  let totalChildHeight = 0;
  const childX = startX + width + LEVEL_GAP_X;

  for (let i = 0; i < node.children.length; i++) {
    const { root: childLayout, totalHeight: childH } = layoutTree(node.children[i], childX, childY);
    childLayout.parent = layoutNode;
    layoutNode.children.push(childLayout);
    childY += childH + SIBLING_GAP_Y;
    totalChildHeight += childH + (i < node.children.length - 1 ? SIBLING_GAP_Y : 0);
  }

  // 父节点居中于子节点
  const firstChild = layoutNode.children[0];
  const lastChild = layoutNode.children[layoutNode.children.length - 1];
  layoutNode.y = (firstChild.y + lastChild.y) / 2;

  return { root: layoutNode, totalHeight: totalChildHeight };
}

// ═══════ SVG 渲染 ═══════
function renderNodesSVG(
  node: LayoutNode,
  onToggle: (node: LayoutNode) => void,
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const colorIdx = Math.min(node.depth, LEVEL_COLORS.length - 1);
  const color = LEVEL_COLORS[colorIdx];
  const isRoot = node.depth === 0;
  const rx = isRoot ? 16 : 8;

  // 节点矩形
  elements.push(
    <g key={`node-${node.x}-${node.y}`}
      className="cursor-pointer transition-transform"
      onClick={() => node.children.length > 0 && onToggle(node)}>
      <rect
        x={node.x} y={node.y - NODE_H / 2}
        width={node.width} height={NODE_H}
        rx={rx} ry={rx}
        fill={color.bg}
        className="drop-shadow-sm hover:drop-shadow-md transition-all"
        opacity={0.9}
      />
      <text
        x={node.x + node.width / 2}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color.text}
        fontSize={isRoot ? 14 : 13}
        fontWeight={isRoot ? 700 : 500}
        fontFamily="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
      >
        {node.label}
      </text>
      {/* 折叠/展开指示器 */}
      {node.collapsed && (
        <text
          x={node.x + node.width - 8}
          y={node.y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color.text}
          fontSize={10}
          opacity={0.7}
        >
          +{/* collapsed indicator */}
        </text>
      )}
    </g>
  );

  // 连接线 + 子节点
  for (const child of node.children) {
    const startX = node.x + node.width;
    const startY = node.y;
    const endX = child.x;
    const endY = child.y;
    const midX = (startX + endX) / 2;

    elements.push(
      <path key={`edge-${startX}-${startY}-${endX}-${endY}`}
        d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
        fill="none"
        stroke="var(--border, #cbd5e1)"
        strokeWidth={1.5}
        opacity={0.6}
      />
    );

    elements.push(...renderNodesSVG(child, onToggle));
  }

  return elements;
}

// ═══════ SVG 尺寸计算 ═══════
function getMaxX(node: LayoutNode): number {
  let max = node.x + node.width;
  for (const c of node.children) max = Math.max(max, getMaxX(c));
  return max;
}
function getMaxY(node: LayoutNode): number {
  let max = node.y + NODE_H / 2;
  for (const c of node.children) max = Math.max(max, getMaxY(c));
  return max;
}
function getMinY(node: LayoutNode): number {
  let min = node.y - NODE_H / 2;
  for (const c of node.children) min = Math.min(min, getMinY(c));
  return min;
}

// ═══════ 主组件 ═══════
interface MindMapBlockProps {
  content: string;
  streaming?: boolean;
}

function MindMapBlockInner({ content, streaming }: MindMapBlockProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  // 解析树
  const tree = useMemo(() => parseIndentedText(content), [content]);

  // 流式中渐进渲染
  if (!tree) {
    if (streaming) {
      return (
        <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-indigo-500 animate-pulse" />
              <h3 className="text-sm font-medium">思维导图生成中...</h3>
            </div>
            <div className="h-[160px] flex items-center justify-center">
              <div className="flex items-center gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-16 h-8 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="h-0.5 bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
          </div>
        </div>
      );
    }
    return null;
  }

  // ★ 布局计算 + 尺寸缓存（仅 tree 变化时重算）
  const { layoutRoot, svgW, svgH, viewBox } = useMemo(() => {
    const { root } = layoutTree(tree, 20, 20 + NODE_H);
    const w = getMaxX(root) + 40;
    const minY = getMinY(root);
    const maxY = getMaxY(root);
    const h = maxY - minY + 40;
    return { layoutRoot: root, svgW: w, svgH: h, viewBox: `0 ${minY - 20} ${w} ${h}` };
  }, [tree]);

  // 暂不支持折叠（纯展示模式）
  const handleToggle = () => {};

  // 下载 SVG
  const handleDownload = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${tree?.label || 'mindmap'}.svg`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn(
      'my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm',
      isFullscreen && 'fixed inset-4 z-50 rounded-2xl shadow-2xl flex flex-col'
    )}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-medium">{tree.label}</h3>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
            思维导图
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom(z => Math.min(2, z + 0.2))}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="放大">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="缩小">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="下载 SVG">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={isFullscreen ? '退出全屏' : '全屏'}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* SVG 画布 */}
      <div className={cn('overflow-auto', isFullscreen ? 'flex-1' : 'max-h-[400px]')}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width={svgW * zoom}
          height={svgH * zoom}
          className="min-w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {renderNodesSVG(layoutRoot, handleToggle)}
        </svg>
      </div>

      {/* 全屏遮罩 */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10" onClick={() => setIsFullscreen(false)} />
      )}
    </div>
  );
}

export const MindMapBlock = memo(MindMapBlockInner);
