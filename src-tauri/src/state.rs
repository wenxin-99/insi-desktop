//! 全局应用状态
//!
//! 使用 parking_lot::RwLock 实现线程安全的共享状态。
//! Tauri commands 和 WebSocket 线程都会读写此状态。

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::oneshot;

/// 连接状态
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
}

/// 服务端配置（从 server_message type=config 接收）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub screenshot_quality: u8,
    pub screenshot_format: String,
    pub max_steps: u32,
    pub heartbeat_interval: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            screenshot_quality: 70,
            screenshot_format: "webp".into(),
            max_steps: 100,
            heartbeat_interval: 30_000,
        }
    }
}

/// 屏幕信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

/// 操作步骤记录（用于实时预览面板）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStep {
    /// 步骤序号
    pub index: u32,
    /// 工具名 (desktop.click / desktop.type / ...)
    pub tool: String,
    /// 操作描述
    pub description: String,
    /// 执行状态: pending / running / success / failed
    pub status: String,
    /// 时间戳 (ms)
    pub timestamp: i64,
    /// 错误信息
    pub error: Option<String>,
}

/// 任务预览状态（用于前端实时预览面板）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPreview {
    /// 任务是否活跃
    pub active: bool,
    /// 任务目标描述
    pub goal: String,
    /// 当前步骤索引（从 1 开始）
    pub current_step: u32,
    /// 总步骤数（可能随时增加）
    pub total_steps: u32,
    /// 任务状态: idle / running / paused / completed / failed
    pub status: String,
    /// 最近截图的 base64（缩略图，用于预览）
    pub latest_screenshot: Option<String>,
    /// 截图宽高
    pub screenshot_width: Option<u32>,
    pub screenshot_height: Option<u32>,
    /// 操作步骤历史
    pub steps: Vec<TaskStep>,
    /// 开始时间
    pub started_at: Option<i64>,
}

impl Default for TaskPreview {
    fn default() -> Self {
        Self {
            active: false,
            goal: String::new(),
            current_step: 0,
            total_steps: 0,
            status: "idle".into(),
            latest_screenshot: None,
            screenshot_width: None,
            screenshot_height: None,
            steps: Vec::new(),
            started_at: None,
        }
    }
}

/// 全局应用状态
#[derive(Debug)]
pub struct AppState {
    /// 服务端连接 URL
    pub server_url: RwLock<String>,
    /// 用户认证 token
    pub auth_token: RwLock<Option<String>>,
    /// 连接状态
    pub connection_status: RwLock<ConnectionStatus>,
    /// 服务端下发的配置
    pub server_config: RwLock<ServerConfig>,
    /// 屏幕信息
    pub screen_info: RwLock<Option<ScreenInfo>>,
    /// 当前操作系统
    pub platform: String,
    /// OS 版本
    pub os_version: String,
    /// 客户端版本
    pub client_version: String,
    /// 是否已获得用户授权（服务端确认的权限状态）
    pub authorized: RwLock<bool>,
    /// 控制 WebSocket 连接生命周期
    pub should_connect: RwLock<bool>,
    /// 客户端请求授权标记（由 IPC authorize 命令设置，心跳循环中发送给服务端）
    pub pending_authorize: RwLock<bool>,
    /// 客户端请求撤销标记
    pub pending_revoke: RwLock<bool>,
    /// ★ 当前任务预览状态（操作实时预览面板）
    pub current_task: RwLock<TaskPreview>,
    /// ★ 待推送的系统通知队列
    pub pending_notifications: RwLock<Vec<PendingNotification>>,
    /// ★ 是否已完成新手引导
    pub onboarding_done: RwLock<bool>,
    /// ★ 操作历史记录（最近 100 条）
    pub operation_history: RwLock<Vec<OperationRecord>>,
    /// ★ 权限级别: standard / cautious / restricted
    pub permission_level: RwLock<String>,
    /// ★ v0.7.0 desktop.shell_exec 审批请求队列
    /// key = action_id; 待用户在前端审批的命令信息
    pub pending_shell_approvals: RwLock<Vec<ShellApprovalRequest>>,
    /// ★ v0.7.0 等待用户响应的 oneshot 发送端
    /// 当前端调 respond_shell_approval 时,通过此 channel 把结果送回 protocol 循环
    pub shell_approval_responders: RwLock<HashMap<String, oneshot::Sender<bool>>>,

    // ═══════════════════════════════════════════
    // ★ v0.8.0 双向中断 / 接管交还
    //   main.rs 的 desktop_interrupt / desktop_handback / kill_switch 写入这些字段,
    //   protocol tick 循环消费 pending_interrupts / pending_handback 并发给服务端。
    // ═══════════════════════════════════════════
    /// 用户是否处于手动接管态(AI 暂停下发操作)
    pub in_takeover: RwLock<bool>,
    /// agent 是否在等待用户(暂停态)
    pub agent_awaiting: RwLock<bool>,
    /// 待发送给服务端的中断请求队列(协议 tick 循环消费后清空)
    pub pending_interrupts: RwLock<Vec<ClientInterruptRequest>>,
    /// 待发送的"交还控制"标记
    pub pending_handback: RwLock<bool>,

