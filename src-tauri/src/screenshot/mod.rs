//! 截屏引擎
//!
//! 使用 xcap 库实现跨平台截屏：
//!   - Windows: DXGI Desktop Duplication / BitBlt
//!   - macOS: CGWindowListCreateImage
//!   - Linux: XGetImage / PipeWire
//!
//! 输出为 WebP 编码的 base64 字符串，控制在 200KB 以内以加速传输。

use base64::Engine;
use image::codecs::webp::WebPEncoder;
use image::{DynamicImage, GenericImageView, ImageEncoder};
use std::io::Cursor;
use xcap::Monitor;

/// 截屏区域
#[derive(Debug, Clone)]
pub struct CaptureRegion {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// 截屏结果
#[derive(Debug, Clone)]
pub struct CaptureResult {
    /// base64 encoded WebP image
    pub image_base64: String,
    /// 图片宽度
    pub width: u32,
    /// 图片高度
    pub height: u32,
}

/// 获取主显示器信息
pub fn get_primary_monitor() -> Result<(u32, u32, f64), String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "未找到显示器".to_string())?;

    let width = primary.width().unwrap_or(1920);
    let height = primary.height().unwrap_or(1080);
    let scale = primary.scale_factor().unwrap_or(1.0) as f64;

    Ok((width, height, scale))
}

/// 全屏截图
pub fn capture_screen(quality: u8) -> Result<CaptureResult, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "未找到显示器".to_string())?;

    let raw_image = primary
        .capture_image()
        .map_err(|e| format!("截屏失败: {}", e))?;

    let width = raw_image.width();
    let height = raw_image.height();

    let dyn_image = DynamicImage::ImageRgba8(raw_image);

    // ★ 不在客户端缩放 — 服务端 coordinateMapper 统一处理标准化
    // 保持原始分辨率截图，让服务端决定 VLM 尺寸
    let (final_w, final_h) = dyn_image.dimensions();

    let image_base64 = encode_to_webp_base64(&dyn_image, quality)?;

    Ok(CaptureResult {
        image_base64,
        width: final_w,
        height: final_h,
    })
}

/// 区域截图
pub fn capture_region(region: &CaptureRegion, quality: u8) -> Result<CaptureResult, String> {
    // 先全屏截图再裁剪
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "未找到显示器".to_string())?;

    let raw_image = primary
        .capture_image()
        .map_err(|e| format!("截屏失败: {}", e))?;

    let dyn_image = DynamicImage::ImageRgba8(raw_image);

    // 安全边界裁剪
    let (img_w, img_h) = dyn_image.dimensions();
    let x = region.x.max(0) as u32;
    let y = region.y.max(0) as u32;
    let w = region.w.min(img_w.saturating_sub(x));
    let h = region.h.min(img_h.saturating_sub(y));

    if w == 0 || h == 0 {
        return Err("截取区域无效（宽或高为0）".into());
    }

    let cropped = dyn_image.crop_imm(x, y, w, h);
    let (final_w, final_h) = cropped.dimensions();
    let image_base64 = encode_to_webp_base64(&cropped, quality)?;

    Ok(CaptureResult {
        image_base64,
        width: final_w,
        height: final_h,
    })
}

/// 编码为 WebP 并转 base64
/// ★ 使用有损编码，quality 越低文件越小（0-100）
fn encode_to_webp_base64(image: &DynamicImage, quality: u8) -> Result<String, String> {
    let rgba = image.to_rgba8();
    let (w, h) = rgba.dimensions();

    let mut buf = Cursor::new(Vec::new());

    // ★ 优先使用有损编码（实际 quality 生效）
    // image crate 0.25 的 WebPEncoder 只支持 lossless，
    // 因此先 encode 为 lossless，如果太大则缩小分辨率重编
    let encoder = WebPEncoder::new_lossless(&mut buf);
    encoder
        .write_image(&rgba, w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("WebP 编码失败: {}", e))?;

    let bytes = buf.into_inner();

    // ★ 根据 quality 动态控制目标大小:
    //   quality 70 → 目标 300KB
    //   quality 50 → 目标 200KB
    //   quality 30 → 目标 100KB
    let target_size = ((quality as usize) * 4000).max(100_000);

    if bytes.len() > target_size {
        // 缩放降质：按比例缩小到目标大小范围
        let scale = (target_size as f64 / bytes.len() as f64).sqrt().max(0.3);
        let new_w = (w as f64 * scale) as u32;
        let new_h = (h as f64 * scale) as u32;

        let smaller = image.resize(
            new_w.max(320),
            new_h.max(200),
            image::imageops::FilterType::Triangle,
        );
        let rgba2 = smaller.to_rgba8();
        let (w2, h2) = rgba2.dimensions();
        let mut buf2 = Cursor::new(Vec::new());
        let enc2 = WebPEncoder::new_lossless(&mut buf2);
        enc2.write_image(&rgba2, w2, h2, image::ExtendedColorType::Rgba8)
            .map_err(|e| format!("WebP 重编码失败: {}", e))?;
        let bytes2 = buf2.into_inner();
        log::debug!("[Screenshot] Resized: {}x{} → {}x{}, {}KB → {}KB",
            w, h, w2, h2, bytes.len()/1024, bytes2.len()/1024);
        return Ok(base64::engine::general_purpose::STANDARD.encode(&bytes2));
    }

    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_primary_monitor() {
        // 仅在有显示器的环境下测试
        if let Ok((w, h, s)) = get_primary_monitor() {
            assert!(w > 0);
            assert!(h > 0);
            assert!(s > 0.0);
            println!("Monitor: {}x{} @{}x", w, h, s);
        }
    }
}
