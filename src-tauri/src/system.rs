//! 系统能力模块
//!
//! 提供 P3 生态集成所需的系统级操作：
//!   - 多显示器枚举与切换
//!   - 活跃窗口/应用识别
//!   - 文件系统操作（列目录、搜索、移动、归档）
//!
//! 跨平台实现。

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ═══════════════════════════════════════════
// 多显示器
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize)]
pub struct MonitorInfo {
    pub index: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale: f64,
    pub primary: bool,
}

/// 列出所有显示器
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i as u32,
            name: m.name().unwrap_or_default(),
            width: m.width().unwrap_or(0),
            height: m.height().unwrap_or(0),
            x: m.x().unwrap_or(0),
            y: m.y().unwrap_or(0),
            scale: m.scale_factor().unwrap_or(1.0) as f64,
            primary: m.is_primary().unwrap_or(false),
        })
        .collect())
}

/// 在指定显示器上截图
pub fn capture_monitor(index: usize, quality: u8) -> Result<crate::screenshot::CaptureResult, String> {
    use xcap::Monitor;
    use base64::Engine;
    use image::{DynamicImage, codecs::webp::WebPEncoder, ImageEncoder};
    use std::io::Cursor;

    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
    let monitor = monitors.get(index).ok_or_else(|| format!("显示器 {} 不存在，共 {} 个", index, monitors.len()))?;

    let raw = monitor.capture_image().map_err(|e| format!("截屏失败: {}", e))?;
    let (w, h) = (raw.width(), raw.height());
    let dyn_img = DynamicImage::ImageRgba8(raw);
    let rgba = dyn_img.to_rgba8();

    let mut buf = Cursor::new(Vec::new());
    let enc = WebPEncoder::new_lossless(&mut buf);
    enc.write_image(&rgba, w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("编码失败: {}", e))?;

    Ok(crate::screenshot::CaptureResult {
        image_base64: base64::engine::general_purpose::STANDARD.encode(buf.into_inner()),
        width: w,
        height: h,
    })
}

// ═══════════════════════════════════════════
// 应用程序识别
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize)]
pub struct ActiveWindowInfo {
    pub app_name: String,
    pub window_title: String,
    pub pid: u32,
    pub bounds: Option<WindowBounds>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowListItem {
    pub app_name: String,
    pub title: String,
    pub pid: u32,
    pub focused: bool,
}

/// 获取当前活跃窗口信息
pub fn get_active_window() -> Result<ActiveWindowInfo, String> {
    // 跨平台：使用 xcap 的 Window API
    use xcap::Window;

    let windows = Window::all().map_err(|e| format!("获取窗口失败: {}", e))?;

    // 找到当前聚焦的窗口（通常是第一个）
    let focused = windows.first().ok_or("未找到活跃窗口")?;

    Ok(ActiveWindowInfo {
        app_name: focused.app_name().unwrap_or_default(),
        window_title: focused.title().unwrap_or_default(),
        pid: focused.pid().unwrap_or(0),
        bounds: Some(WindowBounds {
            x: focused.x().unwrap_or(0),
            y: focused.y().unwrap_or(0),
            width: focused.width().unwrap_or(0),
            height: focused.height().unwrap_or(0),
        }),
    })
}

/// 列出所有窗口
pub fn list_windows() -> Result<Vec<WindowListItem>, String> {
    use xcap::Window;

    let windows = Window::all().map_err(|e| format!("获取窗口失败: {}", e))?;

    Ok(windows
        .iter()
        .enumerate()
        .map(|(i, w)| WindowListItem {
            app_name: w.app_name().unwrap_or_default(),
            title: w.title().unwrap_or_default(),
            pid: w.pid().unwrap_or(0),
            focused: i == 0,
        })
        .collect())
}

/// 聚焦到指定窗口
/// 通过 app_name 模糊匹配，使用平台命令切换
pub fn focus_window(app_name: &str, window_title: Option<&str>) -> Result<(), String> {
    use std::process::Command;
    let app_lower = app_name.to_lowercase();

    #[cfg(target_os = "windows")]
    {
        // ★ 使用 stdin 传搜索词，避免 PowerShell 命令注入
        use std::io::Write;
        let search_term = window_title.unwrap_or(app_name);
        let script = r#"
            $search = $input | Out-String
            $search = $search.Trim()
            $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match $search -or $_.MainWindowTitle -match $search) }
            $p = $procs | Select-Object -First 1
            if ($p) {
                $wshell = New-Object -ComObject wscript.shell
                $wshell.AppActivate($p.Id)
            }
        "#;
        let mut child = Command::new("powershell")
            .args(["-Command", script])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("窗口切换失败: {}", e))?;
        if let Some(ref mut stdin) = child.stdin {
            let _ = stdin.write_all(search_term.as_bytes());
        }
        child.wait().map_err(|e| format!("窗口切换失败: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "{}" to activate"#,
            app_name
        );
        Command::new("osascript").args(["-e", &script]).output()
            .map_err(|e| format!("窗口切换失败: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        // wmctrl 或 xdotool
        let search = window_title.unwrap_or(app_name);
        Command::new("wmctrl").args(["-a", search]).output()
            .or_else(|_| Command::new("xdotool").args(["search", "--name", search, "windowactivate"]).output())
            .map_err(|e| format!("窗口切换失败 (需要 wmctrl 或 xdotool): {}", e))?;
        Ok(())
    }
}

// ═══════════════════════════════════════════
// 文件系统操作
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
    pub extension: String,
}

