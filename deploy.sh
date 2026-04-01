#!/bin/bash
# ═══════════════════════════════════════════
# Insi Desktop P0-P5 六阶段部署脚本
# 
# 用法: 在项目根目录执行
#   tar -xzf insi_desktop_p0_p5_full.tar.gz
#   bash deploy.sh
# ═══════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════"
echo " Insi Desktop 六阶段部署 (P0-P5)"
echo " 20 文件 / ~6,000 行"
echo "════════════════════════════════════════"
echo ""

# 检测项目根目录
if [ ! -d "server/_core" ]; then
  echo -e "${RED}错误: 请在项目根目录执行此脚本${NC}"
  echo "  当前目录: $(pwd)"
  echo "  预期存在: server/_core/"
  exit 1
fi

BACKUP_DIR="backups/desktop_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}备份目录: $BACKUP_DIR${NC}"
echo ""

# ═══════ 备份需替换的文件 ═══════
echo "── 步骤 1/4: 备份原文件 ──"
REPLACE_FILES=(
  "server/_core/agentCore/decision/index.ts"
  "server/_core/agentCore/tools/desktop/index.ts"
  "server/_core/agentCore/tools/registry.ts"
  "server/_core/desktopSession/chatHandler.ts"
  "server/_core/desktopSession/enhancedLoop.ts"
)

for f in "${REPLACE_FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
    echo -e "  ${GREEN}✓${NC} 已备份 $f"
  else
    echo -e "  ${YELLOW}⚠${NC} 跳过 $f (不存在)"
  fi
done
echo ""

# ═══════ 新增文件 ═══════
echo "── 步骤 2/4: 部署新增文件 (13 个) ──"
NEW_FILES=(
  "server/_core/agentCore/decision/normalizeDecision.ts"
  "server/_core/agentCore/decision/desktopDeciders.ts"
  "server/_core/agentCore/tools/desktop/p4VisionTools.ts"
  "server/_core/desktopSession/coordinateMapper.ts"
  "server/_core/desktopSession/screenshotDiff.ts"
  "server/_core/desktopSession/stuckDetector.ts"
  "server/_core/desktopSession/deciderLoop.ts"
  "server/_core/desktopSession/plannerV2.ts"
  "server/_core/desktopSession/securityGuard.ts"
  "server/_core/desktopSession/dispatch.ts"
  "server/_core/desktopSession/replay.ts"
  "server/_core/desktopSession/routesV2.ts"
  "server/_core/desktopSession/ecosystem.ts"
)

for f in "${NEW_FILES[@]}"; do
  if [ -f "$f" ]; then
    # 来源是解压后的同名文件
    echo -e "  ${GREEN}✓${NC} 新增 $f"
  else
    echo -e "  ${RED}✗${NC} 缺失 $f"
  fi
done
echo ""

# ═══════ 替换文件 ═══════
echo "── 步骤 3/4: 替换改造文件 (5 个) ──"
for f in "${REPLACE_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}✓${NC} 已替换 $f"
  fi
done
echo ""

# ═══════ PM2 配置 ═══════
echo "── 步骤 4/4: PM2 配置 ──"
if [ -f "ecosystem.config.cjs" ]; then
  echo -e "  ${GREEN}✓${NC} ecosystem.config.cjs 已就位"
else
  echo -e "  ${YELLOW}⚠${NC} ecosystem.config.cjs 未找到"
fi
echo ""

# ═══════ 提示 ═══════
echo "════════════════════════════════════════"
echo -e "${GREEN}部署完成！${NC}"
echo ""
echo "后续步骤:"
echo "  1. 安装可选依赖:    npm install sharp --save"
echo "  2. 注册新路由 (在 Express app 中添加):"
echo "     import desktopRoutesV2 from './_core/desktopSession/routesV2';"
echo "     app.use('/api/desktop', desktopRoutesV2);"
echo ""
echo "  3. 初始化 Dispatch (在 Socket.IO init 后添加):"
echo "     import { initDispatchNamespace } from './_core/desktopSession/dispatch';"
echo "     initDispatchNamespace(io);"
echo ""
echo "  4. 重启:            pm2 restart ecosystem.config.cjs"
echo ""
echo "  5. 回滚:            cp -r $BACKUP_DIR/* ."
echo "════════════════════════════════════════"
