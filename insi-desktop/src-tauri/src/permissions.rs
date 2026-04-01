//! macOS 权限检测与引导
//!
//! Insi Desktop 在 macOS 上需要两项系统权限：
//!   1. **屏幕录制**（Screen Recording）— xcap 截屏需要
//!   2. **辅助功能**（Accessibility）— enigo 模拟输入需要
//!
//! 本模块提供权限状态检测和系统偏好设置跳转。
//! Windows/Linux 不需要这些权限，返回全部已授权。

use serde::{Deserialize, Serialize};

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatus {
    /// 屏幕录制权限
    pub screen_recording: bool,
    /// 辅助功能权限
    pub accessibility: bool,
    /// 是否所有必需权限都已授权
    pub all_granted: bool,
    /// 当前平台是否需要权限检查
    pub platform_requires_check: bool,
}

/// 检测所有权限
pub fn check_all_permissions() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        let screen = check_screen_recording();
        let accessibility = check_accessibility();
        PermissionStatus {
            screen_recording: screen,
            accessibility,
            all_granted: screen && accessibility,
            platform_requires_check: true,
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        PermissionStatus {
            screen_recording: true,
            accessibility: true,
            all_granted: true,
            platform_requires_check: false,
        }
    }
}

/// 打开系统偏好设置到指定权限面板
pub fn open_permission_settings(permission_type: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match permission_type {
            "screen_recording" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            }
            "accessibility" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            }
            _ => return Err(format!("未知权限类型: {}", permission_type)),
        };

        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("打开系统设置失败: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = permission_type;
        Err("当前平台不需要手动设置权限".into())
    }
}

/// 请求屏幕录制权限（触发系统弹窗）
pub fn request_screen_recording() -> bool {
    #[cfg(target_os = "macos")]
    {
        // CGRequestScreenCaptureAccess() 触发系统授权弹窗
        // 注意: 此函数在 macOS 10.15+ 可用
        extern "C" {
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        unsafe { CGRequestScreenCaptureAccess() }
    }

    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

// ═══════════════════════════════════════════
// macOS 专用实现
// ═══════════════════════════════════════════

#[cfg(target_os = "macos")]
fn check_screen_recording() -> bool {
    // CGPreflightScreenCaptureAccess() — macOS 10.15+
    // 返回 true 表示已有屏幕录制权限
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> bool;
    }
    unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(target_os = "macos")]
fn check_accessibility() -> bool {
    // AXIsProcessTrusted() — 检测辅助功能权限
    // 来自 ApplicationServices / HIServices 框架
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    unsafe { AXIsProcessTrusted() }
}

#[cfg(target_os = "macos")]
pub fn prompt_accessibility() -> bool {
    // AXIsProcessTrustedWithOptions — 带弹窗的版本
    // kAXTrustedCheckOptionPrompt = true 会弹出系统授权引导
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrustedWithOptions(
            options: core_foundation::base::CFTypeRef,
        ) -> bool;
    }

    let key = CFString::new("AXTrustedCheckOptionPrompt");
    let value = CFBoolean::true_value();
    let options = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), value.as_CFType())]);

    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as _) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_all_permissions() {
        let status = check_all_permissions();
        // 非 macOS 平台应该全部为 true
        if !cfg!(target_os = "macos") {
            assert!(status.all_granted);
            assert!(!status.platform_requires_check);
        }
    }
}
