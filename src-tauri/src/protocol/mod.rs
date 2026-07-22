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
use crate::state::{AppState, ClientInterruptRequest, ConnectionStatus};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// 幂等结果缓存上限(action_id 数)。超过后 FIFO 淘汰最旧的。
const ACTION_CACHE_CAP: usize = 128;

/// 需要用户"授权控制"才能执行的会改动本地系统的 P3 工具(删/移/整理/归档等)。
/// 只读 P3 工具(list / search / app_info / window_bounds / taskbar 等)不在此列。
fn is_mutating_p3_tool(tool: &str) -> bool {
    matches!(
        tool,
        "desktop.file_move"
            | "desktop.file_archive"
            | "desktop.file_organize"
            | "desktop.file_rename_batch"
            | "desktop.file_trash"
            | "desktop.file_group"
            | "desktop.file_rollback"
    )
}

/// ★ v0.8.0 记录一次动作结果到幂等缓存(FIFO,上限 ACTION_CACHE_CAP)。
/// 只在动作"真的执行了"时调用,以便服务端重试同一 action_id 时直接重发原结果,
/// 而不是重复点击/输入/删文件。
fn remember_action(state: &AppState, action_id: &str, result: &serde_json::Value) {
    let mut map = state.executed_actions.write();
    if map.insert(action_id.to_string(), result.clone()).is_none() {
        let mut order = state.executed_order.write();
        order.push_back(action_id.to_string());
        while order.len() > ACTION_CACHE_CAP {
            if let Some(old) = order.pop_front() {
                map.remove(&old);
            }
        }
    }
}

/// ★ v0.8.0 服务端下发 authorized 状态的安全同步:
///   - 降级(true→false):立即生效(服务端有权随时撤销)。
///   - 升级(false→true):仅当用户本地授权意图为 true 才接受;否则忽略。
/// 防止 kill/revoke 之后 heartbeat_ack 或 permission_update 把控制权悄悄还回来。
fn apply_server_authorized(state: &AppState, server_auth: bool) {
    let local = *state.authorized.read();
    if server_auth == local {
        return;
    }
    if !server_auth {
        *state.authorized.write() = false;
        *state.in_takeover.write() = false;
        *state.agent_awaiting.write() = false;
        log::info!("[Protocol] Server revoked authorization (synced down)");
    } else if *state.authorize_intent.read() {
        *state.authorized.write() = true;
        log::info!("[Protocol] Server confirmed authorization (local intent matches)");
    } else {
        log::warn!(
            "[Protocol] Ignored server authorized=true — no local user intent (anti re-authorize guard)"
        );
    }
}

/// ★ v0.8.0 通过 notification 插件推送一条系统通知(需要 AppState 里已注入 app_handle)。
fn notify(state: &AppState, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    if let Some(app) = state.app_handle.read().clone() {
        if let Err(e) = app.notification().builder().title(title).body(body).show() {
            log::warn!("[Protocol] notification failed: {}", e);
        }
    }
}

