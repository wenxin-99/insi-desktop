#!/bin/bash
# install-cjk-font.sh
# 在服务器上安装完整中文字体，修复 PDF 导出缺字问题
# 用法: bash install-cjk-font.sh

set -e

PROJECT_DIR="/www/wwwroot/ai_platform"
FONT_DIR="$PROJECT_DIR/fonts"

echo "=== 安装完整中文字体 ==="

# 方法1: 尝试用系统包管理器安装
if command -v apt-get &>/dev/null; then
  echo "[1] 尝试 apt 安装 fonts-noto-cjk..."
  apt-get update -qq && apt-get install -y fonts-noto-cjk-extra 2>/dev/null || apt-get install -y fonts-noto-cjk 2>/dev/null || true
elif command -v yum &>/dev/null; then
  echo "[1] 尝试 yum 安装 google-noto-sans-cjk-fonts..."
  yum install -y google-noto-sans-cjk-fonts 2>/dev/null || yum install -y google-noto-cjk-fonts-common 2>/dev/null || true
elif command -v dnf &>/dev/null; then
  echo "[1] 尝试 dnf 安装 google-noto-sans-cjk-fonts..."
  dnf install -y google-noto-sans-cjk-fonts 2>/dev/null || true
fi

# 检查系统字体是否已安装成功
SYSTEM_FONT=$(find /usr/share/fonts -name "NotoSansCJK*" -o -name "NotoSansSC*" -o -name "wqy-microhei*" 2>/dev/null | head -1)
if [ -n "$SYSTEM_FONT" ]; then
  echo "[✓] 系统中文字体已存在: $SYSTEM_FONT"
  echo "    代码会自动检测并使用此字体"
  exit 0
fi

# 方法2: 手动下载到项目 fonts 目录
echo "[2] 系统安装失败，手动下载 NotoSansSC 到 $FONT_DIR ..."
mkdir -p "$FONT_DIR"

# 从 Google Fonts GitHub 下载（约 8MB）
FONT_URL="https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
TARGET="$FONT_DIR/NotoSansSC-Regular.ttf"

if [ -f "$TARGET" ]; then
  echo "[✓] 完整字体已存在: $TARGET"
  exit 0
fi

echo "    下载中..."
if command -v wget &>/dev/null; then
  wget -q "$FONT_URL" -O "$TARGET" 2>/dev/null
elif command -v curl &>/dev/null; then
  curl -sL "$FONT_URL" -o "$TARGET" 2>/dev/null
fi

if [ -f "$TARGET" ] && [ "$(stat -f%z "$TARGET" 2>/dev/null || stat -c%s "$TARGET" 2>/dev/null)" -gt 1000000 ]; then
  echo "[✓] 下载成功: $TARGET ($(du -h "$TARGET" | cut -f1))"
  # 复制一份作为 Bold（Variable font 包含所有字重）
  cp "$TARGET" "$FONT_DIR/NotoSansSC-Bold.ttf" 2>/dev/null || true
  echo "[✓] 已复制 Bold 变体"
else
  echo "[!] 下载失败。请手动下载 NotoSansSC-Regular.ttf 到 $FONT_DIR/"
  echo "    下载地址: https://fonts.google.com/noto/specimen/Noto+Sans+SC"
  echo "    或执行: wget -O $TARGET 'https://github.com/notofonts/noto-cjk/releases/download/Sans2.004/08_NotoSansCJKsc.zip'"
  rm -f "$TARGET"
  exit 1
fi

echo ""
echo "=== 完成！重新构建并重启即可 ==="
echo "    cd $PROJECT_DIR && pnpm build && pm2 restart ai_platform"
