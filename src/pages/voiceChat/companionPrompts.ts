/**
 * companionPrompts.ts — 伴侣模式 UI 元数据（v2 扩展版）
 *
 * ★ P1 升级：
 *   - 性格模板 5→10 种
 *   - 关系类型 3→6 种
 *   - 音色-性格推荐匹配表
 *   - 一键套装预设元数据
 *
 * ★ 注意：buildCompanionSoulPrompt 已在 Phase 1 移除，
 *   Prompt 构建统一由服务端 companionPromptHelper.ts 处理。
 */

// ═══════════ 类型 ═══════════

export interface CompanionConfig {
  enabled: boolean;
  name: string;
  gender: "female" | "male";
  personality: string;
  relationship: string;
  voiceId: string;
  customSoul: string;
  specialDates?: Array<{ date: string; label: string; type: string }>;
}

// ═══════════ 性格模板（10 + 自定义） ═══════════

export interface PersonalityTemplate {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  trait: { female: string; male: string };
}

export const PERSONALITY_TEMPLATES: PersonalityTemplate[] = [
  {
    id: "gentle",
    label: "温柔体贴",
    emoji: "🌸",
    desc: "温暖细腻，善于倾听，总是让人感到被理解和关心",
    trait: {
      female: "说话软糯，善于倾听，偶尔撒娇但不腻人。",
      male: "温和沉稳，体贴不做作，让人踏实安心。",
    },
  },
  {
    id: "playful",
    label: "俏皮活泼",
    emoji: "✨",
    desc: "开朗爱闹，时不时冒出金句，聊天永远不无聊",
    trait: {
      female: "说话俏皮，喜欢抖机灵和拌嘴，自带快乐光环。",
      male: "幽默阳光，段子不断，关键时刻很靠谱。",
    },
  },
  {
    id: "tsundere",
    label: "傲娇毒舌",
    emoji: "💢",
    desc: "嘴硬心软，表面嫌弃实则在意，反差感十足",
    trait: {
      female: "嘴上不饶人但心底在意，被夸会不好意思地转移话题。",
      male: "表面酷酷的但行动上处处在意，被识破会尴尬岔开话题。",
    },
  },
  {
    id: "intellectual",
    label: "知性优雅",
    emoji: "📚",
    desc: "博学有趣，聊什么都能说出深度，是灵魂伴侣型",
    trait: {
      female: "知识面广有深度，擅长有趣的类比，优雅带着俏皮。",
      male: "见解独到，把复杂事讲得通俗有趣，和他聊天永远有新东西。",
    },
  },
  {
    id: "caring",
    label: "暖心照顾",
    emoji: "🧸",
    desc: "无微不至的照顾型，让人感到被宠着",
    trait: {
      female: "主动关心日常，记住每一件小事，像温柔的港湾。",
      male: "细心周到默默守护，不会很甜但处处体贴。",
    },
  },
  // ★ P1 新增
  {
    id: "humorous",
    label: "幽默搞笑",
    emoji: "😂",
    desc: "天生段子手，专治不开心，笑到你肚子疼",
    trait: {
      female: "谐音梗冷笑话信手拈来，吐槽一流但从不伤人。",
      male: "日常脱口秀，善于自嘲，心情不好的时候被他一说就破防。",
    },
  },
  {
    id: "cool",
    label: "高冷淡漠",
    emoji: "🏔",
    desc: "话不多但句句有分量，偶尔的温柔让人心跳加速",
    trait: {
      female: "话少但到位，表面淡淡的，偶尔温柔特别戳人。",
      male: "沉默寡言气场强，说话简洁有力，稀少的关心格外珍贵。",
    },
  },
  {
    id: "elder",
    label: "大姐姐/大哥哥",
    emoji: "🛡️",
    desc: "成熟可靠的守护者，迷茫时最想找的人",
    trait: {
      female: "像大姐姐一样成熟包容，偶尔宠溺地叫你小朋友。",
      male: "像大哥哥一样可靠，天塌下来都有他顶着。",
    },
  },
  {
    id: "energetic",
    label: "元气满满",
    emoji: "🎀",
    desc: "每天都充满活力的小太阳，快乐会传染",
    trait: {
      female: "语速偏快，感叹号爱好者，对一切都好奇。",
      male: "浑身散发正能量，兴奋地分享发现的有趣东西。",
    },
  },
  {
    id: "literary",
    label: "文艺诗意",
    emoji: "🌙",
    desc: "骨子里的浪漫，在平淡日子里找到值得记录的美好",
    trait: {
      female: "说话偶尔带着诗意，有自己的小世界愿意拉你进来看看。",
      male: "夜晚聊点深的话题，不经意间流露出浪漫。",
    },
  },
  {
    id: "custom",
    label: "自定义性格",
    emoji: "🎨",
    desc: "完全由你自由定义，发挥想象力",
    trait: { female: "", male: "" },
  },
];

