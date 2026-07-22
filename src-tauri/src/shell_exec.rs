//! v0.7.0: Local shell execution with user approval gate.
//!
//! Flow:
//!   1. Server sends `desktop.shell_exec` action.
//!   2. We park a `ShellApprovalRequest` into AppState and create a oneshot channel.
//!   3. Frontend polls `get_status` → sees pending approval → renders modal.
//!   4. Frontend calls `respond_shell_approval(action_id, allow)` Tauri command.
//!   5. The command pulls the oneshot Sender and sends `allow`.
//!   6. We resume here with the boolean. Allowed → run command; denied → return rejected.
//!   7. Either way, we append to local audit log (JSONL in app data dir).
//!
//! Safety:
//!   - 60s execution timeout (enforced even if user allowed).
//!   - 50KB stdout + 50KB stderr cap.
//!   - 5min approval timeout (if user doesn't respond, default = denied).
//!   - Audit log is append-only, never read by us — purely for user post-hoc review.

use crate::state::{AppState, ShellApprovalRequest};
use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::oneshot;

const APPROVAL_TIMEOUT: Duration = Duration::from_secs(300);   // 5 min
const EXEC_HARD_TIMEOUT: Duration = Duration::from_secs(60);   // 60s — overrides server-suggested timeout
const MAX_OUTPUT_BYTES: usize = 50 * 1024;                     // 50 KB per stream

#[derive(Debug, Serialize)]
pub struct ShellExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub timed_out: bool,
    pub approved: bool,
    pub denial_reason: Option<String>,
}

/// Execute a shell command with user approval.
///
/// Protocol layer holds `&AppState` (not `Arc`), so this is the only signature.
/// If a future caller needs Arc, just call this with `&*arc`.
///
/// Returns `Err` only on internal infrastructure failures (channel closed, etc).
/// Approval rejection / timeout / command errors all return `Ok(...)` with appropriate fields.
pub async fn run_with_approval_ref(
    state: &AppState,
    action_id: String,
    command: String,
    reason: String,
    work_dir: Option<String>,
    requested_timeout_ms: u64,
) -> Result<ShellExecResult, String> {
    let start = std::time::Instant::now();

    // Cap timeout to hard limit
    let exec_timeout = Duration::from_millis(requested_timeout_ms.min(EXEC_HARD_TIMEOUT.as_millis() as u64));

    // 1. Park approval request + create oneshot
    let (tx, rx) = oneshot::channel::<bool>();
    {
        let req = ShellApprovalRequest {
            action_id: action_id.clone(),
            command: command.clone(),
            reason: reason.clone(),
            work_dir: work_dir.clone(),
            timeout_ms: exec_timeout.as_millis() as u64,
            requested_at: chrono::Utc::now().timestamp_millis(),
        };
        state.pending_shell_approvals.write().push(req);
        state.shell_approval_responders.write().insert(action_id.clone(), tx);
    }
    // ★ v0.8.0 把主窗口弹到前台并请求用户注意——否则审批模态可能藏在托盘里的后台窗口,
    //   用户根本看不到,5 分钟后静默自动拒绝,任务莫名失败。
    crate::protocol::surface_main_window(state);
    log::info!("[shell_exec] approval requested: action={}, cmd={}", action_id, &command.chars().take(80).collect::<String>());

    // 2. Wait for response or timeout
    let approved = match tokio::time::timeout(APPROVAL_TIMEOUT, rx).await {
        Ok(Ok(b)) => b,
        Ok(Err(_)) => {
            // Sender dropped without sending — treat as denied
            log::warn!("[shell_exec] approval channel closed unexpectedly: action={}", action_id);
            cleanup_approval(&state, &action_id);
            audit_log(&action_id, &command, &reason, "denied_channel_closed", None);
            return Ok(denied("审批通道意外关闭".into()));
        }
        Err(_) => {
            // Timeout
            log::warn!("[shell_exec] approval timeout: action={}", action_id);
            cleanup_approval(&state, &action_id);
            audit_log(&action_id, &command, &reason, "denied_timeout", None);
            return Ok(denied("用户 5 分钟未响应,自动拒绝".into()));
        }
    };

    cleanup_approval(&state, &action_id);

    if !approved {
        audit_log(&action_id, &command, &reason, "denied_by_user", None);
        return Ok(denied("用户在弹窗中点击了拒绝".into()));
    }

    // 3. User approved — execute the command
    log::info!("[shell_exec] approved, executing: action={}", action_id);
    let exec_result = execute_command(&command, work_dir.as_deref(), exec_timeout).await;
    let duration_ms = start.elapsed().as_millis() as u64;

    match exec_result {
        Ok((stdout, stderr, exit_code, timed_out)) => {
            let stdout_clamped = clamp_bytes(stdout);
            let stderr_clamped = clamp_bytes(stderr);
            audit_log(
                &action_id,
                &command,
                &reason,
                if timed_out { "executed_timeout" } else { "executed_ok" },
                Some(exit_code),
            );
            Ok(ShellExecResult {
                stdout: stdout_clamped,
                stderr: stderr_clamped,
                exit_code,
                duration_ms,
                timed_out,
                approved: true,
                denial_reason: None,
            })
        }
        Err(e) => {
            audit_log(&action_id, &command, &reason, "executed_error", None);
            Ok(ShellExecResult {
                stdout: String::new(),
                stderr: format!("[执行错误] {}", e),
                exit_code: -1,
                duration_ms,
                timed_out: false,
                approved: true,
                denial_reason: None,
            })
        }
    }
}

