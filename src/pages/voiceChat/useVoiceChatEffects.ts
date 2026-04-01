import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Mic, MicOff, ArrowLeft, Volume2, VolumeX, Loader2, Square, Settings, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { acquireMicStream } from "@/hooks/useMicPermission";
import { toast } from "sonner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 语音对话的状态
type VoiceChatState = "idle" | "listening" | "processing" | "speaking" | "thinking";

// 对话消息
interface VoiceMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

// 波形可视化组件
import type { VoiceChatState } from "./types";

/**
 * VoiceChat 副作用 Hook
 * conversationId 加载, 自动滚动, AudioContext 解锁
 */
export function useVoiceChatEffects(state: VoiceChatState) {
  const {
    messages, setMessages, setStatus, setError,
    messagesEndRef, sharedAudioContextRef, isAudioContextUnlocked, setIsAudioContextUnlocked,
    safetyTimeoutRef, trpcClient,
  } = state;

  // 从URL参数读取conversationId，加载历史消息；无参数时清空状态（新建对话）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('conversationId');
    if (!cid) {
      // 新建对话：清空历史，重置状态
      setMessages([]);
      setConversationId(undefined);
      setAiResponse('');
      return;
    }
    const id = parseInt(cid);
    if (isNaN(id)) return;
    setConversationId(id);
    setIsLoadingHistory(true);
    setShowHistory(true); // 从URL加载历史时自动展开历史面板

    // 通过API加载该会话的历史消息（必须带 Authorization header，getById 是 protectedProcedure）
    const token = localStorage.getItem('auth_token');
    fetch(`/api/trpc/conversation.getById?input=${encodeURIComponent(JSON.stringify({id}))}`, {
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        const conversation = data?.result?.data;
        if (conversation?.messages) {
          try {
            const parsed = JSON.parse(conversation.messages);
            // 把历史消息转成 VoiceMessage 格式（只取 user/assistant 角色）
            const voiceMessages: VoiceMessage[] = parsed
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                text: typeof m.content === 'string' ? m.content
                  : Array.isArray(m.content)
                    ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                    : String(m.content || ''),
                timestamp: m.sentAt || m.timestamp || Date.now(),
              }))
              .filter((m: VoiceMessage) => m.text.trim().length > 0);
            setMessages(voiceMessages);
          } catch (e) {
            console.warn('[VoiceChat] Failed to parse history:', e);
          }
        }
      })
      .catch(e => console.warn('[VoiceChat] Failed to load history:', e))
      .finally(() => setIsLoadingHistory(false));
  }, []);

  // 获取默认模型
  useEffect(() => {
    if (packages && packages.length > 0 && !selectedPackageId) {
      const defaultPkg = packages.find((p: any) => p.enabled);
      if (defaultPkg) {
        setSelectedPackageId(defaultPkg.id);
        if (defaultPkg.models && defaultPkg.models.length > 0) {
          const primaryModel = defaultPkg.models.find((m: any) => m.isPrimary);
          setSelectedModelId(primaryModel?.modelId || defaultPkg.models[0].modelId);
        }
      }
    }
  }, [packages, selectedPackageId]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponse]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && state === "listening") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (ttsPlayerRef.current) {
        ttsPlayerRef.current.stop();
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      // 页面卸载时关闭共享 AudioContext
      if (sharedAudioCtxRef.current) {
        sharedAudioCtxRef.current.close().catch(() => {});
        sharedAudioCtxRef.current = null;
      }
    };
  }, []);

  // 设置安全超时 - 防止状态卡死
  const setSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn("[VoiceChat] Safety timeout triggered - forcing state to idle");
      setState((prev) => {
        if (prev !== "idle" && prev !== "listening") {
          return "idle";
        }
        return prev;
      });
      if (ttsPlayerRef.current) {
        ttsPlayerRef.current.stop();
        ttsPlayerRef.current = null;
      }
    }, 30000); // 30秒超时
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  // 在用户首次交互时创建并解锁共享 AudioContext
  const unlockAudio = useCallback(() => {
    if (audioUnlockRef.current && sharedAudioCtxRef.current) return;
    try {
      // 创建共享 AudioContext（在用户手势内创建，浏览器允许自动播放）
      const ctx = sharedAudioCtxRef.current ?? new AudioContext();
      sharedAudioCtxRef.current = ctx;

      // 播一个无声 buffer 强制解锁
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // 被系统打断（来电/截图）后自动恢复
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended') {
          setTimeout(() => ctx.resume().catch(() => {}), 500);
        }
      };

      audioUnlockRef.current = true;
      console.log("[VoiceChat] AudioContext created & unlocked, state:", ctx.state);
    } catch (e) {
      console.error("[VoiceChat] Failed to unlock audio:", e);
    }
  }, []);

  // 获取auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

}
