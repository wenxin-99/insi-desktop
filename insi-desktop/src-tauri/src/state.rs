//! 全局应用状态
//!
//! 使用 parking_lot::RwLock 实现线程安全的共享状态。
//! Tauri commands 和 WebSocket 线程都会读写此状态。

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

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
        })
    }
}
