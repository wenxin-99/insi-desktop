//! 输入控制器
//!
//! 使用 enigo 库实现跨平台鼠标/键盘模拟：
//!   - Windows: SendInput API
//!   - macOS: CGEvent
//!   - Linux: XTest / libei
//!
//! 所有坐标均为屏幕物理像素坐标。

use enigo::{
    Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings,
};
use serde::Deserialize;
use std::thread;
use std::time::Duration;

/// 鼠标按键
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

impl From<&MouseButton> for Button {
    fn from(btn: &MouseButton) -> Self {
        match btn {
            MouseButton::Left => Button::Left,
            MouseButton::Right => Button::Right,
            MouseButton::Middle => Button::Middle,
        }
    }
}

/// 创建 enigo 实例
fn new_enigo() -> Result<Enigo, String> {
    Enigo::new(&Settings::default()).map_err(|e| format!("初始化输入控制器失败: {}", e))
}

// ═══════════════════════════════════════════
// 鼠标操作
// ═══════════════════════════════════════════

/// 移动鼠标到绝对坐标
pub fn mouse_move(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = new_enigo()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("移动鼠标失败: {}", e))
}

/// 鼠标点击
pub fn mouse_click(x: i32, y: i32, button: &MouseButton) -> Result<(), String> {
    let mut enigo = new_enigo()?;

    // 先移动到目标位置
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("移动鼠标失败: {}", e))?;

    // 短暂延迟确保移动完成
    thread::sleep(Duration::from_millis(30));

    // 点击
    let btn = Button::from(button);
    enigo
        .button(btn, Direction::Click)
        .map_err(|e| format!("鼠标点击失败: {}", e))
}

/// 鼠标双击
pub fn mouse_double_click(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = new_enigo()?;

    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("移动鼠标失败: {}", e))?;
    thread::sleep(Duration::from_millis(30));

    enigo
        .button(Button::Left, Direction::Click)
        .map_err(|e| format!("双击失败(1): {}", e))?;
    thread::sleep(Duration::from_millis(50));
    enigo
        .button(Button::Left, Direction::Click)
        .map_err(|e| format!("双击失败(2): {}", e))
}

/// 鼠标拖拽
pub fn mouse_drag(from_x: i32, from_y: i32, to_x: i32, to_y: i32) -> Result<(), String> {
    let mut enigo = new_enigo()?;

    // 移动到起点
    enigo
        .move_mouse(from_x, from_y, Coordinate::Abs)
        .map_err(|e| format!("移动到起点失败: {}", e))?;
    thread::sleep(Duration::from_millis(50));

    // 按下左键
    enigo
        .button(Button::Left, Direction::Press)
        .map_err(|e| format!("按下鼠标失败: {}", e))?;
    thread::sleep(Duration::from_millis(50));

    // 分步移动到终点（平滑拖拽）
    let steps = 20;
    let dx = (to_x - from_x) as f64 / steps as f64;
    let dy = (to_y - from_y) as f64 / steps as f64;

    for i in 1..=steps {
        let cx = from_x + (dx * i as f64) as i32;
        let cy = from_y + (dy * i as f64) as i32;
        enigo
            .move_mouse(cx, cy, Coordinate::Abs)
            .map_err(|e| format!("拖拽移动失败: {}", e))?;
        thread::sleep(Duration::from_millis(10));
    }

    // 确保到达终点
    enigo
        .move_mouse(to_x, to_y, Coordinate::Abs)
        .map_err(|e| format!("到达终点失败: {}", e))?;
    thread::sleep(Duration::from_millis(50));

    // 松开左键
    enigo
        .button(Button::Left, Direction::Release)
        .map_err(|e| format!("松开鼠标失败: {}", e))
}

/// 滚轮滚动
pub fn scroll(x: i32, y: i32, delta: i32) -> Result<(), String> {
    let mut enigo = new_enigo()?;

    // 移动到指定位置
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("移动鼠标失败: {}", e))?;
    thread::sleep(Duration::from_millis(30));

    // 滚动（enigo 正值向上，负值向下，与协议一致）
    enigo
        .scroll(delta, enigo::Axis::Vertical)
        .map_err(|e| format!("滚动失败: {}", e))
}

// ═══════════════════════════════════════════
// 键盘操作
// ═══════════════════════════════════════════

/// 输入文字（逐字符）
pub fn key_type(text: &str) -> Result<(), String> {
    let mut enigo = new_enigo()?;
    enigo
        .text(text)
        .map_err(|e| format!("输入文字失败: {}", e))
}

