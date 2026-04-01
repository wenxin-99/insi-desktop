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
use std::sync::atomic::{AtomicU32, Ordering};
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
        // 断连时重置授权状态
        *state.authorized.write() = false;

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
    use rust_socketio::{
        asynchronous::{Client, ClientBuilder},
        Payload,
    };

    let state_clone = state.clone();
    let state_for_msg = state.clone();

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

                let (width, height, scale) = screenshot::get_primary_monitor()
                    .unwrap_or((1920, 1080, 1.0));

                *st.screen_info.write() = Some(crate::state::ScreenInfo {
                    width,
                    height,
                    scale,
                });

                let auth_data = json!({
                    "platform": st.platform,
                    "screenWidth": width,
                    "screenHeight": height,
                    "scale": scale,
                    "osVersion": st.os_version,
                    "clientVersion": st.client_version,
                });

                if let Err(e) = client.emit("client_auth", auth_data).await {
                    log::error!("[Protocol] Failed to send client_auth: {}", e);
                }
            })
        })
        .connect()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    // 心跳循环 + 授权信号发送
    let heartbeat_interval = state.server_config.read().heartbeat_interval;
    loop {
        tokio::time::sleep(Duration::from_millis(heartbeat_interval.min(3000))).await;

        if !*state.should_connect.read() {
            let _ = client.disconnect().await;
            break;
        }

        // ★ 检查并发送 pending_authorize
        if *state.pending_authorize.read() {
            *state.pending_authorize.write() = false;
            log::info!("[Protocol] Sending client_authorize to server...");
            if let Err(e) = client.emit("client_authorize", json!({})).await {
                log::warn!("[Protocol] Failed to emit client_authorize: {}", e);
            }
        }

        // ★ 检查并发送 pending_revoke（如果服务端支持）
        if *state.pending_revoke.read() {
            *state.pending_revoke.write() = false;
            log::info!("[Protocol] Sending client_revoke to server...");
            if let Err(e) = client.emit("client_revoke", json!({})).await {
                log::warn!("[Protocol] Failed to emit client_revoke: {}", e);
            }
        }

        // 心跳（降低频率，不需要每 3 秒都发）
        static HEARTBEAT_COUNTER: AtomicU32 = AtomicU32::new(0);
        let count = HEARTBEAT_COUNTER.fetch_add(1, Ordering::Relaxed);
        let interval_mod = (heartbeat_interval as u32 / 3000).max(1);
        if count % interval_mod == 0 {
            if let Err(e) = client.emit("client_heartbeat", json!({})).await {
                log::warn!("[Protocol] Heartbeat failed: {}", e);
                break;
            }
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
        // ★ 权限更新（服务端授权/撤销）
        "permission_update" => {
            if let Some(payload) = &msg.payload {
                let authorized = payload.get("authorized").and_then(|v| v.as_bool()).unwrap_or(false);
                *state.authorized.write() = authorized;
                log::info!("[Protocol] Permission updated: authorized={}", authorized);
            }
        }
        // ★ 心跳应答（携带 authorized 状态，自愈同步）
        "heartbeat_ack" => {
            if let Some(payload) = &msg.payload {
                if let Some(authorized) = payload.get("authorized").and_then(|v| v.as_bool()) {
                    let current = *state.authorized.read();
                    if current != authorized {
                        *state.authorized.write() = authorized;
                        log::info!("[Protocol] Heartbeat sync: authorized {} → {}", current, authorized);
                    }
                }
            }
        }

        // ═══════════════════════════════════════════
        // ★ 操作实时预览事件
        // ═══════════════════════════════════════════

        // 任务开始
        "task_start" => {
            if let Some(payload) = &msg.payload {
                let goal = payload.get("goal").and_then(|v| v.as_str()).unwrap_or("AI 正在执行任务");
                let total = payload.get("totalSteps").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let mut task = state.current_task.write();
                task.active = true;
                task.goal = goal.to_string();
                task.current_step = 0;
                task.total_steps = total;
                task.status = "running".into();
                task.steps.clear();
                task.latest_screenshot = None;
                task.started_at = Some(chrono::Utc::now().timestamp_millis());
                log::info!("[Protocol] Task started: {}", goal);
            }
        }

        // 任务步骤更新
        "task_step" => {
            if let Some(payload) = &msg.payload {
                let index = payload.get("stepIndex").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("unknown");
                let desc = payload.get("description").and_then(|v| v.as_str()).unwrap_or("");
                let step_status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("running");
                let error = payload.get("error").and_then(|v| v.as_str()).map(String::from);

                let step = crate::state::TaskStep {
                    index,
                    tool: tool.to_string(),
                    description: desc.to_string(),
                    status: step_status.to_string(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    error,
                };

                let mut task = state.current_task.write();
                task.current_step = index;
                if index >= task.total_steps {
                    task.total_steps = index + 1;
                }

                // 更新已有步骤或新增
                if let Some(existing) = task.steps.iter_mut().find(|s| s.index == index) {
                    *existing = step;
                } else {
                    task.steps.push(step);
                }

                log::info!("[Protocol] Task step {}: {} - {}", index, tool, desc);
            }
        }

        // 任务截图更新（缩略图用于前端预览）
        "task_screenshot" => {
            if let Some(payload) = &msg.payload {
                let image = payload.get("thumbnail").and_then(|v| v.as_str()).map(String::from);
                let w = payload.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
                let h = payload.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);

                let mut task = state.current_task.write();
                task.latest_screenshot = image;
                task.screenshot_width = w;
                task.screenshot_height = h;
            }
        }

        // 任务完成
        "task_complete" => {
            if let Some(payload) = &msg.payload {
                let result_status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("completed");
                let goal = {
                    let task = state.current_task.read();
                    task.goal.clone()
                };
                {
                    let mut task = state.current_task.write();
                    task.status = result_status.to_string();
                    task.active = false;
                }
                log::info!("[Protocol] Task completed with status: {}", result_status);

                // ★ 推送系统通知
                let (title, body, level) = if result_status == "completed" {
                    ("任务已完成".to_string(),
                     if goal.is_empty() { "AI 操作已成功完成".into() } else { format!("「{}」已成功完成", goal) },
                     "success".to_string())
                } else {
                    ("任务执行失败".to_string(),
                     if goal.is_empty() { "AI 操作执行失败".into() } else { format!("「{}」执行失败", goal) },
                     "error".to_string())
                };
                state.pending_notifications.write().push(crate::state::PendingNotification {
                    title, body, level,
                    timestamp: chrono::Utc::now().timestamp_millis(),
                });

                // ★ 记录到操作历史
                let now = chrono::Utc::now().timestamp_millis();
                let (started, step_count) = {
                    let task = state.current_task.read();
                    (task.started_at.unwrap_or(now), task.steps.len() as u32)
                };
                let record = crate::state::OperationRecord {
                    goal: goal.clone(),
                    status: result_status.to_string(),
                    step_count,
                    started_at: started,
                    ended_at: now,
                    duration_secs: (now - started) as f64 / 1000.0,
                };
                {
                    let mut history = state.operation_history.write();
                    history.push(record);
                    // 保留最近 100 条
                    if history.len() > 100 {
                    let len = history.len();
                        history.drain(0..len - 100);
                    }
                }
            }
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
            // ★ 更新任务预览截图
            {
                let mut task = state.current_task.write();
                if task.active {
                    // 传完整 base64 给前端预览（前端 <img> 可直接渲染）
                    // 注: 如果图太大(>500KB base64), 前端 CSS 限制了显示尺寸
                    task.latest_screenshot = Some(capture.image_base64.clone());
                    task.screenshot_width = Some(capture.width);
                    task.screenshot_height = Some(capture.height);
                }
            }

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

    // ★ P3 结构化数据工具优先处理（不需要屏幕交互，不需要安全检查坐标）
    if is_p3_tool(tool) {
        // P3 工具不需要 GUI 授权，但仍需基本连接授权
        let p3_result = handle_p3_tool(tool, &params).await;
        if let Some(result_json) = p3_result {
            let mut data = result_json;
            data["actionId"] = json!(action_id);
            if data.get("success").is_none() {
                data["success"] = json!(true);
            }
            if let Err(e) = client.emit("client_action_result", data).await {
                log::error!("[Protocol] Failed to send P3 result: {}", e);
            }
        } else {
            send_action_result(client, &action_id, false, Some(&format!("P3 工具 {} 处理失败", tool))).await;
        }
        return;
    }

    // ★ 授权检查（GUI 操作需要用户授权）
    if !*state.authorized.read() {
        // 截图和等待始终允许（不涉及 GUI 输入）
        if tool != "desktop.screenshot" && tool != "desktop.wait" {
            send_action_result(
                client, &action_id, false,
                Some("桌面控制未授权。请在网页端点击「授权」按钮，或在桌面客户端中授权。")
            ).await;
            return;
        }
    }

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
        "desktop.clipboard_read" | "desktop.clipboard_write" => safety::ActionType::Clipboard,
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

    // 执行操作
    let exec_result = execute_tool(tool, &params).await;

    // ★ 更新本地任务预览（即使没有 task_step 事件从服务端来）
    {
        let mut task = state.current_task.write();
        if task.active {
            // 自增步骤索引（本地追踪时服务端可能不发 task_step）
            let step_idx = task.steps.len() as u32;
            task.current_step = step_idx;
            if step_idx >= task.total_steps {
                task.total_steps = step_idx + 1;
            }

            let tool_desc = match tool {
                "desktop.click" => format!("点击 ({}, {})", 
                    params.get("x").and_then(|v| v.as_i64()).unwrap_or(0),
                    params.get("y").and_then(|v| v.as_i64()).unwrap_or(0)),
                "desktop.double_click" => format!("双击 ({}, {})",
                    params.get("x").and_then(|v| v.as_i64()).unwrap_or(0),
                    params.get("y").and_then(|v| v.as_i64()).unwrap_or(0)),
                "desktop.type" => {
                    let text = params.get("text").and_then(|v| v.as_str()).unwrap_or("");
                    // UTF-8 安全截断（避免中文字符边界 panic）
                    let preview_text: String = text.chars().take(20).collect();
                    if text.chars().count() > 20 {
                        format!("输入「{}…」", preview_text)
                    } else {
                        format!("输入「{}」", preview_text)
                    }
                }
                "desktop.hotkey" => {
                    let keys = params.get("keys").and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join("+"))
                        .unwrap_or_default();
                    format!("快捷键 {}", keys)
                }
                "desktop.scroll" => format!("滚动"),
                "desktop.drag" => format!("拖拽"),
                "desktop.clipboard_read" => format!("读取剪贴板"),
                "desktop.clipboard_write" => format!("写入剪贴板"),
                "desktop.wait" => format!("等待"),
                _ => format!("{}", tool),
            };

            let step = crate::state::TaskStep {
                index: step_idx,
                tool: tool.to_string(),
                description: tool_desc,
                status: if exec_result.is_ok() { "success".into() } else { "failed".into() },
                timestamp: chrono::Utc::now().timestamp_millis(),
                error: exec_result.as_ref().err().cloned(),
            };

            // 本地步骤总是新增（不覆盖服务端发来的）
            task.steps.push(step);
        }
    }

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

/// 检查是否为 P3 结构化数据工具
fn is_p3_tool(tool: &str) -> bool {
    matches!(tool,
        "desktop.list_monitors" | "desktop.switch_monitor" |
        "desktop.app_info" | "desktop.app_list" | "desktop.app_focus" |
        "desktop.file_list" | "desktop.file_search" | "desktop.file_move" | "desktop.file_archive"
    )
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
            // ★ 快捷键前切换到英文输入法，避免中文IME拦截
            let _ = input::ensure_english_ime();
            input::key_press(&keys)
        }

        "desktop.scroll" => {
            let x = params.get("x").and_then(|v| v.as_i64()).ok_or("缺少 x 参数")? as i32;
            let y = params.get("y").and_then(|v| v.as_i64()).ok_or("缺少 y 参数")? as i32;
            let delta = params.get("delta").and_then(|v| v.as_i64()).ok_or("缺少 delta")? as i32;
            input::scroll(x, y, delta)
        }

        "desktop.screenshot" => {
            // 截图在服务端通过 request_screenshot 单独处理
            Ok(())
        }

        "desktop.clipboard_read" => {
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

    // ★ 权限级别（从服务端同步）
    if let Some(level) = payload.get("permissionLevel").and_then(|v| v.as_str()) {
        if matches!(level, "standard" | "cautious" | "restricted") {
            *state.permission_level.write() = level.to_string();
            log::info!("[Protocol] Permission level updated: {}", level);
        }
    }

    log::info!("[Protocol] Config updated: quality={}, format={}, maxSteps={}",
        config.screenshot_quality, config.screenshot_format, config.max_steps);
}

// ═══════════════════════════════════════════
// P3: 结构化数据工具处理
// ═══════════════════════════════════════════

/// 处理 P3 工具（返回结构化数据的工具）
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

        _ => None,
    }
}
