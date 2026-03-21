# Insi Desktop Agent — Tauri 桌面客户端

AI 桌面控制客户端，让 AI 像真人一样操作用户电脑。

## 架构

```
insi-desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          ← 应用入口，Tauri setup，系统托盘
│   │   ├── state.rs         ← 全局共享状态
│   │   ├── screenshot/      ← 跨平台截屏引擎 (xcap)
│   │   ├── input/           ← 鼠标/键盘模拟 (enigo)
│   │   ├── protocol/        ← WebSocket/Socket.IO 通信
│   │   └── safety/          ← 客户端侧安全沙箱
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/               ← 应用图标（需生成）
├── src/
│   └── index.html           ← 前端 UI（登录+状态面板）
└── package.json
```

## 前置要求

### 所有平台
- Rust 1.77+  (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node.js 18+

### Windows
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (Windows 10+ 自带)

### macOS
- Xcode Command Line Tools (`xcode-select --install`)
- 首次运行需授权：系统偏好设置 → 隐私与安全 → 屏幕录制 / 辅助功能

### Linux
- `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
- X11 或 Wayland (PipeWire)

## 开发

```bash
# 安装 Tauri CLI
npm install

# 开发模式（热重载）
npm run dev

# 构建发行版
npm run build
```

## 通信协议

客户端通过 Socket.IO 连接服务端 `/desktop` 命名空间。

### 客户端 → 服务端

| 事件 | 数据 | 描述 |
|------|------|------|
| `client_auth` | `{ platform, screenWidth, screenHeight, scale, osVersion, clientVersion }` | 注册客户端 |
| `client_screenshot` | `{ image: base64, width, height, timestamp }` | 返回截图 |
| `client_action_result` | `{ actionId, success, error? }` | 返回操作结果 |
| `client_heartbeat` | `{}` | 心跳 |
| `client_error` | `{ code, message }` | 报告错误 |

### 服务端 → 客户端

| 事件 | 数据 | 描述 |
|------|------|------|
| `server_message` type=`request_screenshot` | `{ region? }` | 请求截图 |
| `server_message` type=`execute_action` | `{ tool, params }` + `actionId` | 执行操作 |
| `server_message` type=`cancel` | — | 取消操作 |
| `server_message` type=`config` | `{ screenshotQuality, maxSteps, ... }` | 下发配置 |

### 支持的工具

| 工具 | 参数 |
|------|------|
| `desktop.click` | `{ x, y, button? }` |
| `desktop.double_click` | `{ x, y }` |
| `desktop.drag` | `{ fromX, fromY, toX, toY }` |
| `desktop.type` | `{ text }` |
| `desktop.hotkey` | `{ keys: string[] }` |
| `desktop.scroll` | `{ x, y, delta }` |
| `desktop.screenshot` | `{ region? }` |
| `desktop.wait` | `{ ms }` |

## 安全机制

### 客户端侧（第一层）
- 系统保护区域检测（任务栏、菜单栏、系统托盘）
- 危险快捷键拦截 (Ctrl+Alt+Del 等)
- 敏感文字检测（密码格式）
- 操作日志记录

### 服务端 AI 层（第二层）
- System Prompt 硬编码禁区
- 破坏性操作用户确认
- 每步截图验证

### 服务端系统层（第三层）
- 操作频率限流 (200ms/操作)
- 步数上限 (100步)
- 鱼币扣费

## 图标生成

需要准备以下图标文件到 `src-tauri/icons/`:

```bash
# 使用 Tauri 内置的图标生成器
npx @tauri-apps/cli icon src-tauri/icons/app-icon.png
```

需要的图标：
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `tray-icon.png` (22x22 或 32x32，系统托盘)