/// 列出目录内容
pub fn list_directory(path: &str, recursive: bool, pattern: Option<&str>) -> Result<Vec<FileEntry>, String> {
    let dir_path = expand_home(path);
    if !dir_path.exists() {
        return Err(format!("目录不存在: {}", path));
    }

    let mut entries = Vec::new();
    collect_entries(&dir_path, recursive, pattern, &mut entries, 0, 3)?;
    Ok(entries)
}

fn collect_entries(
    dir: &Path, recursive: bool, pattern: Option<&str>,
    entries: &mut Vec<FileEntry>, depth: u32, max_depth: u32,
) -> Result<(), String> {
    if depth > max_depth { return Ok(()); }

    let read = fs::read_dir(dir).map_err(|e| format!("读取目录失败 {}: {}", dir.display(), e))?;

    for entry in read {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件
        if name.starts_with('.') { continue; }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_dir = metadata.is_dir();
        let ext = if is_dir { String::new() } else {
            Path::new(&name).extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default()
        };

        // 模式过滤
        if let Some(pat) = pattern {
            if !is_dir {
                let pat_lower = pat.to_lowercase();
                if pat_lower.starts_with("*.") {
                    let filter_ext = &pat_lower[2..];
                    if ext.to_lowercase() != filter_ext { continue; }
                } else if !name.to_lowercase().contains(&pat_lower) {
                    continue;
                }
            }
        }

        let modified = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| {
                let secs = d.as_secs();
                let dt = chrono::DateTime::from_timestamp(secs as i64, 0)
                    .unwrap_or_default();
                dt.format("%Y-%m-%d %H:%M").to_string()
            })
            .unwrap_or_default();

        entries.push(FileEntry {
            name: name.clone(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size: if is_dir { 0 } else { metadata.len() },
            modified,
            extension: ext,
        });

        if is_dir && recursive {
            collect_entries(&entry.path(), true, pattern, entries, depth + 1, max_depth)?;
        }
    }

    Ok(())
}

/// 搜索文件
pub fn search_files(
    path: &str, query: Option<&str>, extension: Option<&str>,
    min_size: Option<u64>, max_size: Option<u64>,
) -> Result<Vec<FileEntry>, String> {
    let all = list_directory(path, true, None)?;

    Ok(all
        .into_iter()
        .filter(|f| {
            if f.is_dir { return false; }

            if let Some(q) = query {
                if !f.name.to_lowercase().contains(&q.to_lowercase()) { return false; }
            }
            if let Some(ext) = extension {
                if f.extension.to_lowercase() != ext.to_lowercase() { return false; }
            }
            if let Some(min) = min_size {
                if f.size < min * 1024 * 1024 { return false; }
            }
            if let Some(max) = max_size {
                if f.size > max * 1024 * 1024 { return false; }
            }
            true
        })
        .collect())
}

/// 移动文件/目录
pub fn move_file(source: &str, destination: &str) -> Result<u32, String> {
    let src = expand_home(source);
    let dst = expand_home(destination);

    if !src.exists() {
        return Err(format!("源路径不存在: {}", source));
    }

    // 如果目标是目录，把源移进去
    if dst.is_dir() {
        let file_name = src.file_name().ok_or("无法获取文件名")?;
        let new_dst = dst.join(file_name);
        fs::rename(&src, &new_dst).map_err(|e| format!("移动失败: {}", e))?;
        return Ok(1);
    }

    // 确保目标父目录存在
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目标目录失败: {}", e))?;
    }

    fs::rename(&src, &dst).map_err(|e| format!("移动失败: {}", e))?;
    Ok(1)
}

/// 创建 zip 归档
pub fn create_archive(sources: &[String], output: &str) -> Result<(), String> {
    use std::process::Command;

    let out_path = expand_home(output);

    // 确保目标目录存在
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 使用系统 zip 命令
    let source_paths: Vec<String> = sources.iter()
        .map(|s| expand_home(s).to_string_lossy().to_string())
        .collect();

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Compress-Archive -Path '{}' -DestinationPath '{}' -Force",
            source_paths.join("','"),
            out_path.to_string_lossy()
        );
        Command::new("powershell").args(["-Command", &script]).output()
            .map_err(|e| format!("归档失败: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut args = vec!["-r".to_string(), out_path.to_string_lossy().to_string()];
        args.extend(source_paths);
        Command::new("zip").args(&args).output()
            .map_err(|e| format!("归档失败 (需要 zip 命令): {}", e))?;
    }

    Ok(())
}

/// 展开 ~ 为 home 目录
fn expand_home(path: &str) -> PathBuf {
    if path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}
