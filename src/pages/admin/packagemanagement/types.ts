import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Eye, Image, Volume2, Mic, Search, Film, Brain, Globe, Database, ArrowUpDown } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ============ 能力槽位定义 ============

export type SlotType = "chat" | "thinking" | "vision" | "image" | "image_edit" | "video" | "video_i2v" | "tts" | "asr" | "research" | "web_search" | "embedding" | "rerank";

/** 每个能力槽位的定价数据 */
export interface SlotPricing {
  modelId: number;
  fishCoinCost?: number;      // 单次费用（对话/图片/语音等通用）
  fishCoinCost5s?: number;    // 视频 5 秒费用
  fishCoinCost10s?: number;   // 视频 10 秒费用
  // 研究代理定价（仅 research slot 使用）
  researchBaseCost?: number;   // 底价（启动时扣）
  researchStepCost?: number;   // 每步费用（进行中实时扣）
  researchMaxSteps?: number;   // 最大步数
  sshBaseCost?: number;        // SSH 任务底价
  sshStepCost?: number;        // SSH 每步费用
  sshMaxSteps?: number;        // SSH 最大步数
}

export interface PackageSlots {
  chat?:       SlotPricing;
  thinking?:   SlotPricing;
  vision?:     SlotPricing;
  image?:      SlotPricing;
  image_edit?: SlotPricing;
  video?:      SlotPricing;
  video_i2v?: SlotPricing;
  tts?:        SlotPricing;
  asr?:        SlotPricing;
  research?:   SlotPricing;
  web_search?: SlotPricing;
  embedding?:  SlotPricing;
  rerank?:     SlotPricing;
}

/**
 * billing 计费模式：
 *   per_message — 按对话轮次（chat/vision）
 *   per_image   — 按张（image/image_edit）
 *   per_video   — 按条+时长（video，需要 5s/10s 两档）
 *   per_call    — 按次（tts/asr/research）
 */
export type BillingMode = "per_message" | "per_image" | "per_video" | "per_call";

export const SLOT_DEFS: {
  key: SlotType; label: string; icon: any; desc: string;
  modelTypes: string[]; billing: BillingMode; unit: string;
}[] = [
  { key: "chat",       label: "对话/推理",  icon: MessageSquare, desc: "聊天、问答、代码",   modelTypes: ["chat"],               billing: "per_message", unit: "/轮" },
  { key: "thinking",   label: "深度思考",   icon: Brain,         desc: "R1级深度推理分析",   modelTypes: ["chat"],               billing: "per_message", unit: "/轮" },
  { key: "vision",     label: "视觉理解",   icon: Eye,           desc: "图片理解、OCR",      modelTypes: ["chat", "vision"],     billing: "per_message", unit: "/次" },
  { key: "image",      label: "图片生成",   icon: Image,         desc: "文生图、图生图",     modelTypes: ["image"],              billing: "per_image",   unit: "/张" },
  { key: "image_edit", label: "图片编辑",   icon: Image,         desc: "上传原图+指令修改",  modelTypes: ["image"],              billing: "per_image",   unit: "/张" },
  { key: "video",      label: "文生视频",   icon: Film,          desc: "文本生成视频",         modelTypes: ["video"],              billing: "per_video",   unit: "" },
  { key: "video_i2v",  label: "图生视频",   icon: Film,          desc: "图片生成视频",         modelTypes: ["video"],              billing: "per_video",   unit: "" },
  { key: "tts",        label: "语音合成",   icon: Volume2,       desc: "文本转语音",         modelTypes: ["tts"],                billing: "per_call",    unit: "/次" },
  { key: "asr",        label: "语音识别",   icon: Mic,           desc: "语音转文字",         modelTypes: ["asr", "transcription"], billing: "per_call",  unit: "/次" },
  { key: "embedding",  label: "向量嵌入",   icon: Database,      desc: "文本/多模态向量化",   modelTypes: ["embedding"],          billing: "per_call",    unit: "/次" },
  { key: "rerank",     label: "重排序",     icon: ArrowUpDown,   desc: "搜索结果重排序",      modelTypes: ["rerank"],             billing: "per_call",    unit: "/次" },
  { key: "research",   label: "联网代理",   icon: Search,        desc: "Insi 联网代理搜索",     modelTypes: ["chat"],               billing: "per_call",    unit: "/次" },
  { key: "web_search", label: "轻量搜索",   icon: Globe,         desc: "LLM 自动联网搜索（Tavily等）", modelTypes: ["search"],        billing: "per_call",    unit: "/次" },
];

// ============ Config JSON 序列化 ============

export function parseConfig(raw: any): { slots: PackageSlots; [k: string]: any } {
  if (!raw) return { slots: {} };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...parsed, slots: parsed.slots || {} };
  } catch { return { slots: {} }; }
}

export function buildConfigString(slots: PackageSlots, existingConfig?: any): string {
  const base = existingConfig && typeof existingConfig === "object" ? { ...existingConfig } : {};
  const cleanSlots: any = {};
  for (const [k, v] of Object.entries(slots)) {
    if (v && v.modelId) {
      const d: any = { modelId: v.modelId };
      if (v.fishCoinCost && v.fishCoinCost > 0)     d.fishCoinCost = v.fishCoinCost;
      if (v.fishCoinCost5s && v.fishCoinCost5s > 0)  d.fishCoinCost5s = v.fishCoinCost5s;
      if (v.fishCoinCost10s && v.fishCoinCost10s > 0) d.fishCoinCost10s = v.fishCoinCost10s;
      // 研究代理定价字段
      if (v.researchBaseCost != null && v.researchBaseCost > 0) d.researchBaseCost = v.researchBaseCost;
      if (v.researchStepCost != null && v.researchStepCost > 0) d.researchStepCost = v.researchStepCost;
      if (v.researchMaxSteps != null && v.researchMaxSteps > 0) d.researchMaxSteps = v.researchMaxSteps;
      if (v.sshBaseCost != null && v.sshBaseCost > 0) d.sshBaseCost = v.sshBaseCost;
      if (v.sshStepCost != null && v.sshStepCost > 0) d.sshStepCost = v.sshStepCost;
      if (v.sshMaxSteps != null && v.sshMaxSteps > 0) d.sshMaxSteps = v.sshMaxSteps;
      cleanSlots[k] = d;
    }
  }
  base.slots = cleanSlots;
  return JSON.stringify(base);
}

// ============ 组件 ============
