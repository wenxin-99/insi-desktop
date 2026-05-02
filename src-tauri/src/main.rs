//! Insi Desktop Agent v0.4.4

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

#[tauri::command]
fn get_status(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    let status = state.connection_status.read().clone();
    let screen = state.screen_info.read().clone();
    let task = state.current_task.read().clone();
    let notifications: Vec<_> = state.pending_notifications.write().drain(..).collect();
    serde_json::json!({
        "connected": matches!(status, ConnectionStatus::Connected),
        "status": format!("{:?}", status),
        "platform": state.platform,
        "osVersion": state.os_version,
        "clientVersion": state.client_version,
        "screen": screen.map(|s| serde_json::json!({"width":s.width,"height":s.height,"scale":s.scale})),
        "authorized": *state.authorized.read(),
        "task": task,
        "notifications": notifications,
        "onboardingDone": *state.onboarding_done.read(),
    })
}

#[tauri::command]
async fn login(token: String, server_url: Option<String>, state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    if token.is_empty() { return Err("Token cannot be empty".into()); }
    *state.auth_token.write() = Some(token.clone());
    if let Some(url) = server_url { if !url.is_empty() { *state.server_url.write() = url; } }
    *state.should_connect.write() = true;
    Ok(serde_json::json!({"success":true}))
}

#[tauri::command]
fn disconnect(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.should_connect.write() = false;
    *state.connection_status.write() = ConnectionStatus::Disconnected;
    *state.auth_token.write() = None;
    *state.authorized.write() = false;
    *state.current_task.write() = state::TaskPreview::default();
    serde_json::json!({"success":true})
}

#[tauri::command]
fn test_screenshot() -> Result<serde_json::Value, String> {
    let r = screenshot::capture_screen(70)?;
    Ok(serde_json::json!({"width":r.width,"height":r.height,"imageSize":r.image_base64.len()}))
}

#[tauri::command]
fn authorize(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    if !matches!(*state.connection_status.read(), ConnectionStatus::Connected) {
        return serde_json::json!({"success":false,"message":"not connected"});
    }
    *state.pending_authorize.write() = true;
    *state.authorized.write() = true;
    serde_json::json!({"success":true})
}

#[tauri::command]
fn revoke(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;
    serde_json::json!({"success":true})
}

#[tauri::command]
fn kill_switch(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.authorized.write() = false;
    *state.pending_revoke.write() = true;
    { let mut t = state.current_task.write(); if t.active { t.active = false; t.status = "failed".into(); } }
    serde_json::json!({"success":true})
}

#[tauri::command]
fn check_permissions() -> serde_json::Value {
    let s = permissions::check_all_permissions();
    serde_json::json!({"screenRecording":s.screen_recording,"accessibility":s.accessibility,"allGranted":s.all_granted,"platformRequiresCheck":s.platform_requires_check})
}

#[tauri::command]
fn open_permission_settings(permission_type: String) -> Result<serde_json::Value, String> {
    permissions::open_permission_settings(&permission_type)?;
    Ok(serde_json::json!({"success":true}))
}

#[tauri::command]
fn request_screen_recording() -> serde_json::Value {
    serde_json::json!({"granted": permissions::request_screen_recording()})
}

#[tauri::command]
fn request_accessibility() -> serde_json::Value {
    #[cfg(target_os = "macos")]
    { return serde_json::json!({"granted": permissions::prompt_accessibility()}); }
    #[cfg(not(target_os = "macos"))]
    { serde_json::json!({"granted":true}) }
}