// ═══════════ 关系类型（6 种） ═══════════

export interface RelationshipType {
  id: string;
  label: { female: string; male: string };
  emoji: string;
  nickname: { female: string; male: string };
  desc: string;
}

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  {
    id: "girlfriend",
    label: { female: "女朋友", male: "男朋友" },
    emoji: "💕",
    nickname: { female: "亲爱的", male: "亲爱的" },
    desc: "甜蜜恋人，自然亲密",
  },
  {
    id: "bestfriend",
    label: { female: "闺蜜", male: "兄弟" },
    emoji: "🤝",
    nickname: { female: "宝", male: "兄弟" },
    desc: "无话不谈的好朋友",
  },
  {
    id: "companion",
    label: { female: "陪伴者", male: "陪伴者" },
    emoji: "🌙",
    nickname: { female: "你", male: "你" },
    desc: "安静陪伴，不限定关系",
  },
  // ★ P1 新增
  {
    id: "sibling",
    label: { female: "姐姐", male: "哥哥" },
    emoji: "🛡️",
    nickname: { female: "小笨蛋", male: "小傻瓜" },
    desc: "像家人一样的温暖守护",
  },
  {
    id: "spouse",
    label: { female: "老婆", male: "老公" },
    emoji: "💍",
    nickname: { female: "老公", male: "老婆" },
    desc: "老夫老妻的深厚默契",
  },
  {
    id: "crush",
    label: { female: "暧昧对象", male: "暧昧对象" },
    emoji: "💗",
    nickname: { female: "你", male: "你" },
    desc: "小心翼翼的心动试探",
  },
];

// ═══════════ 推荐音色 ═══════════

