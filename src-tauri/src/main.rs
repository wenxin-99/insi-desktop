//! Insi Desktop Agent v0.4.3
//!
//! AI 桌面控制客户端 — 让 AI 像真人一样操作用户电脑。
//!
//! 模块：
//!   screenshot   — 跨平台截屏引擎
//!   input        — 鼠标/键盘模拟
//!   protocol     — WebSocket/Socket.IO 通信
//!   safety       — 安全沙箱
//!   state        — 全局应用状态
//!   system       — 系统能力
//!   clipboard    — 剪贴板读写
//!   permissions  — macOS 权限检测与引导

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod input;
mod permissions;
mod protocol;
mod safety;
mod screenshot;
mod state;
mod system;

use state::{AppState, ConnectionStatus};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent,
};
use tokio::sync::mpsc;

// ═══════════════════════════════════════════
// Tauri IPC Commands
// ═══════════════════════════════════════════

#[tauri::command]
fn get_status(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let status = state.connection_status.read().clone();
    let screen = state.screen_info.read().clone();
    let task = state.current_task.read().clone();

    // 弹出待推送的通知（取出后清空）
    let notifications: Vec<_> = {
        let mut q = state.pending_notifications.write();
        q.drain(..).collect()
    };

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
        "task": task,
        "notifications": notifications,
        "onboardingDone": *state.onboarding_done.read(),
    })
}

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

#[tauri::command]
fn disconnect(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.should_connect.write() = false;
    *state.connection_status.write() = ConnectionStatus::Disconnected;
    *state.auth_token.write() = None;
    *state.authorized.write() = false;
    // 重置任务预览
    *state.current_task.write() = state::TaskPreview::default();

    serde_json::json!({ "success": true, "message": "已断开连接" })
}

#[tauri::command]
fn test_screenshot() -> Result<serde_json::Value, String> {
    let result = screenshot::capture_screen(70)?;
    Ok(serde_json::json!({
        "width": result.width,
        "height": result.height,
        "imageSize": result.image_base64.len(),
    }))
}

#[tauri::command]
fn authorize(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let connected = matches!(*state.connection_status.read(), ConnectionStatus::Connected);
    if !connected {
        return serde_json::json!({ "success": false, "message": "未连接服务端，无法授权" });
    }
    *state.pending_authorize.write() = true;
    *state.authorized.write() = true;
    log::info!("[Main] User authorized desktop control from client UI");
    serde_json::json!({ "success": true, "message": "已授权，等待服务端确认..." })
}

#[tauri::command]
fn revoke(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;
    log::info!("[Main] User revoked desktop control from client UI");
    serde_json::json!({ "success": true, "message": "已撤销授权" })
}

#[tauri::command]
fn kill_switch(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;
    // 终止当前任务
    {
        let mut task = state.current_task.write();
        if task.active {
            task.active = false;
            task.status = "failed".into();
        }
    }
    log::warn!("[Main] KILL SWITCH activated! All desktop control revoked.");
    serde_json::json!({ "success": true, "message": "紧急停止已激活，所有操作已终止" })
}

// ═══════════════════════════════════════════
// macOS 权限检测
// ═══════════════════════════════════════════

#[tauri::command]
fn check_permissions() -> serde_json::Value {
    let status = permissions::check_all_permissions();
    serde_json::json!({
        "screenRecording": status.screen_recording,
        "accessibility": status.accessibility,
        "allGranted": status.all_granted,
        "platformRequiresCheck": status.platform_requires_check,
    })
}

#[tauri::command]
fn open_permission_settings(permission_type: String) -> Result<serde_json::Value, String> {
    permissions::open_permission_settings(&permission_type)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn request_screen_recording() -> serde_json::Value {
    let granted = permissions::request_screen_recording();
    serde_json::json!({ "granted": granted })
}

#[tauri::command]
fn request_accessibility() -> serde_json::Value {
    #[cfg(target_os = "macos")]
    {
        let granted = permissions::prompt_accessibility();
        return serde_json::json!({ "granted": granted });
    }
    #[cfg(not(target_os = "macos"))]
    {
        serde_json::json!({ "granted": true })
    }
}

// ═══════════════════════════════════════════
// ★ 网络连通性检测
// ═══════════════════════════════════════════

#[tauri::command]
async fn check_network(state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let server_url = state.server_url.read().clone();
    let health_url = format!("{}/api/health", server_url);

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        async {
            // 简单 TCP 连接测试
            let url_parsed = url::Url::parse(&health_url).map_err(|e| e.to_string())?;
            let host = url_parsed.host_str().ok_or_else(|| "无法解析主机名".to_string())?;
            let port = url_parsed.port_or_known_default().unwrap_or(443);
            let addr = format!("{}:{}", host, port);

            match tokio::net::TcpStream::connect(&addr).await {
                Ok(_) => Ok(serde_json::json!({
                    "reachable": true,
                    "server": server_url,
                    "message": "服务端可达",
                })),
                Err(e) => Ok(serde_json::json!({
                    "reachable": false,
                    "server": server_url,
                    "message": format!("无法连接: {}", e),
                    "hint": "请检查网络连接或防火墙设置",
                })),
            }
        }
    ).await;

    match result {
        Ok(Ok(json)) => Ok(json),
        Ok(Err(e)) => Ok(serde_json::json!({
            "reachable": false,
            "message": format!("检测失败: {}", e),
        })),
        Err(_) => Ok(serde_json::json!({
            "reachable": false,
            "message": "连接超时（5秒）",
            "hint": "网络可能不通畅，请稍后重试",
        })),
    }
}

