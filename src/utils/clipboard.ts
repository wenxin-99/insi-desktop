/**
 * 跨平台剪贴板复制工具
 *
 * iOS Safari 特殊问题：
 *   - execCommand('copy') 会返回 true 但剪贴板实际为空（视口外/不可见元素）
 *   - navigator.clipboard.writeText 在用户手势链内可用，但异步间隙会丢失
 *
 * 策略：
 *   1. 优先 navigator.clipboard.writeText（现代 API，iOS 13.4+）
 *   2. 降级到 execCommand('copy') + iOS 专用 textarea 配置
 *   3. 两者都失败才返回 false
 */

/** 检测 iOS */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * 使用 execCommand 方式复制文本
 * iOS 专用修复：
 *   - 不能用 opacity:0 / left:-9999px（iOS 会静默忽略不可见元素的 copy）
 *   - 必须在视口内、有尺寸、contentEditable
 *   - fontSize >= 16px 避免 iOS 自动缩放
 */
function execCopy(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", ""); // 防止 iOS 弹出键盘

  // 放在视口内但视觉上不可见（iOS 要求元素在视口内才能真正 copy）
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.padding = "0";
  el.style.border = "none";
  el.style.outline = "none";
  el.style.boxShadow = "none";
  el.style.background = "transparent";
  // iOS 需要 fontSize >= 16px 才不会自动缩放页面
  el.style.fontSize = "16px";
  // 用 clip 隐藏而不是 opacity:0
  el.style.clip = "rect(0, 0, 0, 0)";
  el.style.clipPath = "inset(50%)";
  el.style.overflow = "hidden";
  el.style.whiteSpace = "pre";

  document.body.appendChild(el);

  if (isIOS()) {
    // iOS 特殊：需要 contentEditable + range 选择
    el.contentEditable = "true";
    el.readOnly = false;
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    el.setSelectionRange(0, text.length);
  } else {
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
  }

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }

  document.body.removeChild(el);
  return success;
}

/**
 * 复制文本到剪贴板（跨平台兼容）
 *
 * @returns true 复制成功, false 复制失败
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // ★ 方案 1：优先 Clipboard API（iOS 13.4+ 在用户手势内可用）
  // 必须在 execCommand 之前，因为 iOS 上 execCommand 会谎报成功
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API 失败（可能是权限问题或非 HTTPS），继续尝试降级方案
    }
  }

  // ★ 方案 2：execCommand 降级（iOS 已做专门适配）
  if (execCopy(text)) {
    return true;
  }

  return false;
}

/**
 * 检测当前是否为移动端
 */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  ) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * 在移动端尝试使用原生分享 API，桌面端回退到剪贴板复制
 *
 * @returns 'shared' | 'copied' | 'failed'
 */
export async function shareOrCopy(data: {
  url: string;
  title?: string;
  text?: string;
}): Promise<"shared" | "copied" | "failed"> {
  // 移动端优先使用 Web Share API（iOS 原生分享最可靠）
  if (isMobileDevice() && navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return "shared";
    } catch (err: any) {
      // 用户取消分享不算失败，继续尝试复制
      if (err?.name === "AbortError") return "failed";
    }
  }

  // 回退到复制链接
  const ok = await copyToClipboard(data.url);
  return ok ? "copied" : "failed";
}