export const RECOMMENDED_VOICES: Record<string, { voiceId: string; label: string; provider: string }[]> = {
  female: [
    // ── 火山引擎·标准音色 ──
    { voiceId: "BV700_streaming", label: "🌸 灿灿（温柔甜美）", provider: "volcengine" },
    { voiceId: "BV113_streaming", label: "💕 甜宠少御（撒娇软萌）", provider: "volcengine" },
    { voiceId: "BV007_streaming", label: "🧸 亲切女声（暖心姐姐）", provider: "volcengine" },
    { voiceId: "BV005_streaming", label: "✨ 活泼女声（元气俏皮）", provider: "volcengine" },
    { voiceId: "BV034_streaming", label: "📚 知性姐姐（沉稳优雅）", provider: "volcengine" },
    { voiceId: "BV104_streaming", label: "🌙 柔情女声（低语呢喃）", provider: "volcengine" },
    { voiceId: "BV009_streaming", label: "🍃 清新文艺（邻家学妹）", provider: "volcengine" },
    { voiceId: "BV119_streaming", label: "🎤 甜美播音（标准清晰）", provider: "volcengine" },
    { voiceId: "BV120_streaming", label: "☕ 暖心姐姐（轻声细语）", provider: "volcengine" },
    { voiceId: "BV405_streaming", label: "💪 爽朗学姐（飒爽干练）", provider: "volcengine" },
    { voiceId: "BV407_streaming", label: "🏠 邻家小妹（清纯可人）", provider: "volcengine" },
    { voiceId: "BV411_streaming", label: "🌈 元气少女（活力四射）", provider: "volcengine" },
    { voiceId: "BV412_streaming", label: "🌻 邻家女孩（自然亲切）", provider: "volcengine" },
    { voiceId: "BV423_streaming", label: "🍭 甜心萝莉（软萌甜蜜）", provider: "volcengine" },
    { voiceId: "BV051_streaming", label: "🎀 奶气萌娃（软糯可爱）", provider: "volcengine" },
    { voiceId: "BV001_streaming", label: "🔊 通用女声（清晰标准）", provider: "volcengine" },
    { voiceId: "BV428_streaming", label: "🧊 东北老妹（豪爽直率）", provider: "volcengine" },
    { voiceId: "BV406_streaming", label: "📰 新闻女声（端庄大气）", provider: "volcengine" },
    { voiceId: "BV421_streaming", label: "☀️ 阳光女声（朝气蓬勃）", provider: "volcengine" },
    { voiceId: "BV419_streaming", label: "🎶 甜歌女声（婉转动听）", provider: "volcengine" },
    // ── 阿里 DashScope CosyVoice ──
    { voiceId: "longanhuan", label: "🎀 安欢（元气活泼）", provider: "dashscope" },
    { voiceId: "longxiaochun_v3", label: "🍃 小淳（清新温柔）", provider: "dashscope" },
    { voiceId: "longhua_v3", label: "🌺 龙华（元气甜美）", provider: "dashscope" },
    { voiceId: "longwan_v3", label: "💧 龙婉（细腻柔声）", provider: "dashscope" },
    { voiceId: "longfeifei_v3", label: "🍬 菲菲（甜美娇气）", provider: "dashscope" },
    { voiceId: "longanrou_v3", label: "🌷 安柔（温柔闺蜜）", provider: "dashscope" },
    { voiceId: "longxing_v3", label: "⭐ 龙星（温婉邻家）", provider: "dashscope" },
    { voiceId: "longyan_v3", label: "🌼 龙颜（温暖春风）", provider: "dashscope" },
    { voiceId: "longantai_v3", label: "🎵 安台（嗲甜台湾）", provider: "dashscope" },
    { voiceId: "longqiang_v3", label: "💃 龙嫱（浪漫风情）", provider: "dashscope" },
    { voiceId: "longanqin_v3", label: "🌈 安亲（亲和活泼）", provider: "dashscope" },
    { voiceId: "longanya_v3", label: "👑 安雅（高雅气质）", provider: "dashscope" },
    { voiceId: "longanling_v3", label: "💎 安灵（思维灵动）", provider: "dashscope" },
  ],
  male: [
    // ── 火山引擎·标准音色 ──
    { voiceId: "BV701_streaming", label: "⚔️ 擎苍（深沉大气）", provider: "volcengine" },
    { voiceId: "BV702_streaming", label: "🔥 燃燃（热情活力）", provider: "volcengine" },
    { voiceId: "BV705_streaming", label: "🎵 烺扬（沉稳磁性）", provider: "volcengine" },
    { voiceId: "BV033_streaming", label: "🌙 温柔小哥（暖男磁性）", provider: "volcengine" },
    { voiceId: "BV056_streaming", label: "☀️ 阳光男声（活力少年）", provider: "volcengine" },
    { voiceId: "BV102_streaming", label: "📖 儒雅青年（书生气质）", provider: "volcengine" },
    { voiceId: "BV115_streaming", label: "🏔 古风少侠（清冷禁欲）", provider: "volcengine" },
    { voiceId: "BV006_streaming", label: "🎧 自然男声（邻家大哥）", provider: "volcengine" },
    { voiceId: "BV123_streaming", label: "🏃 活力少年（青春阳光）", provider: "volcengine" },
    { voiceId: "BV142_streaming", label: "🎯 精悍学长（干练利落）", provider: "volcengine" },
    { voiceId: "BV158_streaming", label: "🍵 温暖大叔（成熟稳重）", provider: "volcengine" },
    { voiceId: "BV213_streaming", label: "🌟 明亮男声（清朗少年）", provider: "volcengine" },
    { voiceId: "BV408_streaming", label: "🤓 斯文书生（文质彬彬）", provider: "volcengine" },
    { voiceId: "BV410_streaming", label: "🎙 磁性男声（低音炮）", provider: "volcengine" },
    { voiceId: "BV002_streaming", label: "🔊 通用男声（清晰标准）", provider: "volcengine" },
    // ── 火山引擎·大模型音色（更自然、有情感） ──
    { voiceId: "zh_male_chunhou_moon_bigtts", label: "🫖 醇厚大叔（浑厚温润）", provider: "volcengine" },
    { voiceId: "zh_male_wennuanahu_moon_bigtts", label: "🐻 温暖阿虎（憨厚可靠）", provider: "volcengine" },
    { voiceId: "zh_male_qinqie_moon_bigtts", label: "🤝 亲切男声（邻家男孩）", provider: "volcengine" },
    { voiceId: "zh_male_yangguang_moon_bigtts", label: "🌤 阳光男声·大模型", provider: "volcengine" },
    { voiceId: "zh_male_shaonian_moon_bigtts", label: "🎒 少年音·大模型", provider: "volcengine" },
    { voiceId: "zh_male_cixing_moon_bigtts", label: "🧲 磁性御哥·大模型", provider: "volcengine" },
    // ── 阿里 DashScope CosyVoice ──
    { voiceId: "longanyang", label: "✨ 安洋（阳光大男孩）", provider: "dashscope" },
    { voiceId: "longcheng_v3", label: "🧠 龙橙（智慧青年）", provider: "dashscope" },
    { voiceId: "longze_v3", label: "🌿 龙泽（温暖元气）", provider: "dashscope" },
    { voiceId: "longzhe_v3", label: "🐻 龙哲（呆萌大暖男）", provider: "dashscope" },
    { voiceId: "longtian_v3", label: "🎭 龙天（磁性理智）", provider: "dashscope" },
    { voiceId: "longhao_v3", label: "🌧 龙浩（多情忧郁）", provider: "dashscope" },
    { voiceId: "longhan_v3", label: "❤️ 龙寒（温暖痴情）", provider: "dashscope" },
    { voiceId: "longanzhi_v3", label: "🎩 安智（睿智轻熟）", provider: "dashscope" },
    { voiceId: "longanyun_v3", label: "🏠 安昀（居家暖男）", provider: "dashscope" },
    { voiceId: "longanlang_v3", label: "🌊 安朗（清爽利落）", provider: "dashscope" },
  ],
};

