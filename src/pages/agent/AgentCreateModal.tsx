/**
 * pages/agent/AgentCreateModal.tsx — 创建 Agent 任务弹窗
 *
 * ★ Phase 3: 新增「定时执行」可折叠配置区
 */
import { useState } from "react";
import {
  X, Globe, Search, Code2, Cpu, Sparkles,
  Terminal, Box, Server, Wifi, WifiOff,
  ChevronRight, Loader2, Zap, Timer, ChevronDown, Coins,
} from "lucide-react";
import type { AgentType } from "./types";
import { CRON_PRESETS, cronToHuman } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { prompt: string; type: AgentType; tools?: string[]; sandboxMode?: string }) => void;
  /** ★ Phase 3: 创建定时任务 */
  onCreateScheduled?: (data: {
    prompt: string; type: AgentType; cronExpression: string;
    timezone?: string; config?: any;
    webhookUrl?: string; webhookMethod?: string; webhookHeaders?: string; webhookBody?: string;
    maxRetries?: number; timeoutSeconds?: number;
  }) => void;
  isCreating: boolean;
  isCreatingScheduled?: boolean;
}

const TYPE_OPTIONS: Array<{
  type: AgentType; icon: any; label: string; desc: string; detail: string; estCost: string; color: string;
  defaultTools: string[]; defaultSandbox: string;
}> = [
  {
    type: "general", icon: Cpu, label: "通用 Agent",
    desc: "自动选择工具完成任务",
    detail: "适合：问答、文本处理、简单分析。AI 自动决定使用搜索、计算等工具。",
    estCost: "2~10 🐟",
    color: "border-gray-300 hover:border-gray-500 hover:bg-gray-50",
    defaultTools: [], defaultSandbox: "none",
  },
  {
    type: "automation", icon: Globe, label: "浏览器自动化",
    desc: "操作网页、填表、发帖",
    detail: "适合：论坛发帖/回复、网页数据采集、表单填写。使用 Playwright 控制浏览器。",
    estCost: "5~30 🐟",
    color: "border-blue-300 hover:border-blue-500 hover:bg-blue-50",
    defaultTools: ["browser.*", "system.*"], defaultSandbox: "browser",
  },
  {
    type: "research", icon: Search, label: "深度调研",
    desc: "搜索、分析、生成报告",
    detail: "适合：主题调研、竞品分析、新闻摘要。多源搜索 + 信息整合 + 结构化报告。",
    estCost: "3~15 🐟",
    color: "border-purple-300 hover:border-purple-500 hover:bg-purple-50",
    defaultTools: ["web.*", "system.*"], defaultSandbox: "none",
  },
  {
    type: "codeact", icon: Code2, label: "代码执行",
    desc: "编写代码、执行脚本、调试",
    detail: "适合：远程服务器运维、代码审查、自动部署。支持 SSH 连接和 Docker 容器。",
    estCost: "5~20 🐟",
    color: "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50",
    defaultTools: ["shell.*", "file.*", "web.*", "code.*", "system.*"], defaultSandbox: "docker",
  },
];

const SANDBOX_OPTIONS = [
  { value: "none", icon: WifiOff, label: "无沙箱", desc: "仅搜索和分析" },
  { value: "docker", icon: Box, label: "Docker 容器", desc: "隔离执行环境" },
  { value: "ssh", icon: Server, label: "SSH 远程", desc: "连接远程服务器" },
  { value: "browser", icon: Globe, label: "浏览器", desc: "Playwright 自动化" },
];

/** ★ 常用任务模板（一键填充 prompt） */
const QUICK_TEMPLATES: Array<{ label: string; type: AgentType; prompt: string; icon: string }> = [
  { label: "调研报告", type: "research", prompt: "调研「」的最新进展，搜索多个来源，整理一份 2000 字的研究报告，包含现状、趋势、主要玩家对比", icon: "🔍" },
  { label: "竞品分析", type: "research", prompt: "对比分析「产品A」和「产品B」的功能、价格、用户评价，生成对比矩阵表格", icon: "⚔️" },
  { label: "服务器巡检", type: "codeact", prompt: "检查服务器健康状态：CPU/内存/磁盘使用率、关键服务运行状态、最近错误日志，生成巡检报告", icon: "🏥" },
  { label: "论坛发帖", type: "automation", prompt: "登录论坛 [URL]，在 [分类] 发布一篇关于「」的帖子，内容要专业有深度", icon: "💬" },
  { label: "网页采集", type: "automation", prompt: "访问 [URL] 页面，提取所有「」信息，整理为 Markdown 表格", icon: "📊" },
  { label: "代码审查", type: "codeact", prompt: "进入项目目录 /www/wwwroot/[项目名]，检查最近的 git 提交，分析代码质量，生成审查报告", icon: "🔎" },
];