fn cleanup_approval(state: &AppState, action_id: &str) {
    state.pending_shell_approvals.write().retain(|r| r.action_id != action_id);
    state.shell_approval_responders.write().remove(action_id);
}

fn denied(reason: String) -> ShellExecResult {
    ShellExecResult {
        stdout: String::new(),
        stderr: String::new(),
        exit_code: -1,
        duration_ms: 0,
        timed_out: false,
        approved: false,
        denial_reason: Some(reason),
    }
}

/// Run the actual command. Returns (stdout, stderr, exit_code, timed_out).
async fn execute_command(
    command: &str,
    work_dir: Option<&str>,
    timeout: Duration,
) -> Result<(String, String, i32, bool), String> {
    // Resolve work_dir: ~ expansion or fall back to home
    let cwd = match work_dir {
        Some(p) if !p.is_empty() => crate::file_ops::expand_home_for_shell(p),
        // ★ 2026-05-04 改用 file_ops::user_home 避免 dirs crate 中文用户名截断
        _ => crate::file_ops::user_home().unwrap_or_else(|| std::env::current_dir().unwrap_or_default()),
    };

    // Cross-platform shell selection
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", command]);
        c
    } else {
        let mut c = Command::new("bash");
        c.args(["-lc", command]);
        c
    };
    cmd.current_dir(&cwd);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    // ★ v0.8.0 kill_on_drop:超时/取消时,持有子进程的 future 被 drop → tokio 自动 SIGKILL,
    //   不再泄漏孤儿进程(此前 output() 超时后进程仍在后台跑,句柄丢失无法回收)。
    cmd.kill_on_drop(true);

    // Spawn, then wait under a timeout. On timeout the wait future is dropped,
    // which drops the Child and (via kill_on_drop) terminates the process.
    let child = cmd.spawn().map_err(|e| format!("启动命令失败: {}", e))?;
    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let code = out.status.code().unwrap_or(-1);
            Ok((stdout, stderr, code, false))
        }
        Ok(Err(e)) => Err(format!("等待命令结束失败: {}", e)),
        Err(_) => Ok((
            "".into(),
            format!("命令执行超过 {}ms 超时(子进程已被终止)", timeout.as_millis()),
            -1,
            true,
        )),
    }
}

fn clamp_bytes(s: String) -> String {
    if s.len() <= MAX_OUTPUT_BYTES {
        return s;
    }
    let half = MAX_OUTPUT_BYTES / 2;
    // Be careful with UTF-8 boundaries
    let head_end = floor_char_boundary(&s, half);
    let tail_start = ceil_char_boundary(&s, s.len().saturating_sub(half));
    format!(
        "{}\n\n... [输出过长,省略 {} 字节] ...\n\n{}",
        &s[..head_end],
        s.len() - MAX_OUTPUT_BYTES,
        &s[tail_start..],
    )
}

fn floor_char_boundary(s: &str, mut idx: usize) -> usize {
    if idx >= s.len() { return s.len(); }
    while idx > 0 && !s.is_char_boundary(idx) { idx -= 1; }
    idx
}

fn ceil_char_boundary(s: &str, mut idx: usize) -> usize {
    while idx < s.len() && !s.is_char_boundary(idx) { idx += 1; }
    idx
}

/// Append a line to the audit log JSONL file.
/// Best-effort: any I/O error is logged but doesn't fail the operation.
///
/// Path:
///   - macOS:   ~/Library/Application Support/InsiDesktop/shell_audit.jsonl
///   - Linux:   ~/.local/share/InsiDesktop/shell_audit.jsonl
///   - Windows: %APPDATA%/Roaming/InsiDesktop/shell_audit.jsonl
/// (Same folder as crash logs at main.rs:init_crash_logging — keep app data in one place.)
fn audit_log(action_id: &str, command: &str, reason: &str, outcome: &str, exit_code: Option<i32>) {
    let dir = match dirs::data_dir() {
        Some(p) => p.join("InsiDesktop"),
        None => return,
    };
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!("[shell_exec] audit_log: cannot create dir: {}", e);
        return;
    }
    let path = dir.join("shell_audit.jsonl");
    let entry = serde_json::json!({
        "ts": chrono::Utc::now().to_rfc3339(),
        "action_id": action_id,
        "command": command,
        "reason": reason,
        "outcome": outcome,  // approved|denied_by_user|denied_timeout|denied_channel_closed|executed_ok|executed_timeout|executed_error
        "exit_code": exit_code,
    });
    let line = format!("{}\n", entry);
    if let Err(e) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, line.as_bytes()))
    {
        log::warn!("[shell_exec] audit_log: cannot write: {}", e);
    }
}