/// 按快捷键组合
///
/// keys 示例: ["ctrl", "c"] / ["cmd", "shift", "n"] / ["alt", "tab"]
pub fn key_press(keys: &[String]) -> Result<(), String> {
    if keys.is_empty() {
        return Err("按键列表不能为空".into());
    }

    let mut enigo = new_enigo()?;

    // 分离修饰键和普通键
    let mut modifiers = Vec::new();
    let mut regular_keys = Vec::new();

    for key_str in keys {
        match parse_key(key_str) {
            ParsedKey::Modifier(k) => modifiers.push(k),
            ParsedKey::Regular(k) => regular_keys.push(k),
        }
    }

    // 按下所有修饰键
    for m in &modifiers {
        enigo
            .key(*m, Direction::Press)
            .map_err(|e| format!("按下修饰键失败: {}", e))?;
    }

    // 按下并松开普通键
    for k in &regular_keys {
        enigo
            .key(*k, Direction::Click)
            .map_err(|e| format!("按键失败: {}", e))?;
    }

    // 如果没有普通键，最后一个修饰键当作 Click
    if regular_keys.is_empty() && !modifiers.is_empty() {
        // 已经按下了，直接松开就好
    }

    // 松开所有修饰键（逆序）
    for m in modifiers.iter().rev() {
        enigo
            .key(*m, Direction::Release)
            .map_err(|e| format!("松开修饰键失败: {}", e))?;
    }

    Ok(())
}

enum ParsedKey {
    Modifier(Key),
    Regular(Key),
}

fn parse_key(key_str: &str) -> ParsedKey {
    let lower = key_str.to_lowercase();
    match lower.as_str() {
        // 修饰键
        "ctrl" | "control" => ParsedKey::Modifier(Key::Control),
        "alt" | "option" => ParsedKey::Modifier(Key::Alt),
        "shift" => ParsedKey::Modifier(Key::Shift),
        "meta" | "cmd" | "command" | "win" | "super" => ParsedKey::Modifier(Key::Meta),

        // 功能键
        "enter" | "return" => ParsedKey::Regular(Key::Return),
        "tab" => ParsedKey::Regular(Key::Tab),
        "escape" | "esc" => ParsedKey::Regular(Key::Escape),
        "space" | " " => ParsedKey::Regular(Key::Space),
        "backspace" | "back" => ParsedKey::Regular(Key::Backspace),
        "delete" | "del" => ParsedKey::Regular(Key::Delete),
        "home" => ParsedKey::Regular(Key::Home),
        "end" => ParsedKey::Regular(Key::End),
        "pageup" | "page_up" => ParsedKey::Regular(Key::PageUp),
        "pagedown" | "page_down" => ParsedKey::Regular(Key::PageDown),
        "up" | "arrowup" => ParsedKey::Regular(Key::UpArrow),
        "down" | "arrowdown" => ParsedKey::Regular(Key::DownArrow),
        "left" | "arrowleft" => ParsedKey::Regular(Key::LeftArrow),
        "right" | "arrowright" => ParsedKey::Regular(Key::RightArrow),
        "capslock" | "caps_lock" => ParsedKey::Regular(Key::CapsLock),

        // F 键
        "f1" => ParsedKey::Regular(Key::F1),
        "f2" => ParsedKey::Regular(Key::F2),
        "f3" => ParsedKey::Regular(Key::F3),
        "f4" => ParsedKey::Regular(Key::F4),
        "f5" => ParsedKey::Regular(Key::F5),
        "f6" => ParsedKey::Regular(Key::F6),
        "f7" => ParsedKey::Regular(Key::F7),
        "f8" => ParsedKey::Regular(Key::F8),
        "f9" => ParsedKey::Regular(Key::F9),
        "f10" => ParsedKey::Regular(Key::F10),
        "f11" => ParsedKey::Regular(Key::F11),
        "f12" => ParsedKey::Regular(Key::F12),

        // 单字符
        s if s.len() == 1 => {
            let c = s.chars().next().unwrap();
            ParsedKey::Regular(Key::Unicode(c))
        }

        // 未知键，当作 Unicode
        _ => {
            log::warn!("未知按键: {}, 尝试作为字符处理", key_str);
            if let Some(c) = key_str.chars().next() {
                ParsedKey::Regular(Key::Unicode(c))
            } else {
                ParsedKey::Regular(Key::Space) // fallback
            }
        }
    }
}