#[tauri::command]
async fn check_network(state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let server_url = state.server_url.read().clone();
    let parsed = url::Url::parse(&server_url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().ok_or_else(|| "cannot resolve host".to_string())?;
    let port = parsed.port_or_known_default().unwrap_or(443);
    let addr = format!("{}:{}", host, port);
    let r = tokio::time::timeout(std::time::Duration::from_secs(5), tokio::net::TcpStream::connect(&addr)).await;
    match r {
        Ok(Ok(_)) => Ok(serde_json::json!({"reachable":true,"server":server_url})),
        Ok(Err(e)) => Ok(serde_json::json!({"reachable":false,"message":format!("{}",e)})),
        Err(_) => Ok(serde_json::json!({"reachable":false,"message":"timeout"})),
    }
}

#[tauri::command]
fn complete_onboarding(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    *state.onboarding_done.write() = true;
    serde_json::json!({"success":true})
}

#[tauri::command]
fn get_history(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    serde_json::json!({"records": state.operation_history.read().clone()})
}

#[tauri::command]
fn clear_history(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    state.operation_history.write().clear();
    serde_json::json!({"success":true})
}

#[tauri::command]
fn get_settings(state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    serde_json::json!({"permissionLevel": state.permission_level.read().clone(), "onboardingDone": *state.onboarding_done.read()})
}

#[tauri::command]
fn set_permission_level(level: String, state: tauri::State<Arc<AppState>>) -> serde_json::Value {
    if !matches!(level.as_str(), "standard"|"cautious"|"restricted") {
        return serde_json::json!({"success":false});
    }
    *state.permission_level.write() = level.clone();
    serde_json::json!({"success":true,"level":level})
}

/// 初始化崩溃日志
fn init_crash_logging() {
    let log_dir = dirs::data_local_dir()
        .map(|d| d.join("InsiDesktop").join("logs"))
        .unwrap_or_else(|| std::path::PathBuf::from("./insi-desktop-logs"));
    let _ = std::fs::create_dir_all(&log_dir);

    let log_file = log_dir.join(format!(
        "insi-desktop-{}.log",
        chrono::Local::now().format("%Y%m%d")
    ));

    let target = std::fs::OpenOptions::new()
        .create(true).append(true).open(&log_file).ok();

    let mut builder = env_logger::Builder::new();
    builder.filter_level(log::LevelFilter::Info)
        .parse_env("RUST_LOG")
        .format_timestamp_millis();
    if let Some(file) = target {
        builder.target(env_logger::Target::Pipe(Box::new(file)));
    }
    let _ = builder.try_init();

    let crash_log = log_dir.join("crash.log");
    std::panic::set_hook(Box::new(move |info| {
        let location = info.location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".into());
        let payload = info.payload().downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| format!("{:?}", info.payload()));

        let msg = format!(
            "[{}] PANIC at {}
  payload: {}
  version: {}
  os: {}

",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            location, payload,
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
        );
        let _ = std::fs::OpenOptions::new()
            .create(true).append(true).open(&crash_log)
            .and_then(|mut f| { use std::io::Write; f.write_all(msg.as_bytes()) });
        eprintln!("{}", msg);
    }));

    log::info!("[Insi Desktop] Boot v{} on {} - log dir: {}",
        env!("CARGO_PKG_VERSION"), std::env::consts::OS, log_dir.display());
}

fn main() {
    init_crash_logging();
    let app_state = AppState::new();
    let state_for_ws = app_state.clone();
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>(1);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            get_status, login, disconnect, test_screenshot, authorize, revoke, kill_switch,
            check_permissions, open_permission_settings, request_screen_recording, request_accessibility,
            check_network, complete_onboarding, get_history, clear_history, get_settings, set_permission_level,
        ])
        .setup(move |app| {
            let si = MenuItem::with_id(app, "status", "Status: Disconnected", false, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Open Panel", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "Pause Control", true, None::<&str>)?;
            let upd = MenuItem::with_id(app, "check_update", "Check Update", true, None::<&str>)?;
            let s1 = PredefinedMenuItem::separator(app)?;
            let s2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&si, &s1, &show, &pause, &s2, &upd, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Insi Desktop Agent")
                .on_menu_event(move |app: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); } }
                        "pause" => {
                            let st = app.state::<Arc<AppState>>();
                            if *st.authorized.read() { *st.authorized.write() = false; *st.pending_revoke.write() = true; }
                            else if matches!(*st.connection_status.read(), ConnectionStatus::Connected) { *st.pending_authorize.write() = true; *st.authorized.write() = true; }
                        }
                        "check_update" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); let _ = w.eval("if(typeof checkForUpdate==='function')checkForUpdate()"); } }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
                    }
                })
                .build(app)?;

            let mw = app.get_webview_window("main").unwrap();
            let wc = mw.clone();
            mw.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); let _ = wc.hide(); }
            });

            let sws = state_for_ws.clone();
            tauri::async_runtime::spawn(async move { protocol::connect_and_serve(sws, shutdown_rx).await; });
            log::info!("[Insi Desktop] Started v{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build app")
        .run(move |_h, event| { if let RunEvent::ExitRequested { .. } = event { let _ = shutdown_tx.try_send(()); } });
}