/// ★ v0.8.0 把主窗口弹到前台并请求用户注意(用于 shell 审批等需要用户立刻看到的场景)。
pub fn surface_main_window(state: &AppState) {
    use tauri::Manager;
    if let Some(app) = state.app_handle.read().clone() {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
            let _ = w.request_user_attention(Some(tauri::UserAttentionType::Critical));
        }
    }
}

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
    // ★ v0.8.0 指数退避:连接成功后重置为 1s,每次失败翻倍,上限 30s,叠加 <500ms 抖动。
    let mut backoff_secs: u64 = 1;
    loop {
        // ★ v0.8.0 每轮先看 shutdown,断连时也能及时退出(此前只在一次连接结束后才检查)。
        if shutdown_rx.try_recv().is_ok() {
            log::info!("[Protocol] Shutdown signal received (idle)");
            break;
        }
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
                backoff_secs = 1; // ★ 成功建立过连接 → 重置退避
            }
            Err(e) => {
                log::error!("[Protocol] Connection error: {}", e);
            }
        }

        *state.connection_status.write() = ConnectionStatus::Disconnected;
        // 断连时重置服务端确认的授权(但保留 authorize_intent,重连后自动恢复控制)
        *state.authorized.write() = false;

        // 检查是否收到 shutdown 信号
        if shutdown_rx.try_recv().is_ok() {
            log::info!("[Protocol] Shutdown signal received");
            break;
        }

        // ★ v0.8.0 重连延迟:指数退避 + 抖动,避免服务端抖动时的重连风暴
        if *state.should_connect.read() {
            *state.connection_status.write() = ConnectionStatus::Reconnecting;
            let jitter_ms = (chrono::Utc::now().timestamp_subsec_millis() % 500) as u64;
            let wait = Duration::from_secs(backoff_secs) + Duration::from_millis(jitter_ms);
            log::info!("[Protocol] Reconnecting in ~{}s...", backoff_secs);
            tokio::time::sleep(wait).await;
            backoff_secs = (backoff_secs.saturating_mul(2)).min(30);
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
    let state_for_close = state.clone();

    let client = ClientBuilder::new(server_url)
        .namespace("/desktop")
        .auth(json!({ "token": token }))
        .on("server_message", move |payload: Payload, client: Client| {
            let st = state_for_msg.clone();
            Box::pin(async move {
                if let Payload::Text(values) = payload {
                    if let Some(first) = values.first() {
                        match serde_json::from_value::<ServerMessage>(first.clone()) {
                            Ok(msg) => handle_server_message(msg, &client, st).await,
                            // ★ v0.8.0 此前解析失败被静默丢弃;现在至少落日志,便于排协议不兼容
                            Err(e) => log::warn!(
                                "[Protocol] Unparseable server_message dropped: {} (raw: {})",
                                e,
                                first.to_string().chars().take(200).collect::<String>()
                            ),
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
        // ★ v0.8.0 socket 关闭时立即标记断连,让心跳循环尽快退出并触发重连
        .on("close", move |_, _| {
            let st = state_for_close.clone();
            Box::pin(async move {
                log::warn!("[Protocol] Socket closed by peer/transport");
                *st.connection_status.write() = ConnectionStatus::Disconnected;
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

                // ★ v0.8.0 重连后自动恢复控制:若用户此前授权过(authorize_intent),
                // 排队重发 client_authorize,让心跳循环下一 tick 补发,不用用户再点一次。
                if *st.authorize_intent.read() {
                    *st.pending_authorize.write() = true;
                }
            })
        })
        .connect()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    // 心跳循环 + 授权信号发送 + 中断转发
    // ★ v0.8.0 clamp 心跳间隔到 [1s, 120s],避免服务端下发 heartbeatInterval=0 导致 busy-loop 刷屏。
    let heartbeat_interval = state.server_config.read().heartbeat_interval.clamp(1000, 120_000);
    // ★ v0.8.0 用局部计数器替代进程级 static,避免重连后首个心跳被历史计数错开。
    let mut hb_count: u32 = 0;
    loop {
        tokio::time::sleep(Duration::from_millis(heartbeat_interval.min(3000))).await;

        if !*state.should_connect.read() {
            let _ = client.disconnect().await;
            break;
        }

        // ★ v0.8.0 close 事件已把状态置为 Disconnected → 尽快退出触发重连,别再往死连接发东西
        if !matches!(*state.connection_status.read(), ConnectionStatus::Connected) {
            log::warn!("[Protocol] Connection no longer Connected — exiting heartbeat loop");
            break;
        }

        // ★ 检查并发送 pending_authorize
        if *state.pending_authorize.read() {
            log::info!("[Protocol] Sending client_authorize to server...");
            match client.emit("client_authorize", json!({})).await {
                // ★ v0.8.0 仅在发送成功后才清标记,失败保留下一 tick 重试(此前发送前就清,丢就永久丢)
                Ok(_) => *state.pending_authorize.write() = false,
                Err(e) => log::warn!("[Protocol] Failed to emit client_authorize: {}", e),
            }
        }

        // ★ 检查并发送 pending_revoke
        if *state.pending_revoke.read() {
            log::info!("[Protocol] Sending client_revoke to server...");
            match client.emit("client_revoke", json!({})).await {
                Ok(_) => *state.pending_revoke.write() = false,
                Err(e) => log::warn!("[Protocol] Failed to emit client_revoke: {}", e),
            }
        }

        // ★ v0.8.0 发送待处理的中断请求(pause/resume/takeover/abort/steer)——
        //   这是此前完全缺失的一环:main.rs 把中断塞进队列,但没有任何代码发给服务端。
        let pending: Vec<ClientInterruptRequest> = {
            let mut q = state.pending_interrupts.write();
            std::mem::take(&mut *q)
        };
        if !pending.is_empty() {
            let mut sent = 0usize;
            for it in &pending {
                let payload = json!({
                    "kind": it.kind,
                    "text": it.text,
                    "requestedAt": it.requested_at,
                });
                match client.emit("client_interrupt", payload).await {
                    Ok(_) => {
                        log::info!("[Protocol] Sent client_interrupt: {}", it.kind);
                        sent += 1;
                    }
                    Err(e) => {
                        log::warn!("[Protocol] Failed to emit client_interrupt {}: {}", it.kind, e);
                        break;
                    }
                }
            }
            // 未发送成功的放回队列头,下一 tick 重试(保持原顺序)
            if sent < pending.len() {
                let mut q = state.pending_interrupts.write();
                for (i, it) in pending[sent..].iter().cloned().enumerate() {
                    q.insert(i, it);
                }
            }
        }

        // ★ v0.8.0 发送"交还控制"
        if *state.pending_handback.read() {
            match client.emit("client_handback", json!({})).await {
                Ok(_) => {
                    *state.pending_handback.write() = false;
                    log::info!("[Protocol] Sent client_handback");
                }
                Err(e) => log::warn!("[Protocol] Failed to emit client_handback: {}", e),
            }
        }

        // 心跳(按配置间隔发,不必每 tick 都发)
        let interval_mod = (heartbeat_interval as u32 / 3000).max(1);
        if hb_count % interval_mod == 0 {
            if let Err(e) = client.emit("client_heartbeat", json!({})).await {
                log::warn!("[Protocol] Heartbeat failed: {}", e);
                break;
            }
        }
        hb_count = hb_count.wrapping_add(1);
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
            } else {
                // ★ v0.8.0 此前静默丢弃,服务端会一直等结果 → 至少落日志
                log::warn!("[Protocol] execute_action without actionId — dropped (server would hang)");
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
                // ★ v0.8.0 走安全同步:服务端可撤销,但不能在无本地意图时把控制权升回来
                apply_server_authorized(&state, authorized);
            }
        }
        // ★ 心跳应答（携带 authorized 状态，自愈同步）
        "heartbeat_ack" => {
            if let Some(payload) = &msg.payload {
                if let Some(authorized) = payload.get("authorized").and_then(|v| v.as_bool()) {
                    // ★ v0.8.0 同上:防止 kill/revoke 后被 heartbeat 悄悄重新授权
                    apply_server_authorized(&state, authorized);
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
                // ★ v0.8.0 直接通过 notification 插件推送系统通知(此前只塞进队列,
                //   而前端从不读取,通知实际从未弹出)。
                notify(&state, &title, &body);
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
                    let len = history.len();
                    if len > 100 {
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
    // ★ v0.8.0 幂等:同一 action_id 已执行过 → 直接重发缓存结果,绝不重复执行。
    //   防止服务端在 ack 丢失后重试导致点击/输入/删文件被执行两次。
    // ★ 修复(构建失败根因):必须先用独立 let 绑定把 RwLockReadGuard 释放,再 await。
    //   若写成 `if let Some(cached) = state.executed_actions.read()...cloned() { ... .await }`,
    //   parking_lot 的 read guard 会因 `if let` 临时值生命周期延长被跨 `.await` 持有;
    //   该 guard 不是 Send,导致 socketio 回调要求的 Send future 无法满足,
    //   报 "future cannot be sent between threads safely",四个平台全部编译失败。
    let cached_result = state.executed_actions.read().get(&action_id).cloned();
    if let Some(cached) = cached_result {
        log::warn!("[Protocol] Duplicate action_id {} — re-sending cached result (no re-exec)", action_id);
        if let Err(e) = client.emit("client_action_result", cached).await {
            log::error!("[Protocol] Failed to re-send cached result: {}", e);
        }
        return;
    }

    let payload = match payload {
        Some(p) => p,
        None => {
            send_action_result(client, state, &action_id, false, Some("缺少 payload")).await;
            return;
        }
    };

    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("");
    let params = payload.get("params").cloned().unwrap_or(json!({}));

    // ★ v0.7.0 desktop.shell_exec 单独处理 — 需要 AppState 来 park 审批请求
    if tool == "desktop.shell_exec" {
        // 还需要基本的连接授权(否则未授权用户就能弹审批框)
        if !*state.authorized.read() {
            send_action_result(client, state, &action_id, false, Some("未授权,请先在客户端点'授权控制'")).await;
            return;
        }
        let command = params.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let reason = params.get("reason").and_then(|v| v.as_str()).unwrap_or("(无说明)").to_string();
        let work_dir = params.get("workDir").and_then(|v| v.as_str()).map(String::from);
        let timeout_ms = params.get("timeout").and_then(|v| v.as_u64()).unwrap_or(30_000);

        if command.is_empty() {
            send_action_result(client, state, &action_id, false, Some("command 为空")).await;
            return;
        }

        // 用 Arc 拷贝传给 shell_exec(它需要 Arc<AppState>,而我们只有 &AppState)
        // 这里用一个小 hack:从 state 的字段重建 Arc 不可能,所以让 shell_exec 模块
        // 用 &AppState 也行——重写为接 &AppState。
        let exec_result = crate::shell_exec::run_with_approval_ref(
            state,
            action_id.clone(),
            command,
            reason,
            work_dir,
            timeout_ms,
        ).await;

        match exec_result {
            Ok(r) => {
                // success=true 仅当用户允许且命令真跑了(可能 exit_code != 0,但那是用户命令的事)。
                // 用户拒绝/超时 → success=false 让 LLM 看 error 字段知情;不是 infra 失败。
                let result = json!({
                    "actionId": action_id,
                    "success": r.approved,
                    "error": r.denial_reason,
                    "stdout": r.stdout,
                    "stderr": r.stderr,
                    "exitCode": r.exit_code,
                    "durationMs": r.duration_ms,
                    "timedOut": r.timed_out,
                });
                // ★ v0.8.0 命令真的跑过 → 缓存结果,防止重试重复执行
                if r.approved {
                    remember_action(state, &action_id, &result);
                }
                if let Err(e) = client.emit("client_action_result", result).await {
                    log::error!("[Protocol] Failed to send shell_exec result: {}", e);
                }
            }
            Err(e) => {
                send_action_result(client, state, &action_id, false, Some(&format!("shell_exec 内部错误: {}", e))).await;
            }
        }
        return;
    }

    // ★ P3 结构化数据工具优先处理（不需要屏幕交互，不需要安全检查坐标）
    if is_p3_tool(tool) {
        // ★ v0.8.0 会改动本地文件系统的 P3 工具(move/organize/rename/trash/group/archive/rollback)
        //   必须已授权。此前它们在授权检查之前就返回,未授权用户即可触发删/移文件——严重信任缺口。
        //   只读 P3 工具(list/search/app_info/window_bounds/taskbar 等)仍无需授权。
        if is_mutating_p3_tool(tool) && !*state.authorized.read() {
            send_action_result(
                client, state, &action_id, false,
                Some("该文件操作会改动本地文件,需先授权。请在客户端点「授权控制」后重试。"),
            ).await;
            return;
        }
        let p3_result = handle_p3_tool(tool, &params).await;
        if let Some(result_json) = p3_result {
            let mut data = result_json;
            data["actionId"] = json!(action_id);
            if data.get("success").is_none() {
                data["success"] = json!(true);
            }
            // ★ v0.8.0 缓存成功的 P3 结果(失败不缓存,允许纠错后重试)
            if data.get("success").and_then(|v| v.as_bool()) != Some(false) {
                remember_action(state, &action_id, &data);
            }
            if let Err(e) = client.emit("client_action_result", data).await {
                log::error!("[Protocol] Failed to send P3 result: {}", e);
            }
        } else {
            send_action_result(client, state, &action_id, false, Some(&format!("P3 工具 {} 处理失败", tool))).await;
        }
        return;
    }

    // ★ 授权检查（GUI 操作需要用户授权）
    if !*state.authorized.read() {
        // 截图和等待始终允许（不涉及 GUI 输入）
        if tool != "desktop.screenshot" && tool != "desktop.wait" {
            send_action_result(
                client, state, &action_id, false,
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
            send_action_result(client, state, &action_id, false, Some(&format!("未知工具: {}", tool))).await;
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
        send_action_result(client, state, &action_id, false, Some(&reason)).await;
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
                remember_action(state, &action_id, &result); // ★ v0.8.0 幂等缓存
                if let Err(e) = client.emit("client_action_result", result).await {
                    log::error!("[Protocol] Failed to send action result: {}", e);
                }
                return;
            }
            send_action_result(client, state, &action_id, true, None).await;
        }
        Err(e) => {
            log::error!("[Protocol] Action {} failed: {}", tool, e);
            send_action_result(client, state, &action_id, false, Some(&e)).await;
        }
    }
}

/// 检查是否为 P3 结构化数据工具
fn is_p3_tool(tool: &str) -> bool {
    matches!(tool,
        "desktop.list_monitors" | "desktop.switch_monitor" |
        "desktop.app_info" | "desktop.app_list" | "desktop.app_focus" |
        "desktop.file_list" | "desktop.file_search" | "desktop.file_move" | "desktop.file_archive" |
        // ★ v0.5.0 新增智能文件操作工具
        "desktop.file_organize" | "desktop.file_rename_batch" |
        "desktop.file_trash" | "desktop.file_group" | "desktop.file_rollback" |
        // ★ v0.6.0 新增跨端 OCR 文件工具(读字节回传服务端 Tesseract 识别)
        "desktop.ocr_file" |
        // ★ v0.6.0 补漏:p4VisionTools 在服务端注册过但客户端从来没有 handler
        "desktop.window_bounds" | "desktop.taskbar_info"
        // 注:desktop.shell_exec 不走 is_p3_tool / handle_p3_tool,
        //    因为它需要 AppState 做审批 park,在 handle_execute_action 里特殊分支。
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
/// ★ v0.8.0 新增 state 参数:成功的结果写入幂等缓存,供服务端重试时重发(而非重复执行)。
///   失败结果不缓存,以便纠错后(如用户补授权)重试能真正重跑。
async fn send_action_result(
    client: &rust_socketio::asynchronous::Client,
    state: &AppState,
    action_id: &str,
    success: bool,
    error: Option<&str>,
) {
    let result = json!({
        "actionId": action_id,
        "success": success,
        "error": error,
    });
    if success {
        remember_action(state, action_id, &result);
    }
    if let Err(e) = client.emit("client_action_result", result).await {
        log::error!("[Protocol] Failed to send action result: {}", e);
    }
}

/// 处理服务端配置更新
fn handle_config(payload: serde_json::Value, state: &AppState) {
    let mut config = state.server_config.write();

    // ★ v0.8.0 全部 clamp,避免服务端下发异常值(quality=0 / heartbeat=0 等)导致行为异常
    if let Some(q) = payload.get("screenshotQuality").and_then(|v| v.as_u64()) {
        config.screenshot_quality = (q as u8).clamp(1, 100);
    }
    if let Some(f) = payload.get("screenshotFormat").and_then(|v| v.as_str()) {
        config.screenshot_format = f.into();
    }
    if let Some(m) = payload.get("maxSteps").and_then(|v| v.as_u64()) {
        config.max_steps = (m as u32).clamp(1, 1000);
    }
    if let Some(h) = payload.get("heartbeatInterval").and_then(|v| v.as_u64()) {
        config.heartbeat_interval = h.clamp(1000, 120_000);
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

        // ── v0.5.0 智能文件操作 ──
        "desktop.file_organize" => {
            let source = params.get("source").and_then(|v| v.as_str()).unwrap_or("~/Desktop");
            let dry_run = params.get("dryRun").and_then(|v| v.as_bool()).unwrap_or(false);
            let create_folders = params.get("createFoldersIfMissing").and_then(|v| v.as_bool()).unwrap_or(true);
            let on_conflict = params.get("onConflict").and_then(|v| v.as_str()).unwrap_or("rename");

            // rules 字段: 可能是数组也可能是 JSON 字符串(playbook 模板填的)
            let rules_value = params.get("rules");
            let rules: Vec<crate::file_ops::OrganizeRule> = match rules_value {
                Some(serde_json::Value::Array(_)) => {
                    serde_json::from_value(rules_value.unwrap().clone()).unwrap_or_default()
                }
                Some(serde_json::Value::String(s)) => {
                    serde_json::from_str(s).unwrap_or_default()
                }
                _ => Vec::new(),
            };

            if rules.is_empty() {
                Some(json!({ "success": false, "error": "rules 参数缺失或为空" }))
            } else {
                match crate::file_ops::file_organize(source, &rules, dry_run, create_folders, on_conflict) {
                    Ok(r) => Some(json!(r)),
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            }
        }
        "desktop.file_rename_batch" => {
            let source = params.get("source").and_then(|v| v.as_str()).unwrap_or("~/Desktop");
            let pattern = params.get("pattern").and_then(|v| v.as_str()).unwrap_or("{name}");
            let ext_filter = params.get("extensionFilter").and_then(|v| v.as_str());
            let dry_run = params.get("dryRun").and_then(|v| v.as_bool()).unwrap_or(true);
            match crate::file_ops::file_rename_batch(source, pattern, ext_filter, dry_run) {
                Ok(r) => Some(json!(r)),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.file_trash" => {
            let paths: Vec<String> = params.get("paths")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if paths.is_empty() {
                Some(json!({ "success": false, "error": "paths 参数缺失或为空" }))
            } else {
                match crate::file_ops::file_trash(&paths) {
                    Ok(r) => Some(json!(r)),
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            }
        }
        "desktop.file_group" => {
            let source = params.get("source").and_then(|v| v.as_str()).unwrap_or("~/Desktop");
            let group_by = params.get("groupBy").and_then(|v| v.as_str()).unwrap_or("extension");
            let dry_run = params.get("dryRun").and_then(|v| v.as_bool()).unwrap_or(true);
            let output = params.get("outputFolder").and_then(|v| v.as_str());
            match crate::file_ops::file_group(source, group_by, dry_run, output) {
                Ok(r) => Some(json!(r)),
                Err(e) => Some(json!({ "success": false, "error": e })),
            }
        }
        "desktop.file_rollback" => {
            let txn_id = params.get("transactionId").and_then(|v| v.as_str()).unwrap_or("");
            if txn_id.is_empty() {
                Some(json!({ "success": false, "error": "transactionId 参数缺失" }))
            } else {
                match crate::file_ops::rollback_transaction(txn_id) {
                    Ok(undone) => Some(json!({ "rolledBack": true, "undoneCount": undone })),
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            }
        }

        // ── v0.6.0 跨端 OCR 文件读取 ──
        // 客户端只读字节,Tesseract 在服务端跑。
        // 返回 fileBytes(base64) / mimeType / sizeBytes,服务端 desktop.ocr_file 工具消费。
        "desktop.ocr_file" => {
            let path = params.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.is_empty() {
                Some(json!({ "success": false, "error": "path 参数缺失" }))
            } else {
                match crate::file_ops::read_image_as_base64(path) {
                    Ok((b64, mime, size)) => Some(json!({
                        "fileBytes": b64,
                        "mimeType": mime,
                        "sizeBytes": size,
                        "path": path,
                    })),
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            }
        }

        // ── v0.6.0 补漏:p4VisionTools 的窗口/任务栏感知 ──
        "desktop.window_bounds" => {
            // appName 可选;为空时返回前台窗口
            let app_name = params.get("appName").and_then(|v| v.as_str()).unwrap_or("");
            if app_name.is_empty() {
                match crate::system::get_active_window() {
                    Ok(info) => match info.bounds {
                        Some(b) => Some(json!({
                            "bounds": {
                                "x": b.x, "y": b.y,
                                "width": b.width, "height": b.height,
                            },
                            "appName": info.app_name,
                            "windowTitle": info.window_title,
                        })),
                        None => Some(json!({ "success": false, "error": "前台窗口无 bounds 信息" })),
                    },
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            } else {
                // 找指定 app 的窗口
                match crate::system::list_windows() {
                    Ok(windows) => {
                        let target = windows.iter().find(|w|
                            w.app_name.eq_ignore_ascii_case(app_name)
                                || w.app_name.contains(app_name)
                        );
                        match target {
                            Some(w) => Some(json!({
                                "bounds": {
                                    "x": w.x, "y": w.y,
                                    "width": w.width, "height": w.height,
                                },
                                "appName": w.app_name,
                                "windowTitle": w.title,
                            })),
                            None => Some(json!({
                                "success": false,
                                "error": format!("未找到名为 \"{}\" 的窗口", app_name)
                            })),
                        }
                    }
                    Err(e) => Some(json!({ "success": false, "error": e })),
                }
            }
        }
        "desktop.taskbar_info" => {
            // 平台启发式回报 — 不查 OS API,因为各平台都需要不同绑定。
            // 后续工程要做精确的话,Mac NSStatusBar/Dock,Win SHAppBarMessage,Linux varies。
            // 这里给 LLM 一个 "够用" 的默认值,避免它误点系统 UI。
            #[cfg(target_os = "macos")]
            let taskbar = json!({
                "position": "bottom",  // 默认 dock 在底部(用户也可能改到左/右,无 API 查)
                "width": 0u32, "height": 80u32,
                "autoHide": false,
                "platform": "macos",
                "note": "启发式默认值;用户可能自定义 Dock 位置",
            });
            #[cfg(target_os = "windows")]
            let taskbar = json!({
                "position": "bottom",
                "width": 0u32, "height": 40u32,
                "autoHide": false,
                "platform": "windows",
                "note": "启发式默认值",
            });
            #[cfg(target_os = "linux")]
            let taskbar = json!({
                "position": "bottom",
                "width": 0u32, "height": 32u32,
                "autoHide": false,
                "platform": "linux",
                "note": "启发式默认值;桌面环境差异大",
            });
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
            let taskbar = json!({
                "position": "unknown",
                "width": 0u32, "height": 0u32,
                "autoHide": false,
                "note": "未知平台",
            });

            Some(json!({ "taskbar": taskbar }))
        }

        _ => None,
    }
}
