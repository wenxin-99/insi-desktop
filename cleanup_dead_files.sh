#!/bin/bash
# ═══════════════════════════════════════════
# P1 Fix 6 & 7: 清理死代码 + .bak 文件
# 执行前请确认 git status 干净
# ═══════════════════════════════════════════

echo "=== Fix 6: 删除 research_index.ts（1323行，零引用死代码） ==="
rm -v /www/wwwroot/ai_platform/server/_core/research/research_index.ts

echo ""
echo "=== Fix 7: 删除 .bak / .patch / .backup 残留文件 ==="
rm -v /www/wwwroot/ai_platform/src/pages/admin/AIOpsApprovals.tsx.bak
rm -v /www/wwwroot/ai_platform/src/components/AutomationTaskCard.tsx.bak
rm -v /www/wwwroot/ai_platform/src/hooks/usePassiveSignals.ts.bak
rm -v /www/wwwroot/ai_platform/src/pages/chat/hooks/useStreamCallbacks.file_preview.patch.ts
rm -v /www/wwwroot/ai_platform/src/pages/Chat.tsx.patch.md
rm -v /www/wwwroot/ai_platform/server/api/chat/handlers/artifactHandler.ts.bak
rm -v /www/wwwroot/ai_platform/server/storage.ts.backup

echo ""
echo "✅ 清理完成，共删除 8 个文件"
echo "请执行: cd /www/wwwroot/ai_platform && git add -A && git commit -m 'chore: remove dead code + .bak files'"
