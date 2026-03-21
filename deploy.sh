#!/bin/bash
set -euo pipefail
PROJECT="/www/wwwroot/ai_platform"
BACKUP_TS=$(date +%s)
FILES=(
  "server/_core/research/llmCallers.ts"
  "server/_core/research/llmConfig.ts"
  "server/_core/research/agentDecision.ts"
  "server/_core/research/reportGenerator.ts"
  "server/_core/research/sshResolver.ts"
  "server/_core/research/index.ts"
  "server/_core/research/codeact/prompt.ts"
  "server/_core/research/codeact/runner.ts"
  "server/_core/research/codeact/autoVerifier.ts"
  "server/_core/research/codeact/verifierAgent.ts"
  "server/_core/research/codeact/liveVerifier.ts"
  "server/_core/research/codeact/executor.ts"
  "server/_core/research/codeact/envSnapshot.ts"
)
echo "=== SSH Agent v5.1 — Thinking Slot 路由修复 ==="
echo "  ★ Fix: thinking_slot 显式配置时不被路由器覆盖"
echo "  ★ Fix: getResearchLLMConfig 返回 modelSource"
echo "  含: envSnapshot / AutoVerify / LiveVerify / Caching / Thinking"
echo ""
echo "[1/3] 备份..."
for f in "${FILES[@]}"; do
  [ -f "$PROJECT/$f" ] && cp "$PROJECT/$f" "$PROJECT/$f.bak.$BACKUP_TS"
done
echo "[2/3] 部署 ${#FILES[@]} 个文件..."
for f in "${FILES[@]}"; do
  dir=$(dirname "$PROJECT/$f"); mkdir -p "$dir"; cp "$f" "$PROJECT/$f"
done
echo "[3/3] 构建 + 重启..."
cd "$PROJECT" && pnpm run build 2>&1 | tail -5
pm2 restart ai_platform 2>/dev/null || pm2 restart all
echo "=== 完成 ==="
