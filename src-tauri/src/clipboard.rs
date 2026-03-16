//! 剪贴板读写
//!
//! 跨平台剪贴板操作，供 desktop.clipboard_read / clipboard_write 使用。
//! 使用 arboard crate 实现。

/// 读取剪贴板文字内容
pub fn read_clipboard() -> Result<String, String> {
    use std::process::Command;

    // 使用平台命令读取剪贴板（arboard 在无头环境下可能失败，这里用更稳健的方式）
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-Command", "Get-Clipboard"])
            .output()
            .map_err(|e| format!("读取剪贴板失败: {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("pbpaste")
            .output()
            .map_err(|e| format!("读取剪贴板失败: {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    #[cfg(target_os = "linux")]
    {
        // 优先 xclip，fallback xsel
        let output = Command::new("xclip")
            .args(["-selection", "clipboard", "-o"])
            .output()
            .or_else(|_| {
                Command::new("xsel")
                    .args(["--clipboard", "--output"])
                    .output()
            })
            .map_err(|e| format!("读取剪贴板失败 (需要 xclip 或 xsel): {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

/// 写入文字到剪贴板
pub fn write_clipboard(text: &str) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    #[cfg(target_os = "windows")]
    {
        let escaped = text.replace("'", "''");
        Command::new("powershell")
            .args(["-Command", &format!("Set-Clipboard -Value '{}'", escaped)])
            .output()
            .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        if let Some(ref mut stdin) = child.stdin {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        }
        child
            .wait()
            .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        let mut child = Command::new("xclip")
            .args(["-selection", "clipboard"])
            .stdin(Stdio::piped())
            .spawn()
            .or_else(|_| {
                Command::new("xsel")
                    .args(["--clipboard", "--input"])
                    .stdin(Stdio::piped())
                    .spawn()
            })
            .map_err(|e| format!("写入剪贴板失败 (需要 xclip 或 xsel): {}", e))?;

        if let Some(ref mut stdin) = child.stdin {
            stdin
                .write_all(text.as_bytes())
                .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        }
        child
            .wait()
            .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        Ok(())
    }
}
