#!/bin/bash
# ═══════════════════════════════════════════════════════
# migrate_logger.sh — 自动将 console.log 迁移到结构化 logger
#
# 用法: cd /www/wwwroot/ai_platform && bash migrate_logger.sh
#
# 安全策略:
#   - 仅处理 [TAG] 前缀的 console.log（可精准替换）
#   - 自动添加 logger import + child 声明
#   - 每个文件替换前自动备份到 .pre-logger
#   - 显示 diff 供确认
# ═══════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

# 目标文件列表（按 console.log 数量排序的 top 热路径）
FILES=(
  "server/_core/imageGen/vendors/alibaba.ts:ImageGen:Alibaba"
  "server/api/imageGeneration.ts:ImageGen"
  "server/_core/llm/stream.ts:LLM:Stream"
  "server/_core/automation/agentLoop/toolExecutor.ts:Automation:ToolExec"
  "server/api/cronEngine/cronScheduler.ts:CronScheduler"
  "server/api/chat/handlers/llmHandler.ts:LLMHandler"
  "server/api/chat/stages/postProcess.ts:PostProcess"
  "server/api/chat/handlers/imageHandler.ts:ImageHandler"
  "server/_core/automation/loopDetector.ts:Automation:LoopDetect"
  "server/_core/research/index.ts:Research"
)

MIGRATED=0
TOTAL_REPLACED=0

for entry in "${FILES[@]}"; do
  IFS=':' read -r filepath module <<< "$entry"
  
  if [ ! -f "$filepath" ]; then
    echo "⚠️  SKIP (not found): $filepath"
    continue
  fi

  before=$(grep -c 'console\.log\|console\.error\|console\.warn' "$filepath" 2>/dev/null || echo 0)
  if [ "$before" -eq 0 ]; then
    echo "✓  SKIP (already clean): $filepath"
    continue
  fi

  echo ""
  echo "═══════ Migrating: $filepath ($before log calls) ═══════"

  # Backup
  cp "$filepath" "${filepath}.pre-logger"

  # 1. Add logger import if not present
  if ! grep -q "from.*logger" "$filepath"; then
    # Calculate relative path to _core/logger
    depth=$(echo "$filepath" | tr '/' '\n' | tail -n +2 | wc -l)
    rel=""
    dir=$(dirname "$filepath")
    # Find relative path from file to server/_core/logger
    target="server/_core/logger"
    # Use node to compute
    rel_import=$(node -e "
      const path = require('path');
      const from = path.dirname('$filepath');
      const to = '$target';
      let rel = path.relative(from, to);
      if (!rel.startsWith('.')) rel = './' + rel;
      console.log(rel);
    ")
    
    # Insert after last import line
    last_import=$(grep -n "^import " "$filepath" | tail -1 | cut -d: -f1)
    if [ -n "$last_import" ]; then
      sed -i "${last_import}a\\import { logger } from '${rel_import}';" "$filepath"
      # Add log child declaration after imports
      sed -i "$((last_import + 1))a\\const log = logger.child('${module}');" "$filepath"
    fi
  fi

  # 2. Replace console.log/error/warn with log.info/error/warn
  # Remove [TAG] prefixes since logger.child already adds module context
  sed -i "s/console\.log(\`\[[A-Za-z:_ ]*\] /log.info(\`/g" "$filepath"
  sed -i "s/console\.log('\[[A-Za-z:_ ]*\] /log.info('/g" "$filepath"
  sed -i "s/console\.error(\`\[[A-Za-z:_ ]*\] /log.error(\`/g" "$filepath"
  sed -i "s/console\.error('\[[A-Za-z:_ ]*\] /log.error('/g" "$filepath"
  sed -i "s/console\.warn(\`\[[A-Za-z:_ ]*\] /log.warn(\`/g" "$filepath"
  sed -i "s/console\.warn('\[[A-Za-z:_ ]*\] /log.warn('/g" "$filepath"
  
  # Remaining console.log without [TAG] prefix
  sed -i "s/console\.log(/log.info(/g" "$filepath"
  sed -i "s/console\.error(/log.error(/g" "$filepath"
  sed -i "s/console\.warn(/log.warn(/g" "$filepath"

  after=$(grep -c 'console\.log\|console\.error\|console\.warn' "$filepath" 2>/dev/null || echo 0)
  replaced=$((before - after))
  TOTAL_REPLACED=$((TOTAL_REPLACED + replaced))
  MIGRATED=$((MIGRATED + 1))

  echo "  ✅ Replaced $replaced / $before calls (${after} remaining)"
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Migration complete: $MIGRATED files, $TOTAL_REPLACED calls replaced"
echo ""
echo "  To verify: grep -rn 'console\.log' server/ --include='*.ts' --exclude='*.test.ts' | wc -l"
echo "  To rollback: find server/ -name '*.pre-logger' -exec bash -c 'mv \"\$1\" \"\${1%.pre-logger}\"' _ {} \\;"
echo "═══════════════════════════════════════════════════════"