    // ═══════════════════════════════════════════
    // ★ v0.8.0 安全与可靠性
    // ═══════════════════════════════════════════
    /// 用户的授权意图(true = 用户在本地点了"授权控制")。
    /// 用于阻止 heartbeat_ack / permission_update 把 authorized 从 false 悄悄升为 true——
    /// 服务端只能"降级"(撤销)本地授权,"升级"必须用户显式操作。
    pub authorize_intent: RwLock<bool>,
    /// 动作幂等缓存:action_id → 已发送过的结果 JSON。
    /// 防止服务端在 ack 丢失后重试同一 action_id 导致点击/输入被重复执行。
    pub executed_actions: RwLock<HashMap<String, serde_json::Value>>,
    /// 幂等缓存的 FIFO 淘汰顺序(上限见 protocol::ACTION_CACHE_CAP)
    pub executed_order: RwLock<VecDeque<String>>,

    /// ★ v0.8.0 Tauri AppHandle(在 setup 中注入)。
    /// 供协议层在收到 shell 审批时把窗口弹到前台、发系统通知、触发检查更新。
    pub app_handle: RwLock<Option<tauri::AppHandle>>,
}

/// ★ v0.8.0 桌面端主动中断请求(插话 / 暂停 / 恢复 / 接管 / 中止)。
/// 由 IPC 命令 desktop_interrupt 产生,协议循环下一 tick 通过 client_interrupt 事件发给服务端。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInterruptRequest {
    /// steer | pause | resume | takeover | abort
    pub kind: String,
    /// steer(插话)时携带的文本
    pub text: Option<String>,
    /// 请求时间戳(ms)
    pub requested_at: i64,
}

/// 系统通知（供前端轮询取出并推送）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingNotification {
    pub title: String,
    pub body: String,
    /// info / success / warning / error
    pub level: String,
    pub timestamp: i64,
}

/// 操作历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationRecord {
    /// 任务目标
    pub goal: String,
    /// 任务状态: completed / failed
    pub status: String,
    /// 步骤数
    pub step_count: u32,
    /// 开始时间 (ms)
    pub started_at: i64,
    /// 结束时间 (ms)
    pub ended_at: i64,
    /// 耗时（秒）
    pub duration_secs: f64,
}

/// ★ v0.7.0 shell_exec 审批请求 — 给前端弹模态框用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellApprovalRequest {
    /// 与 server action_id 一致,前端 respond_shell_approval 时回传
    pub action_id: String,
    /// 要执行的命令(单行或多行)
    pub command: String,
    /// LLM 给的执行原因(展示给用户判断)
    pub reason: String,
    /// 工作目录(可选,空则用 home)
    pub work_dir: Option<String>,
    /// 超时(ms)
    pub timeout_ms: u64,
    /// 请求时间戳(ms),前端可显示"5 秒前请求"
    pub requested_at: i64,
}

impl AppState {
    pub fn new() -> Arc<Self> {
        let _sys = sysinfo::System::new_all();
        let os_version = sysinfo::System::long_os_version()
            .unwrap_or_else(|| "unknown".into());

        let platform = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        };

        Arc::new(Self {
            server_url: RwLock::new("https://insights.ren".into()),
            auth_token: RwLock::new(None),
            connection_status: RwLock::new(ConnectionStatus::Disconnected),
            server_config: RwLock::new(ServerConfig::default()),
            screen_info: RwLock::new(None),
            platform: platform.into(),
            os_version,
            client_version: env!("CARGO_PKG_VERSION").into(),
            authorized: RwLock::new(false),
            should_connect: RwLock::new(false),
            pending_authorize: RwLock::new(false),
            pending_revoke: RwLock::new(false),
            current_task: RwLock::new(TaskPreview::default()),
            pending_notifications: RwLock::new(Vec::new()),
            onboarding_done: RwLock::new(false),
            operation_history: RwLock::new(Vec::new()),
            permission_level: RwLock::new("standard".into()),
            pending_shell_approvals: RwLock::new(Vec::new()),
            shell_approval_responders: RwLock::new(HashMap::new()),
            // ★ v0.8.0 中断 / 接管
            in_takeover: RwLock::new(false),
            agent_awaiting: RwLock::new(false),
            pending_interrupts: RwLock::new(Vec::new()),
            pending_handback: RwLock::new(false),
            // ★ v0.8.0 安全与可靠性
            authorize_intent: RwLock::new(false),
            executed_actions: RwLock::new(HashMap::new()),
            executed_order: RwLock::new(VecDeque::new()),
            app_handle: RwLock::new(None),
        })
    }
}
