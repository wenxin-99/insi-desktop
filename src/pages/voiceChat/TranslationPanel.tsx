/**
 * TranslationPanel.tsx — 翻译模式选择面板
 *
 * 提供快捷预设（中→英、英→中、口语教练等）和自定义语言对配置。
 * 集成在 VoiceSettingsPanel 中作为可折叠区域。
 */

import { useState } from "react";
import { Languages, ChevronDown, ChevronUp, ArrowRight, GraduationCap, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TranslationConfig,
  type TranslationScenario,
  TRANSLATION_PRESETS,
  SUPPORTED_LANGUAGES,
  getLangLabel,
} from "./translationMode";

interface TranslationPanelProps {
  config: TranslationConfig;
  onChange: (config: TranslationConfig) => void;
}

const SCENARIO_INFO: Record<TranslationScenario, { label: string; icon: typeof Languages }> = {
  off:       { label: "关闭", icon: Languages },
  translate: { label: "实时翻译", icon: ArrowRight },
  coach:     { label: "口语教练", icon: GraduationCap },
  auto:      { label: "自动检测", icon: Globe },
};

export function TranslationPanel({ config, onChange }: TranslationPanelProps) {
  const [expanded, setExpanded] = useState(config.scenario !== "off");
  const [showCustom, setShowCustom] = useState(false);

  const isActive = config.scenario !== "off";
  const activePreset = TRANSLATION_PRESETS.find(
    p => p.config.scenario === config.scenario
      && p.config.sourceLang === config.sourceLang
      && p.config.targetLang === config.targetLang
  );

  return (
    <div className="space-y-2">
      {/* 标题行 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 group"
      >
        <div className="flex items-center gap-2">
          <Languages className={`w-4 h-4 ${isActive ? "text-blue-500" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium">翻译模式</span>
          {isActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium">
              {activePreset?.name || `${getLangLabel(config.sourceLang)} → ${getLangLabel(config.targetLang)}`}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="px-4 space-y-3 animate-in slide-in-from-top-1 duration-150">
          {/* 快捷预设 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {TRANSLATION_PRESETS.map(preset => {
              const isSelected = activePreset?.id === preset.id
                || (preset.id === "off" && config.scenario === "off");

              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onChange(preset.config);
                    setShowCustom(false);
                  }}
                  className={[
                    "flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-center transition-all",
                    "min-w-[80px] hover:scale-[1.02] active:scale-[0.98]",
                    isSelected
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200 dark:ring-blue-800"
                      : "border-border/50 hover:border-border",
                  ].join(" ")}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{preset.name}</span>
                </button>
              );
            })}

            {/* 自定义按钮 */}
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={[
                "flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-center transition-all",
                "min-w-[80px] hover:scale-[1.02] active:scale-[0.98]",
                showCustom && !activePreset && isActive
                  ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/50 ring-1 ring-purple-200"
                  : "border-border/50 hover:border-border",
              ].join(" ")}
            >
              <span className="text-lg">⚙️</span>
              <span className="text-[11px] font-medium leading-tight">自定义</span>
            </button>
          </div>

          {/* 预设描述 */}
          {activePreset && activePreset.id !== "off" && (
            <p className="text-xs text-muted-foreground px-1">
              {activePreset.description}
            </p>
          )}

          {/* 自定义配置 */}
          {showCustom && (
            <div className="space-y-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">模式</label>
                <Select
                  value={config.scenario}
                  onValueChange={(v) => onChange({ ...config, scenario: v as TranslationScenario })}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SCENARIO_INFO) as [TranslationScenario, typeof SCENARIO_INFO[TranslationScenario]][]).map(([key, info]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.scenario !== "off" && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-12">输入</label>
                    <Select
                      value={config.sourceLang}
                      onValueChange={(v) => onChange({ ...config, sourceLang: v })}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.label} {lang.code !== "auto" && `(${lang.nativeName})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-12">输出</label>
                    <Select
                      value={config.targetLang}
                      onValueChange={(v) => onChange({ ...config, targetLang: v })}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.filter(l => l.code !== "auto").map(lang => (
                          <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.label} ({lang.nativeName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* P7: 源语言=目标语言警告 */}
                  {config.sourceLang !== "auto" && config.sourceLang === config.targetLang && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 px-1">
                      ⚠ 输入和输出语言相同，翻译模式不会生效
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
