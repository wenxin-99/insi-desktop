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
        })
    }
}
