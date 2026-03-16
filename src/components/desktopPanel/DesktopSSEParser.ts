/**
 * DesktopSSEParser — 从聊天 SSE 流中解析桌面控制事件
 *
 * chatStream 通过 SSE 发送的桌面事件类型：
 *   1. { type: "text", content: "..." }              → 普通文字
 *   2. { type: "desktop_screenshot", image, ... }    → 桌面截图
 *   3. { type: "desktop_plan_progress", ... }        → 计划进度
 *   4. { type: "desktop_playbook_generated", ... }   → Playbook 生成
 *
 * 所有 desktop_* 事件都会通过 rawEvent 传递给 useDesktopSocket.handleSSEDesktopEvent
 */

export interface DesktopSSEScreenshot {
  image: string;
  width: number;
  height: number;
  label?: string;
}

export interface ParsedDesktopEvent {
  type: "text" | "desktop_screenshot" | "desktop_event" | "done";
  text?: string;
  screenshot?: DesktopSSEScreenshot;
  /** 所有 desktop_* 类型的原始事件数据（直接转发给 handleSSEDesktopEvent） */
  rawEvent?: Record<string, any>;
}

/**
 * 解析单行 SSE data
 */
export function parseDesktopSSELine(line: string): ParsedDesktopEvent | null {
  if (!line.startsWith("data: ")) return null;

  const dataStr = line.slice(6).trim();

  if (dataStr === "[DONE]") {
    return { type: "done" };
  }

  try {
    const parsed = JSON.parse(dataStr);

    if (parsed.type === "text") {
      return { type: "text", text: parsed.content || "" };
    }

    if (parsed.type === "desktop_screenshot") {
      return {
        type: "desktop_screenshot",
        screenshot: {
          image: parsed.image,
          width: parsed.width,
          height: parsed.height,
          label: parsed.label,
        },
        rawEvent: parsed,
      };
    }

    // 所有其他 desktop_* 事件 → 作为 rawEvent 转发
    if (typeof parsed.type === "string" && parsed.type.startsWith("desktop_")) {
      return {
        type: "desktop_event",
        rawEvent: parsed,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 检查 SSE 响应是否包含桌面控制事件
 */
export function isDesktopControlResponse(sseText: string): boolean {
  return sseText.includes('"type":"desktop_') ||
         sseText.includes('"type": "desktop_');
}
