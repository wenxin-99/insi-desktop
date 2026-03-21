//! Insi Desktop Agent
//!
//! AI 桌面控制客户端 — 让 AI 像真人一样操作用户电脑。
//!
//! 架构：
//!   - Tauri 2.0 (Rust 核心 + WebView UI)
//!   - 系统托盘常驻
//!   - WebSocket 连接 insights.ren 服务端
//!   - 截屏 + 鼠标/键盘控制
//!
//! 模块：
//!   screenshot — 跨平台截屏引擎
//!   input     — 鼠标/键盘模拟
//!   protocol  — WebSocket/Socket.IO 通信
//!   safety    — 安全沙箱
//!   state     — 全局应用状态
//!   system    — 系统能力（多显示器、窗口、文件系统）
//!   clipboard — 剪贴板读写

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod input;
mod protocol;
mod safety;
mod screenshot;
mod state;
mod system;

use state::{AppState, ConnectionStatus};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};
use tokio::sync::mpsc;

// ═══════════════════════════════════════════
// Tauri IPC Commands（前端 WebView 调用）
// ═══════════════════════════════════════════

/// 获取当前连接状态
#[tauri::command]
fn get_status(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let status = state.connection_status.read().clone();
    let screen = state.screen_info.read().clone();

    serde_json::json!({
        "connected": matches!(status, ConnectionStatus::Connected),
        "status": format!("{:?}", status),
        "platform": state.platform,
        "osVersion": state.os_version,
        "clientVersion": state.client_version,
        "screen": screen.map(|s| serde_json::json!({
            "width": s.width,
            "height": s.height,
            "scale": s.scale,
        })),
        "authorized": *state.authorized.read(),
    })
}

/// 登录（设置 auth token 并开始连接）
#[tauri::command]
async fn login(
    token: String,
    server_url: Option<String>,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    if token.is_empty() {
        return Err("Token 不能为空".into());
    }

    *state.auth_token.write() = Some(token.clone());

    if let Some(url) = server_url {
        if !url.is_empty() {
            *state.server_url.write() = url;
        }
    }

    *state.should_connect.write() = true;

    Ok(serde_json::json!({
        "success": true,
        "message": "正在连接服务端...",
    }))
}

/// 断开连接
#[tauri::command]
fn disconnect(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.should_connect.write() = false;
    *state.connection_status.write() = ConnectionStatus::Disconnected;
    *state.auth_token.write() = None;
    *state.authorized.write() = false;

    serde_json::json!({
        "success": true,
        "message": "已断开连接",
    })
}

/// 手动截图测试
#[tauri::command]
fn test_screenshot() -> Result<serde_json::Value, String> {
    let result = screenshot::capture_screen(70)?;
    Ok(serde_json::json!({
        "width": result.width,
        "height": result.height,
        "imageSize": result.image_base64.len(),
    }))
}

/// ★ 授权 AI 控制桌面（通过 WebSocket 通知服务端）
#[tauri::command]
fn authorize(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    // 检查是否已连接
    let connected = matches!(*state.connection_status.read(), ConnectionStatus::Connected);
    if !connected {
        return serde_json::json!({
            "success": false,
            "message": "未连接服务端，无法授权",
        });
    }

    // 设置 pending 标志，下次心跳循环中会发送 client_authorize 给服务端
    *state.pending_authorize.write() = true;
    // 同时本地也标记（乐观更新，服务端会通过 permission_update 确认）
    *state.authorized.write() = true;

    log::info!("[Main] User authorized desktop control from client UI");

    serde_json::json!({
        "success": true,
        "message": "已授权，等待服务端确认...",
    })
}

/// ★ 撤销 AI 桌面控制权限
#[tauri::command]
fn revoke(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;

    log::info!("[Main] User revoked desktop control from client UI");

    serde_json::json!({
        "success": true,
        "message": "已撤销授权",
    })
}

/// ★ 紧急停止（Kill Switch）— 立即撤销所有权限
#[tauri::command]
fn kill_switch(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;

    log::warn!("[Main] KILL SWITCH activated! All desktop control revoked.");

    serde_json::json!({
        "success": true,
        "message": "紧急停止已激活，所有操作已终止",
    })
}

// ═══════════════════════════════════════════
// 应用入口
// ═══════════════════════════════════════════

fn main() {
    env_logger::init();

    let app_state = AppState::new();
    let state_for_ws = app_state.clone();

    // WebSocket 关闭信号
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>(1);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            get_status,
            login,
            disconnect,
            test_screenshot,
            authorize,
            revoke,
            kill_switch,
        ])
        .setup(move |app| {
            // ── 系统托盘 ──
            let quit = MenuItem::with_id(app, "quit", "退出 Insi Desktop", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "打开面板", true, None::<&str>)?;
            let status = MenuItem::with_id(app, "status", "状态: 未连接", false, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status, &show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Insi Desktop Agent — 未连接")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            log::info!("Quit requested from tray");
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── 启动 WebSocket 连接线程 ──
            let state_ws = state_for_ws.clone();
            tauri::async_runtime::spawn(async move {
                protocol::connect_and_serve(state_ws, shutdown_rx).await;
            });

            log::info!("[Insi Desktop] App started, waiting for login...");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let _ = shutdown_tx.try_send(());
            }
        });
}
