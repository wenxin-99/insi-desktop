/**
 * voicePromptBuilder.ts — 语音对话 System Prompt 组装器（v3 统一版）
 *
 * ★ P0 修复：伴侣 prompt 不再在前端构建，改为使用服务端返回的 companionSection。
 * 消除了 companionPromptHelper.ts (服务端) 和 companionPrompts.ts (前端) 的模板重复问题。
 *
 * 两种模式：
 *   A. 普通模式 — SOUL + 语音基础 + 情绪关怀 + MEMORY + RULES
 *   B. 伴侣模式 — companionSection(服务端构建) + 精简语音指令 + MEMORY + RULES
 *
 * 供 useVoiceChatHandlers（STT 管线）和 useGeminiLive（实时管线）共用。
 */

// ★ 不再 import { buildCompanionSoulPrompt } — 已移至服务端

export interface VoicePersonaData {
  soulSection: string;
  rulesSection: string;
  memorySection: string;
  topicRumination?: string;
  // ★ 服务端统一构建的伴侣相关字段
  companionSection?: string;
  companionName?: string;
  companionEnabled?: boolean;
  relationshipContext?: string;
}

/**
 * 构建语音对话的完整 system prompt
 *
 * v3 变更：不再接受 companion/relationshipContext 参数，
 * 这些信息已由服务端 persona.getVoicePrompt 统一返回在 persona 对象中。
 *
 * @param persona 人格数据（从 persona.getVoicePrompt 获取，含伴侣信息）
 */
export function buildVoiceSystemPrompt(
  persona?: VoicePersonaData | null,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const parts: string[] = [];

  // ═══════════ 伴侣模式（使用服务端返回的 companionSection）═══════════
  const isCompanionMode = persona?.companionEnabled && persona?.companionSection;

  if (isCompanionMode) {
    // 伴侣人格（服务端 companionPromptHelper.ts 构建，唯一模板来源）
    parts.push(persona!.companionSection!);

    // 关系状态上下文（久未聊天→想念，连续聊天→更亲密）
    if (persona?.relationshipContext) {
      parts.push(persona.relationshipContext);
    }

    // 精简语音基础指令（伴侣模式不需要"你是语音助手"这种泛称）
    parts.push([
      `今天是${dateStr}。`,
      '',
      '语音规范：',
      '- 回复简短口语化，适合语音播放',
      '- 禁止使用 Markdown 格式和特殊符号（星号、井号等会被语音直接读出来）',
    ].join('\n'));

  } else {
    // ═══════════ 普通模式 ═══════════

    // SOUL 层
    if (persona?.soulSection) {
      parts.push(persona.soulSection);
    }

    // 语音基础指令
    const hasPersona = !!persona?.soulSection;
    const voiceBase = hasPersona
      ? [
          `今天是${dateStr}。`,
          '',
          '语音对话规范：',
          '- 用简洁、口语化的方式回答，每次1-3句话，适合语音播放',
          '- 禁止使用 Markdown 格式、代码块或特殊符号（星号、井号、下划线、反引号等会被语音直接读出来）',
          '- 耐心等用户把话说完再回复',
        ].join('\n')
      : [
          `你是一个友好的语音助手。今天是${dateStr}。`,
          '',
          '- 用简洁、口语化的方式回答问题，回答尽量简短精炼，适合语音播放',
          '- 禁止使用 Markdown 格式、代码块或特殊符号（星号、井号、下划线、反引号等会被语音直接读出来）',
          '- 耐心等用户把话说完再回复',
          '- 语气自然亲切，像朋友聊天',
          '- 打招呼简短回应即可',
        ].join('\n');
    parts.push(voiceBase);

    // 情绪关怀（普通模式）
    parts.push([
      '情绪关怀：',
      '- 关注用户语气中的情绪变化。如果用户听起来低落、疲惫或焦虑，语气自然变柔和，先表达理解再回答问题',
      '- 温和而非激昂，"听起来你不太容易"比"加油你可以的"更好',
      '- 如果用户表达出很痛苦或想伤害自己，温和地说"如果你现在很难受，可以拨打心理援助热线400-161-9995，随时都有人听你说"',
    ].join('\n'));
  }

  // ═══════════ 共用层 ═══════════

  // MEMORY 层
  if (persona?.memorySection) {
    parts.push(persona.memorySection);
  }

  // 话题反刍（伴侣模式下，从旧记忆中挑选可主动提起的话题）
  if (isCompanionMode && persona?.topicRumination) {
    parts.push(persona.topicRumination);
  }

  // RULES 层
  if (persona?.rulesSection) {
    parts.push(persona.rulesSection);
  }

  return parts.join('\n\n');
}
