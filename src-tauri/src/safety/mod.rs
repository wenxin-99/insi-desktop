//! 安全沙箱
//!
//! 客户端侧安全机制，三层防护中的第一层。
//! 在执行任何操作前进行安全检查。

use serde::Deserialize;

/// 操作类型
#[derive(Debug, Clone, Deserialize)]
pub enum ActionType {
    Click,
    DoubleClick,
    Drag,
    Type,
    Hotkey,
    Scroll,
    Screenshot,
    Wait,
    Clipboard,
}

/// 安全检查结果
#[derive(Debug)]
pub struct SafetyResult {
    pub allowed: bool,
    pub reason: Option<String>,
    pub needs_confirmation: bool,
}

impl SafetyResult {
    fn allow() -> Self {
        Self { allowed: true, reason: None, needs_confirmation: false }
    }

    fn deny(reason: &str) -> Self {
        Self { allowed: false, reason: Some(reason.into()), needs_confirmation: false }
    }

    fn _confirm(reason: &str) -> Self {
        Self { allowed: true, reason: Some(reason.into()), needs_confirmation: true }
    }
}

/// 检查坐标是否在危险区域（任务栏、菜单栏、系统托盘）
pub fn is_dangerous_area(
    x: i32,
    y: i32,
    screen_width: u32,
    screen_height: u32,
    platform: &str,
) -> bool {
    match platform {
        "windows" => {
            // Windows 任务栏（底部，通常 48px 高）
            if y > (screen_height as i32 - 48) {
                return true;
            }
            // 系统托盘区域（右下角）
            if y > (screen_height as i32 - 48) && x > (screen_width as i32 - 300) {
                return true;
            }
            false
        }
        "macos" => {
            // macOS 菜单栏（顶部，25-30px）
            if y < 28 {
                return true;
            }
            false
        }
        "linux" => {
            // Linux 通常顶部有面板（28px）
            if y < 28 {
                return true;
            }
            false
        }
        _ => false,
    }
}

/// 检查快捷键是否安全
pub fn is_dangerous_hotkey(keys: &[String]) -> Option<String> {
    let normalized: Vec<String> = keys.iter().map(|k| k.to_lowercase()).collect();
    let key_str = normalized.join("+");

    // 完全禁止的快捷键
    let blocked = [
        ("ctrl+alt+delete", "系统安全操作"),
        ("ctrl+alt+del", "系统安全操作"),
        ("cmd+option+esc", "强制退出管理器"),
        // ★ macOS 危险组合
        ("cmd+shift+q", "退出登录/注销"),
        ("cmd+ctrl+q", "锁定屏幕"),
        ("cmd+option+power", "睡眠"),
        ("cmd+ctrl+power", "强制重启"),
        // ★ Windows 危险组合
        ("win+l", "锁定计算机"),
    ];

    for (combo, reason) in &blocked {
        if key_str == *combo {
            return Some(format!("危险快捷键 {}: {}", combo, reason));
        }
    }

    // 需要确认的快捷键（允许但记录日志）
    let confirm_needed = [
        ("alt+f4", "关闭当前窗口"),
        ("cmd+q", "退出当前应用"),
        ("ctrl+w", "关闭当前标签页"),
        ("cmd+w", "关闭当前窗口"),
    ];

    for (combo, _reason) in &confirm_needed {
        if key_str == *combo {
            log::warn!("执行可能关闭窗口的快捷键: {}", combo);
            return None;
        }
    }

    None
}

/// 检查输入文字是否安全（不包含密码等敏感信息）
pub fn is_sensitive_text(text: &str) -> bool {
    if text.len() >= 6 && text.len() <= 64 {
        let has_upper = text.chars().any(|c| c.is_uppercase());
        let has_lower = text.chars().any(|c| c.is_lowercase());
        let has_digit = text.chars().any(|c| c.is_ascii_digit());
        let has_special = text.chars().any(|c| !c.is_alphanumeric() && !c.is_whitespace());
        let no_spaces = !text.contains(' ');

        if has_upper && has_lower && has_digit && has_special && no_spaces {
            return true;
        }
    }

    let lower = text.to_lowercase();
    let sensitive_patterns = [
        "password:", "passwd:", "密码:", "pin:",
        "ssh ", "su ", "sudo ",
    ];

    for pat in &sensitive_patterns {
        if lower.contains(pat) {
            return true;
        }
    }

    false
}

/// 综合安全检查
pub fn check_action_safety(
    action_type: &ActionType,
    x: Option<i32>,
    y: Option<i32>,
    screen_width: u32,
    screen_height: u32,
    platform: &str,
    extra_params: Option<&serde_json::Value>,
) -> SafetyResult {
    match action_type {
        ActionType::Screenshot | ActionType::Wait | ActionType::Clipboard => {
            // 截图、等待和剪贴板始终安全
            SafetyResult::allow()
        }

        ActionType::Click | ActionType::DoubleClick => {
            if let (Some(x), Some(y)) = (x, y) {
                if is_dangerous_area(x, y, screen_width, screen_height, platform) {
                    return SafetyResult::deny(&format!(
                        "坐标 ({}, {}) 位于系统保护区域",
                        x, y
                    ));
                }
            }
            SafetyResult::allow()
        }

        ActionType::Drag => {
            if let Some(params) = extra_params {
                let from_x = params.get("fromX").and_then(|v| v.as_i64()).map(|v| v as i32);
                let from_y = params.get("fromY").and_then(|v| v.as_i64()).map(|v| v as i32);
                let to_x = params.get("toX").and_then(|v| v.as_i64()).map(|v| v as i32);
                let to_y = params.get("toY").and_then(|v| v.as_i64()).map(|v| v as i32);

                for (px, py) in [(from_x, from_y), (to_x, to_y)] {
                    if let (Some(px), Some(py)) = (px, py) {
                        if is_dangerous_area(px, py, screen_width, screen_height, platform) {
                            return SafetyResult::deny(&format!(
                                "拖拽涉及系统保护区域 ({}, {})",
                                px, py
                            ));
                        }
                    }
                }
            }
            SafetyResult::allow()
        }

        ActionType::Type => {
            if let Some(params) = extra_params {
                if let Some(text) = params.get("text").and_then(|v| v.as_str()) {
                    if is_sensitive_text(text) {
                        return SafetyResult::deny("检测到可能是敏感信息（密码等），已拒绝输入");
                    }
                }
            }
            SafetyResult::allow()
        }

        ActionType::Hotkey => {
            if let Some(params) = extra_params {
                if let Some(keys) = params.get("keys").and_then(|v| v.as_array()) {
                    let key_strs: Vec<String> = keys
                        .iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect();

                    if let Some(reason) = is_dangerous_hotkey(&key_strs) {
                        return SafetyResult::deny(&reason);
                    }
                }
            }
            SafetyResult::allow()
        }

        ActionType::Scroll => SafetyResult::allow(),
    }
}