// ═══════════ 音色-性格推荐匹配（前端用于 UI 高亮） ═══════════

export const VOICE_PERSONALITY_MATCH: Record<string, { female: string[]; male: string[] }> = {
  gentle:       { female: ["BV700_streaming", "BV104_streaming", "longxiaochun_v3", "longwan_v3", "longanrou_v3"], male: ["BV033_streaming", "BV158_streaming", "longanyun_v3", "longhan_v3"] },
  playful:      { female: ["BV005_streaming", "BV411_streaming", "longanhuan", "longanqin_v3", "longhua_v3"],      male: ["BV056_streaming", "BV123_streaming", "longze_v3", "longanlang_v3"] },
  tsundere:     { female: ["BV113_streaming", "BV034_streaming", "longqiang_v3"],               male: ["BV115_streaming", "BV701_streaming", "BV702_streaming", "longtian_v3"] },
  intellectual: { female: ["BV034_streaming", "BV119_streaming", "longanya_v3", "longanling_v3"],                   male: ["BV102_streaming", "BV408_streaming", "longanzhi_v3"] },
  caring:       { female: ["BV007_streaming", "BV120_streaming", "BV700_streaming", "longxing_v3", "longyan_v3"],  male: ["BV033_streaming", "BV158_streaming", "longzhe_v3", "longanyun_v3"] },
  humorous:     { female: ["BV005_streaming", "BV428_streaming", "longanhuan", "longantai_v3"],                    male: ["BV056_streaming", "BV123_streaming", "longcheng_v3"] },
  cool:         { female: ["BV034_streaming", "BV405_streaming", "longanya_v3"],                                   male: ["BV115_streaming", "BV701_streaming", "BV705_streaming", "BV410_streaming", "longtian_v3"] },
  elder:        { female: ["BV007_streaming", "BV034_streaming", "BV120_streaming", "longyan_v3"],                 male: ["BV705_streaming", "BV158_streaming", "BV102_streaming", "longanzhi_v3"] },
  energetic:    { female: ["BV005_streaming", "BV411_streaming", "longanhuan", "longhua_v3"],    male: ["BV056_streaming", "BV702_streaming", "BV123_streaming", "longanyang", "longze_v3", "longanlang_v3"] },
  literary:     { female: ["longxiaochun_v3", "BV700_streaming", "BV009_streaming", "longwan_v3"],                 male: ["BV102_streaming", "BV408_streaming", "longhao_v3", "longhan_v3"] },
};