export function AgentCreateModal({ open, onClose, onCreate, onCreateScheduled, isCreating, isCreatingScheduled }: Props) {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<AgentType>("general");
  const [prompt, setPrompt] = useState("");
  const [sandboxMode, setSandboxMode] = useState("none");

  // ★ Phase 3: 定时配置
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 0 8 * * *");
  const [customCron, setCustomCron] = useState("");
  const [useCustomCron, setUseCustomCron] = useState(false);

  if (!open) return null;

  const typeOption = TYPE_OPTIONS.find(t => t.type === selectedType)!;
  const isSubmitting = isCreating || (isCreatingScheduled || false);

  const finalCron = useCustomCron ? customCron : cronExpression;

  const handleSubmit = () => {
    if (!prompt.trim()) return;

    if (enableSchedule && onCreateScheduled) {
      // ★ 创建定时任务
      onCreateScheduled({
        prompt: prompt.trim(),
        type: selectedType,
        cronExpression: finalCron,
        config: {
          maxSteps: selectedType === "automation" ? 55 : 30,
          tools: typeOption.defaultTools,
          sandboxMode,
        },
      });
    } else {
      // 一次性任务
      onCreate({
        prompt: prompt.trim(),
        type: selectedType,
        tools: typeOption.defaultTools,
        sandboxMode,
      });
    }
  };

  const handleSelectType = (type: AgentType) => {
    const opt = TYPE_OPTIONS.find(t => t.type === type)!;
    setSelectedType(type);
    setSandboxMode(opt.defaultSandbox);
    setStep(1);
  };

  const handleClose = () => {
    setStep(0);
    setPrompt("");
    setEnableSchedule(false);
    setCronExpression("0 0 8 * * *");
    setCustomCron("");
    setUseCustomCron(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base">创建 Agent 任务</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 0: 选类型 */}
        {step === 0 && (
          <div className="p-5">
            <p className="text-sm text-muted-foreground mb-4">选择 Agent 类型</p>
            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => handleSelectType(opt.type)}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${opt.color}`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className="w-6 h-6" />
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{opt.estCost}</span>
                    </div>
                    <span className="font-semibold text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                    <span className="text-[11px] text-muted-foreground/70 mt-1.5 leading-tight">{opt.detail}</span>
                  </button>
                );
              })}
            </div>

            {/* ★ 快捷模板入口 */}
            <div className="mt-5 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> 快速开始</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => {
                    handleSelectType(tpl.type);
                    setPrompt(tpl.prompt);
                  }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-muted/60 hover:bg-muted rounded-lg transition-colors">
                    <span>{tpl.icon}</span> {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 填写任务 */}
        {step === 1 && (
          <div className="p-5">
            {/* 类型指示 */}
            <button onClick={() => setStep(0)} className="flex items-center gap-2 text-xs text-muted-foreground mb-3 hover:text-foreground transition-colors">
              <typeOption.icon className="w-3.5 h-3.5" />
              {typeOption.label}
              <span className="text-primary">· 点击切换</span>
            </button>

            {/* Prompt */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                selectedType === "automation" ? "描述你要自动化的操作，例如：登录论坛并发布一篇关于 AI 的帖子"
                : selectedType === "research" ? "描述你要调研的主题，例如：调研 2024 年 AI Agent 框架的最新进展"
                : selectedType === "codeact" ? "描述你要执行的代码任务，例如：检查服务器上 Node.js 项目的依赖问题并修复"
                : "描述你需要 Agent 完成的任务..."
              }
              className="w-full h-32 p-3 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              autoFocus
            />

            {/* 沙箱模式 */}
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">执行环境</p>
              <div className="flex gap-2 flex-wrap">
                {SANDBOX_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = sandboxMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSandboxMode(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        isSelected ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ★ Phase 3: 定时执行配置 */}
            {onCreateScheduled && (
              <div className="mt-4 border rounded-xl overflow-hidden">
                <button
                  onClick={() => setEnableSchedule(!enableSchedule)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    enableSchedule ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Timer className={`w-4 h-4 ${enableSchedule ? "text-blue-600" : "text-muted-foreground"}`} />
                    <span className={enableSchedule ? "font-medium text-blue-700 dark:text-blue-300" : "text-muted-foreground"}>
                      定时执行
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {enableSchedule && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">{cronToHuman(finalCron)}</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${enableSchedule ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {enableSchedule && (
                  <div className="px-4 py-3 border-t space-y-3">
                    {/* Cron 预设 */}
                    <div className="flex flex-wrap gap-1.5">
                      {CRON_PRESETS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => { setCronExpression(p.value); setUseCustomCron(false); }}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                            !useCustomCron && cronExpression === p.value
                              ? "bg-blue-100 text-blue-700 font-medium dark:bg-blue-900/50 dark:text-blue-300"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* 自定义 cron */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={useCustomCron ? customCron : cronExpression}
                        onChange={e => { setCustomCron(e.target.value); setUseCustomCron(true); }}
                        onFocus={() => setUseCustomCron(true)}
                        placeholder="0 0 * * * *"
                        className="flex-1 px-3 py-1.5 rounded-lg border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">秒 分 时 日 月 周</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 提交 */}
            <div className="flex items-center justify-between mt-5">
              {/* ★ 费用预估 */}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                预估费用: <span className="font-medium text-foreground">{typeOption.estCost}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  取消
                </button>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isSubmitting}
                className={`px-5 py-2 text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 ${
                  enableSchedule
                    ? "bg-blue-600 text-white"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />创建中...</>
                ) : enableSchedule ? (
                  <><Timer className="w-4 h-4" />创建定时任务</>
                ) : (
                  <><Zap className="w-4 h-4" />创建任务</>
                )}
              </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
