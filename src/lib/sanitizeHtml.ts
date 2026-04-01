/**
 * sanitizeHtml — 客户端 HTML 消毒工具（零依赖）
 *
 * ★ 安全修复：所有 dangerouslySetInnerHTML 前必须过一遍
 */

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form',
  'input', 'textarea', 'select', 'button', 'applet',
  'base', 'link', 'meta',
]);

const DANGEROUS_ATTR_VALUES = /^\s*(javascript|vbscript|data\s*:(?!image\/))/i;

function sanitizeElement(el: Element) {
  if (DANGEROUS_TAGS.has(el.tagName.toLowerCase())) {
    el.parentNode?.removeChild(el);
    return;
  }
  const attrsToRemove: string[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') && name.length > 2) {
      attrsToRemove.push(attr.name);
      continue;
    }
    if (['href', 'src', 'action', 'xlink:href', 'formaction'].includes(name)) {
      if (DANGEROUS_ATTR_VALUES.test(attr.value)) {
        attrsToRemove.push(attr.name);
      }
    }
  }
  attrsToRemove.forEach(a => el.removeAttribute(a));
  Array.from(el.children).forEach(child => sanitizeElement(child));
}

/** 消毒 HTML 字符串 */
export function sanitize(dirty: string): string {
  if (!dirty) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${dirty}</div>`, 'text/html');
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) return '';
    sanitizeElement(wrapper);
    return wrapper.innerHTML;
  } catch {
    return dirty.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/** SVG 专用消毒：Mermaid 图表 */
export function sanitizeSvg(dirty: string): string {
  if (!dirty) return '';
  return dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/** 代码高亮结果消毒 */
export function sanitizeCode(dirty: string): string {
  if (!dirty) return '';
  return dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
}