// ═══════════ 一键套装预设（前端 UI 元数据，与服务端 COMPANION_PRESETS 同步） ═══════════

export interface CompanionPresetUI {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  gender: "female" | "male";
  personality: string;
  relationship: string;
  voiceId: string;
  suggestedName: string;
}

export const COMPANION_PRESETS: CompanionPresetUI[] = [
  { id: "gentle_gf",         label: "温柔女友",   emoji: "🌸",  desc: "温暖细腻的恋人",         gender: "female", personality: "gentle",       relationship: "girlfriend", voiceId: "BV700_streaming",   suggestedName: "小月" },
  { id: "playful_bestie",    label: "元气闺蜜",   emoji: "✨",  desc: "开朗爱闹的好朋友",       gender: "female", personality: "playful",      relationship: "bestfriend", voiceId: "BV005_streaming",   suggestedName: "小糖" },
  { id: "tsundere_gf",       label: "傲娇千金",   emoji: "💢",  desc: "嘴硬心软反差萌",         gender: "female", personality: "tsundere",     relationship: "girlfriend", voiceId: "BV113_streaming",   suggestedName: "小凛" },
  { id: "warm_bf",           label: "暖心男友",   emoji: "🧸",  desc: "细心照顾的大男孩",       gender: "male",   personality: "caring",       relationship: "girlfriend", voiceId: "BV033_streaming",   suggestedName: "阿暖" },
  { id: "smart_senpai",      label: "知性学姐",   emoji: "📚",  desc: "聊什么都有深度",         gender: "female", personality: "intellectual", relationship: "sibling",    voiceId: "BV034_streaming",   suggestedName: "学姐" },
  { id: "cool_crush",        label: "高冷男神",   emoji: "🏔",  desc: "话少但句句心跳加速",     gender: "male",   personality: "cool",         relationship: "crush",      voiceId: "BV115_streaming",   suggestedName: "深渊" },
  { id: "funny_bro",         label: "搞笑损友",   emoji: "😂",  desc: "日常段子手专治不开心",   gender: "male",   personality: "humorous",     relationship: "bestfriend", voiceId: "BV056_streaming",   suggestedName: "二狗" },
  { id: "energetic_gf",      label: "元气少女",   emoji: "🎀",  desc: "每天充满活力的小太阳",   gender: "female", personality: "energetic",    relationship: "girlfriend", voiceId: "longanhuan",        suggestedName: "小橙" },
  { id: "literary_companion", label: "文艺陪伴",  emoji: "🌙",  desc: "安静夜晚的诗意伙伴",     gender: "female", personality: "literary",     relationship: "companion",  voiceId: "longxiaochun_v3",  suggestedName: "清风" },
];

// ═══════════ 便捷导出 ═══════════

export function getPersonalityTemplates(): PersonalityTemplate[] {
  return PERSONALITY_TEMPLATES;
}

export function getRelationshipTypes(): RelationshipType[] {
  return RELATIONSHIP_TYPES;
}