// ═══════════════════════════════════════════
// ★ 新手引导状态
// ═══════════════════════════════════════════

#[tauri::command]
fn complete_onboarding(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.onboarding_done.write() = true;
    serde_json::json!({ "success": true })
}

// ═══════════════════════════════════════════
// ★ 操作历史
// ═══════════════════════════════════════════

#[tauri::command]
fn get_history(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let history = state.operation_history.read().clone();
    serde_json::json!({ "records": history })
}

#[tauri::command]
fn clear_history(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    state.operation_history.write().clear();
    serde_json::json!({ "success": true })
}

// ═══════════════════════════════════════════
// ★ 权限级别设置
// ═══════════════════════════════════════════

#[tauri::command]
fn get_settings(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    serde_json::json!({
        "permissionLevel": state.permission_level.read().clone(),
        "onboardingDone": *state.onboarding_done.read(),
    })
}

#[tauri::command]
fn set_permission_level(level: String, state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    if !matches!(level.as_str(), "standard" | "cautious" | "restricted") {
        return serde_json::json!({ "success": false, "message": "无效的权限级别" });
    }
    *state.permission_level.write() = level.clone();
    log::info!("[Main] Permission level set to: {}", level);
    serde_json::json!({ "success": true, "level": level })
}

// ═══════════════════════════════════════════
// 应用入口
// ═══════════════════════════════════════════

fn main() {
    env_logger::init();

    let app_state = AppState::new();
    let state_for_ws = app_state.clone();

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
            check_permissions,
            open_permission_settings,
            request_screen_recording,
            request_accessibility,
            check_network,
            complete_onboarding,
            get_history,
            clear_history,
            get_settings,
            set_permission_level,
        ])
        .setup(move |app| {
            // ── 系统托盘（扩展菜单） ──
            let status_item = MenuItem::with_id(app, "status", "状态: 未连接", false, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "打开面板", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "暂停控制", true, None::<&str>)?;
            let check_update = MenuItem::with_id(app, "check_update", "检查更新", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出 Insi Desktop", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &status_item,
                &separator,
                &show,
                &pause,
                &separator2,
                &check_update,
                &quit,
            ])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Insi Desktop Agent — 未连接")
                .on_menu_event(move |app: &tauri::AppHandle, event| {
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
                        "pause" => {
                            let st = app.state::<Arc<AppState>>();
                            let currently_authorized = *st.authorized.read();
                            if currently_authorized {
                                *st.authorized.write() = false;
                                *st.pending_revoke.write() = true;
                                log::info!("[Tray] Paused desktop control");
                            } else {
                                // 恢复前检查连接状态
                                let connected = matches!(
                                    *st.connection_status.read(),
                                    ConnectionStatus::Connected
                                );
                                if connected {
                                    *st.pending_authorize.write() = true;
                                    *st.authorized.write() = true;
                                    log::info!("[Tray] Resumed desktop control");
                                } else {
                                    log::warn!("[Tray] Cannot resume: not connected");
                                }
                            }
                        }
                        "check_update" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                // 通知前端触发更新检查
                                let _ = window.eval("if(typeof checkForUpdate==='function')checkForUpdate()");
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
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

            // ── 关闭窗口时隐藏到托盘 ──
            let main_window = app.get_webview_window("main").unwrap();
            let win_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_clone.hide();
                    log::info!("[Main] Window hidden to tray");
                }
            });

            // ── 启动 WebSocket 连接线程 ──
            let state_ws = state_for_ws.clone();
            tauri::async_runtime::spawn(async move {
                protocol::connect_and_serve(state_ws, shutdown_rx).await;
            });

            // ── ★ 托盘状态更新循环 ──
            let tray_state = app_state.clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                update_tray_loop(tray_state, app_handle).await;
            });

            log::info!("[Insi Desktop] App started v{}", env!("CARGO_PKG_VERSION"));
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

// ═══════════════════════════════════════════
// ★ 托盘状态更新循环
// ═══════════════════════════════════════════

async fn update_tray_loop(state: Arc<AppState>, app: tauri::AppHandle) {
    let mut last_status = String::new();

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;

        let conn = state.connection_status.read().clone();
        let auth = *state.authorized.read();
        let task_active = state.current_task.read().active;

        let status_str = format!("{:?}", conn);
        let tooltip_key = format!("{}-{}-{}", status_str, auth, task_active);

        if tooltip_key == last_status {
            continue;
        }
        last_status = tooltip_key;

        let tooltip = match conn {
            ConnectionStatus::Connected => {
                if task_active { "Insi Desktop — AI 正在操作" }
                else if auth { "Insi Desktop — 已连接 (已授权)" }
                else { "Insi Desktop — 已连接 (未授权)" }
            }
            ConnectionStatus::Connecting | ConnectionStatus::Reconnecting => {
                "Insi Desktop — 连接中..."
            }
            ConnectionStatus::Disconnected => "Insi Desktop — 未连接",
        };

        // 通过 tray_by_id 更新 tooltip
            let _ = tray.set_tooltip(Some(tooltip));
        }
    }
}
