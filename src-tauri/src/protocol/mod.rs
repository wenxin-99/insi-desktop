//! WebSocket 协议层
//!
//! 使用 rust_socketio 连接服务端的 /desktop Socket.IO 命名空间。
//!
//! 通信流程：
//!   1. 连接 wss://insights.ren/socket.io (namespace: /desktop)
//!   2. 发送 client_auth 事件注册
//!   3. 监听 server_message 事件
//!   4. 根据 server_message.type 执行对应操作
//!   5. 将结果通过 client_screenshot / client_action_result 返回

use crate::input;
use crate::safety;
use crate::screenshot;
use crate::state::{AppState, ConnectionStatus};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// 服务端发来的消息
#[derive(Debug, Clone, Deserialize)]
pub struct ServerMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(rename = "actionId")]
    pub action_id: Option<String>,
    pub payload: Option<serde_json::Value>,
}

/// 操作结果
#[derive(Debug, Serialize)]
struct ActionResult {
    #[serde(rename = "actionId")]
    action_id: String,
    success: bool,
    error: Option<String>,
}

/// 连接并维持 WebSocket
pub async fn connect_and_serve(
    state: Arc<AppState>,
    mut shutdown_rx: mpsc::Receiver<()>,
) {
    loop {
        // 检查是否应该连接
        if !*state.should_connect.read() {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        }

        let token = state.auth_token.read().clone();
        if token.is_none() {
            log::warn!("[Protocol] No auth token, waiting...");
            tokio::time::sleep(Duration::from_secs(3)).await;
            continue;
        }
        let token = token.unwrap();
        let server_url = state.server_url.read().clone();

        log::info!("[Protocol] Connecting to {}...", server_url);
        *state.connection_status.write() = ConnectionStatus::Connecting;

        match try_connect(&server_url, &token, state.clone()).await {
            Ok(()) => {
                log::info!("[Protocol] Connection closed normally");
            }
            Err(e) => {
                log::error!("[Protocol] Connection error: {}", e);
            }
        }

        *state.connection_status.write() = ConnectionStatus::Disconnected;

        // 检查是否收到 shutdown 信号
        if shutdown_rx.try_recv().is_ok() {
            log::info!("[Protocol] Shutdown signal received");
            break;
        }

        // 重连延迟
        if *state.should_connect.read() {
            *state.connection_status.write() = ConnectionStatus::Reconnecting;
            log::info!("[Protocol] Reconnecting in 5 seconds...");
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

/// 尝试建立连接
async fn try_connect(
    server_url: &str,
    token: &str,
    state: Arc<AppState>,
) -> Result<(), String> {
    // 使用 rust_socketio 的异步客户端
    use rust_socketio::{
        asynchronous::{Client, ClientBuilder},
        Payload,
    };

    let state_clone = state.clone();
    let state_for_msg = state.clone();

    // 构建 Socket.IO 连接
    let client = ClientBuilder::new(server_url)
        .namespace("/desktop")
        .auth(json!({ "token": token }))
        .on("server_message", move |payload: Payload, client: Client| {
            let st = state_for_msg.clone();
            Box::pin(async move {
                if let Payload::Text(values) = payload {
                    if let Some(first) = values.first() {
                        if let Ok(msg) = serde_json::from_value::<ServerMessage>(first.clone()) {
                            handle_server_message(msg, &client, st).await;
                        }
                    }
                }
            })
        })
        .on("error", |err, _| {
            Box::pin(async move {
                log::error!("[Protocol] Socket.IO error: {:?}", err);
            })
        })
        .on("open", move |_, client: Client| {
            let st = state_clone.clone();
            Box::pin(async move {
                log::info!("[Protocol] Connected! Sending client_auth...");
                *st.connection_status.write() = ConnectionStatus::Connected;

                // 获取屏幕信息
                let (width, height, scale) = screenshot::get_primary_monitor()
                    .unwrap_or((1920, 1080, 1.0));

                *st.screen_info.write() = Some(crate::state::ScreenInfo {
                    width,
                    height,
                    scale,
                });

                // 发送认证信息
                let auth_data = json!({
                    "platform": st.platform,
                    "screenWidth": width,
                    "screenHeight": height,
                    "scale": scale,
                    "osVersion": st.os_version,
                    "clientVersion": st.client_version,
                });

                if let Err(e) = client
                    .emit("client_auth", auth_data)
                    .await
                {
                    log::error!("[Protocol] Failed to send client_auth: {}", e);
                }
            })
        })
        .connect()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    // 心跳循环
    let heartbeat_interval = state.server_config.read().heartbeat_interval;
    loop {
        tokio::time::sleep(Duration::from_millis(heartbeat_interval)).await;

        if !*state.should_connect.read() {
            let _ = client.disconnect().await;
            break;
        }

        if let Err(e) = client.emit("client_heartbeat", json!({})).await {
            log::warn!("[Protocol] Heartbeat failed: {}", e);
            break;
        }
    }

    Ok(())
}

/// 处理服务端消息
async fn handle_server_message(
    msg: ServerMessage,
    client: &rust_socketio::asynchronous::Client,
    state: Arc<AppState>,
) {
    log::info!("[Protocol] Received: type={}", msg.msg_type);

    match msg.msg_type.as_str() {
        "request_screenshot" => {
            handle_screenshot_request(msg.payload, client, &state).await;
        }
        "execute_action" => {
            if let Some(action_id) = msg.action_id {
                handle_execute_action(action_id, msg.payload, client, &state).await;
            }
        }
        "cancel" => {
            log::info!("[Protocol] Cancel received — no long-running task on client");
        }
        "config" => {
            if let Some(payload) = msg.payload {
                handle_config(payload, &state);
            }
        }
        "heartbeat_ack" => {
            // 心跳确认，更新活动时间
        }
        _ => {
            log::warn!("[Protocol] Unknown message type: {}", msg.msg_type);
        }
    }
}

/// 处理截图请求
async fn handle_screenshot_request(
    payload: Option<serde_json::Value>,
    client: &rust_socketio::asynchronous::Client,
    state: &AppState,
) {
    let quality = state.server_config.read().screenshot_quality;

    let result = if let Some(ref p) = payload {
        if let Some(region) = p.get("region") {
            let r = screenshot::CaptureRegion {
                x: region.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                y: region.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                w: region.get("w").and_then(|v| v.as_u64()).unwrap_or(100) as u32,
                h: region.get("h").and_then(|v| v.as_u64()).unwrap_or(100) as u32,
            };
            screenshot::capture_region(&r, quality)
        } else {
            screenshot::capture_screen(quality)
        }
    } else {
        screenshot::capture_screen(quality)
    };

    match result {
        Ok(capture) => {
            let data = json!({
                "image": capture.image_base64,
                "width": capture.width,
                "height": capture.height,
                "timestamp": chrono::Utc::now().timestamp_millis(),
            });
            if let Err(e) = client.emit("client_screenshot", data).await {
                log::error!("[Protocol] Failed to send screenshot: {}", e);
            }
        }
        Err(e) => {
            log::error!("[Protocol] Screenshot capture failed: {}", e);
            let _ = client
                .emit("client_error", json!({ "code": "CAPTURE_FAILED", "message": e }))
                .await;
        }
    }
}

/// 处理操作执行请求
async fn handle_execute_action(
    action_id: String,
    payload: Option<serde_json::Value>,
    client: &rust_socketio::asynchronous::Client,
    state: &AppState,
) {
    let payload = match payload {
        Some(p) => p,
        None => {
            send_action_result(client, &action_id, false, Some("缺少 payload")).await;
            return;
        }
    };

    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("");
    let params = payload.get("params").cloned().unwrap_or(json!({}));

    // 获取屏幕信息用于安全检查
    let screen = state.screen_info.read().clone();
    let (sw, sh) = screen
        .map(|s| (s.width, s.height))
        .unwrap_or((1920, 1080));

    // 安全检查
    let action_type = match tool {
        "desktop.click" => safety::ActionType::Click,
        "desktop.double_click" => safety::ActionType::DoubleClick,
        "desktop.drag" => safety::ActionType::Drag,
        "desktop.type" => safety::ActionType::Type,
        "desktop.hotkey" => safety::ActionType::Hotkey,
        "desktop.scroll" => safety::ActionType::Scroll,
        "desktop.screenshot" => safety::ActionType::Screenshot,
        "desktop.wait" => safety::ActionType::Wait,
        _ => {
            send_action_result(client, &action_id, false, Some(&format!("未知工具: {}", tool))).await;
            return;
        }
    };

    let x = params.get("x").and_then(|v| v.as_i64()).map(|v| v as i32);
    let y = params.get("y").and_then(|v| v.as_i64()).map(|v| v as i32);

    let safety_check = safety::check_action_safety(
        &action_type,
        x,
        y,
        sw,
        sh,
        &state.platform,
        Some(&params),
    );

    if !safety_check.allowed {
        let reason = safety_check.reason.unwrap_or_else(|| "安全限制".into());
        send_action_result(client, &action_id, false, Some(&reason)).await;
        return;
    }

    // ── P3: 结构化数据工具（需要返回额外字段） ──
    let p3_result = handle_p3_tool(tool, &params).await;
    if let Some(result_json) = p3_result {
        let mut data = result_json;
        data["actionId"] = json!(action_id);
        data["success"] = json!(true);
        if let Err(e) = client.emit("client_action_result", data).await {
            log::error!("[Protocol] Failed to send P3 result: {}", e);
        }
        return;
    }

    // 执行操作
    let exec_result = execute_tool(tool, &params).await;

    match exec_result {
        Ok(()) => {
            // 剪贴板读取需要附带读取到的文字
            if tool == "desktop.clipboard_read" {
                let clip_text = crate::clipboard::read_clipboard().unwrap_or_default();
                let result = json!({
                    "actionId": action_id,
                    "success": true,
                    "error": serde_json::Value::Null,
                    "clipboardText": clip_text,
                });
                if let Err(e) = client.emit("client_action_result", result).await {
                    log::error!("[Protocol] Failed to send action result: {}", e);
                }
                return;
            }
            send_action_result(client, &action_id, true, None).await;
        }
        Err(e) => {
            log::error!("[Protocol] Action {} failed: {}", tool, e);
            send_action_result(client, &action_id, false, Some(&e)).await;
        }
    }
}

/// 执行具体工具操作
async fn execute_tool(tool: &str, params: &serde_json::Value) -> Result<(), String> {
    match tool {
        "desktop.click" => {
            let x = params.get("x").and_then(|v| v.as_i64()).ok_or("缺少 x 参数")? as i32;
            let y = params.get("y").and_then(|v| v.as_i64()).ok_or("缺少 y 参数")? as i32;
            let button_str = params.get("button").and_then(|v| v.as_str()).unwrap_or("left");
            let button = match button_str {
                "right" => input::MouseButton::Right,
                "middle" => input::MouseButton::Middle,
                _ => input::MouseButton::Left,
            };
            input::mouse_click(x, y, &button)
        }

        "desktop.double_click" => {
            let x = params.get("x").and_then(|v| v.as_i64()).ok_or("缺少 x 参数")? as i32;
            let y = params.get("y").and_then(|v| v.as_i64()).ok_or("缺少 y 参数")? as i32;
            input::mouse_double_click(x, y)
        }

        "desktop.drag" => {
            let from_x = params.get("fromX").and_then(|v| v.as_i64()).ok_or("缺少 fromX")? as i32;
            let from_y = params.get("fromY").and_then(|v| v.as_i64()).ok_or("缺少 fromY")? as i32;
            let to_x = params.get("toX").and_then(|v| v.as_i64()).ok_or("缺少 toX")? as i32;
            let to_y = params.get("toY").and_then(|v| v.as_i64()).ok_or("缺少 toY")? as i32;
            input::mouse_drag(from_x, from_y, to_x, to_y)
        }

        "desktop.type" => {
            let text = params.get("text").and_then(|v| v.as_str()).ok_or("缺少 text 参数")?;
            input::key_type(text)
        }

        "desktop.hotkey" => {
            let keys: Vec<String> = params
                .get("keys")
                .and_then(|v| v.as_array())
                .ok_or("缺少 keys 参数")?
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect();
            input::key_press(&keys)
        }

        "desktop.scroll" => {
            let x = params.get("x").and_then(|v| v.as_i64()).ok_or("缺少 x 参数")? as i32;
            let y = params.get("y").and_then(|v| v.as_i64()).ok_or("缺少 y 参数")? as i32;
            let delta = params.get("delta").and_then(|v| v.as_i64()).ok_or("缺少 delta")? as i32;
            input::scroll(x, y, delta)
        }

        "desktop.screenshot" => {
            // 截图在服务端单独处理，这里不需要执行
            Ok(())
        }

        "desktop.clipboard_read" => {
            // 剪贴板读取由客户端执行，结果通过 action_result 返回
            // 注意：实际的文字内容需要通过扩展的 action_result 传递
            crate::clipboard::read_clipboard().map(|_| ())
        }

        "desktop.clipboard_write" => {
            let text = params.get("text").and_then(|v| v.as_str()).ok_or("缺少 text 参数")?;
            crate::clipboard::write_clipboard(text)
        }

        "desktop.wait" => {
            let ms = params.get("ms").and_then(|v| v.as_u64()).unwrap_or(500);
            tokio::time::sleep(Duration::from_millis(ms.min(10_000))).await;
            Ok(())
        }

        // ── P3: 多显示器 ──
        "desktop.list_monitors" | "desktop.switch_monitor" |
        // ── P3: 应用识别 ──
        "desktop.app_info" | "desktop.app_list" | "desktop.app_focus" |
        // ── P3: 文件系统 ──
        "desktop.file_list" | "desktop.file_search" | "desktop.file_move" | "desktop.file_archive" => {
            // P3 工具返回数据，由 handle_execute_action 直接处理
            // 这里标记为 Ok 让上层走自定义返回路径
            Ok(())
        }

        _ => Err(format!("未知工具: {}", tool)),
    }
}

/// 发送操作结果
async fn send_action_result(
    client: &rust_socketio::asynchronous::Client,
    action_id: &str,
    success: bool,
    error: Option<&str>,
) {
    let result = json!({
        "actionId": action_id,
        "success": success,
        "error": error,
    });
    if let Err(e) = client.emit("client_action_result", result).await {
        log::error!("[Protocol] Failed to send action result: {}", e);
    }
}

/// 处理服务端配置更新
fn handle_config(payload: serde_json::Value, state: &AppState) {
    let mut config = state.server_config.write();

    if let Some(q) = payload.get("screenshotQuality").and_then(|v| v.as_u64()) {
        config.screenshot_quality = q as u8;
    }
    if let Some(f) = payload.get("screenshotFormat").and_then(|v| v.as_str()) {
        config.screenshot_format = f.into();
    }
    if let Some(m) = payload.get("maxSteps").and_then(|v| v.as_u64()) {
        config.max_steps = m as u32;
    }
    if let Some(h) = payload.get("heartbeatInterval").and_then(|v| v.as_u64()) {
        config.heartbeat_interval = h;
    }

    log::info!("[Protocol] Config updated: quality={}, format={}, maxSteps={}",
        config.screenshot_quality, config.screenshot_format, config.max_steps);
}

// ═══════════════════════════════════════════
// P3: 结构化数据工具处理
// ═══════════════════════════════════════════

/// 处理 P3 工具（返回结构化数据的工具）
/// 返回 Some(json) 表示已处理，None 表示非 P3 工具
async fn handle_p3_tool(
    tool: &str,
    params: &serde_json::Value,
) -> Option<serde_json::Value> {
    match tool {
        // ── 多显示器 ──
        "desktop.list_monitors" => {
            match crate::system::list_monitors() {
                Ok(monitors) => Some(json!({ "monitors": monitors })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.switch_monitor" => {
            let idx = params.get("monitorIndex").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            // 验证显示器存在
            match crate::system::list_monitors() {
                Ok(monitors) if idx > 0 && idx <= monitors.len() => {
                    Some(json!({ "switched": true, "monitorIndex": idx }))
                }
                Ok(monitors) => Some(json!({
                    "success": false,
                    "error": format!("显示器 {} 不存在，共 {} 个", idx, monitors.len())
                })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }

        // ── 应用识别 ──
        "desktop.app_info" => {
            match crate::system::get_active_window() {
                Ok(info) => Some(json!({ "appInfo": info })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.app_list" => {
            match crate::system::list_windows() {
                Ok(windows) => Some(json!({ "windows": windows })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.app_focus" => {
            let app_name = params.get("appName").and_then(|v| v.as_str()).unwrap_or("");
            let title = params.get("windowTitle").and_then(|v| v.as_str());
            match crate::system::focus_window(app_name, title) {
                Ok(()) => Some(json!({ "focused": true, "appName": app_name })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }

        // ── 文件系统 ──
        "desktop.file_list" => {
            let path = params.get("path").and_then(|v| v.as_str()).unwrap_or("~");
            let recursive = params.get("recursive").and_then(|v| v.as_bool()).unwrap_or(false);
            let pattern = params.get("pattern").and_then(|v| v.as_str());
            match crate::system::list_directory(path, recursive, pattern) {
                Ok(files) => Some(json!({ "files": files })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.file_search" => {
            let path = params.get("path").and_then(|v| v.as_str()).unwrap_or("~");
            let query = params.get("query").and_then(|v| v.as_str());
            let ext = params.get("extension").and_then(|v| v.as_str());
            let min_mb = params.get("minSizeMB").and_then(|v| v.as_u64());
            let max_mb = params.get("maxSizeMB").and_then(|v| v.as_u64());
            match crate::system::search_files(path, query, ext, min_mb, max_mb) {
                Ok(files) => Some(json!({ "files": files })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.file_move" => {
            let source = params.get("source").and_then(|v| v.as_str()).unwrap_or("");
            let dest = params.get("destination").and_then(|v| v.as_str()).unwrap_or("");
            match crate::system::move_file(source, dest) {
                Ok(count) => Some(json!({ "moved": count })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.file_archive" => {
            let sources: Vec<String> = params.get("sources")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let output = params.get("outputPath").and_then(|v| v.as_str()).unwrap_or("archive.zip");
            match crate::system::create_archive(&sources, output) {
                Ok(()) => Some(json!({ "archived": true, "outputPath": output })),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }

        _ => None, // 非 P3 工具
    }
}
