//! file_ops.rs — 复合文件系统操作 (Insi Desktop v0.5.0)
//!
//! 替代 GUI 模拟点击的"智能"文件操作工具集合。
//! 给 desktop agent 用,绕过 Ctrl+Shift+N / type / enter 这种脆弱链路,
//! 直接调用文件系统 API。
//!
//! 提供:
//!   file_organize       — 按规则智能分类,支持 dryRun/conflict 处理
//!   file_group          — 按相似性聚类(name/date/mime)
//!   file_rename_batch   — 模板批量重命名,支持 dryRun
//!   file_trash          — 移到回收站(可恢复) — 跨平台
//!
//! 所有操作支持:
//!   - dry_run: 只返回 plan 不真实修改
//!   - 跨平台路径展开(~/Desktop / Windows 反斜杠)
//!   - 失败记录 transaction log,可 rollback

use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ═══════════════════════════════════════════
// 通用类型
// ═══════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizeRule {
    pub folder: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizeMove {
    pub from: String,
    pub to: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizeResult {
    pub dry_run: bool,
    pub source: String,
    pub plan: Vec<OrganizeMove>,
    pub moved_count: u32,
    pub skipped_count: u32,
    pub created_folders: Vec<String>,
    pub errors: Vec<String>,
    /// transaction log (仅当真执行时填充, 用于 rollback)
    pub transaction_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RenameMove {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RenameBatchResult {
    pub dry_run: bool,
    pub plan: Vec<RenameMove>,
    pub renamed_count: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrashResult {
    pub trashed_count: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupCluster {
    pub name: String,
    pub members: Vec<String>,
    pub size: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupResult {
    pub dry_run: bool,
    pub clusters: Vec<GroupCluster>,
    pub total_files: u32,
}

// ═══════════════════════════════════════════
// 路径辅助
// ═══════════════════════════════════════════

/// 获取用户 home 目录,优先用 USERPROFILE 环境变量(Windows)避开 dirs crate 在某些
/// Windows 配置下对中文/特殊字符用户名的截断 bug。
///
/// dirs crate v5.0.1 在用户名为"牧羊人"时被观察到截断成"六",导致所有依赖
/// home 比较的路径检查失败。USERPROFILE 是 Windows 原生环境变量,不会被 dirs 二次处理。
pub fn user_home() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(p) = std::env::var("USERPROFILE") {
            if !p.is_empty() {
                return Some(PathBuf::from(p));
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(p) = std::env::var("HOME") {
            if !p.is_empty() {
                return Some(PathBuf::from(p));
            }
        }
    }
    dirs::home_dir()
}

/// 剥离 Windows NT namespace 前缀 `\\?\`,把 `\\?\C:\foo` 还原成 `C:\foo`。
/// canonicalize 在 Windows 会自动加这个前缀,但与 USERPROFILE / dirs::home_dir 返回的
/// 普通路径比较时 starts_with 永远 false,导致路径校验全部失败。
fn strip_nt_prefix(path: &str) -> String {
    if path.starts_with(r"\\?\UNC\") {
        // UNC 共享路径:\\?\UNC\server\share → \\server\share
        format!(r"\\{}", &path[r"\\?\UNC\".len()..])
    } else if path.starts_with(r"\\?\") {
        path[r"\\?\".len()..].to_string()
    } else {
        path.to_string()
    }
}

fn expand_home(path: &str) -> PathBuf {
    if path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = user_home() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// 路径安全护栏 — 不允许 agent 操作系统目录
///
/// 拦截:
///   - 系统根 / boot / etc / usr / var / opt / proc / sys / dev (Unix)
///   - C:\Windows / C:\Program Files / C:\Program Files (x86) (Windows)
///   - 仅允许 home dir 子树 + Desktop / Downloads / Documents / Pictures 等用户区域
fn is_path_safe(path: &Path) -> Result<(), String> {
    let abs_raw = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    // ★ 2026-05-04 关键修复:Windows canonicalize 返回 \\?\C:\... 这种 NT 前缀路径,
    //   与 user_home 返回的 C:\... 比较时永远 false,所有 file_organize / file_rename
    //   等带写操作的工具会报"路径不在用户区域"误拒。剥离前缀后比较才正确。
    let abs_str = strip_nt_prefix(&abs_raw.to_string_lossy());
    let s = abs_str.to_lowercase();

    // Windows 系统路径黑名单
    #[cfg(target_os = "windows")]
    {
        let banned = [
            "c:\\windows", "c:\\program files", "c:\\program files (x86)",
            "c:\\programdata", "c:\\system volume information",
        ];
        for b in banned {
            if s.starts_with(b) || s == b.trim_end_matches('\\') {
                return Err(format!("禁止操作系统目录: {}", b));
            }
        }
    }

    // Unix 系统路径黑名单
    #[cfg(not(target_os = "windows"))]
    {
        let banned = [
            "/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/opt",
            "/proc", "/root", "/sbin", "/srv", "/sys", "/usr", "/var",
            "/system", "/library/system", "/applications/system preferences.app",
        ];
        for b in banned {
            if s == b || s.starts_with(&format!("{}/", b)) {
                return Err(format!("禁止操作系统目录: {}", b));
            }
        }
    }

    // 必须在 home 目录或常见子目录内
    if let Some(home) = user_home() {
        let home_lower = strip_nt_prefix(&home.to_string_lossy()).to_lowercase();
        if !s.starts_with(&home_lower) && !s.starts_with("/tmp") && !s.starts_with("/var/tmp") {
            return Err(format!("路径不在用户区域,拒绝: abs={} home={}", abs_str, home_lower));
        }
    }

    Ok(())
}

/// 文件名按 conflict 策略生成新名字
/// rename: a.pdf 已存在 → a (1).pdf
fn resolve_conflict(target: &Path, strategy: &str) -> Result<PathBuf, String> {
    if !target.exists() { return Ok(target.to_path_buf()); }
    match strategy {
        "skip" => Err("目标已存在,跳过".into()),
        "overwrite" => Ok(target.to_path_buf()),
        _ => {
            // rename (默认)
            let stem = target.file_stem()
                .ok_or("无法获取文件名")?.to_string_lossy().to_string();
            let ext = target.extension()
                .map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
            let parent = target.parent().ok_or("无父目录")?;
            for i in 1..1000 {
                let candidate = parent.join(format!("{} ({}){}", stem, i, ext));
                if !candidate.exists() { return Ok(candidate); }
            }
            Err("conflict 重试次数过多".into())
        }
    }
}

// ═══════════════════════════════════════════
// 1. file_organize — 按规则智能分类
// ═══════════════════════════════════════════

pub fn file_organize(
    source: &str,
    rules: &[OrganizeRule],
    dry_run: bool,
    create_folders_if_missing: bool,
    on_conflict: &str,
) -> Result<OrganizeResult, String> {
    let src_path = expand_home(source);
    if !src_path.is_dir() {
        return Err(format!("源路径不是目录: {}", source));
    }
    is_path_safe(&src_path)?;

    let mut plan: Vec<OrganizeMove> = Vec::new();
    let mut created_folders: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut moved_count: u32 = 0;
    let mut skipped_count: u32 = 0;

    // 扫源目录的直接子项(不递归 — 避免移动子文件夹里的东西出来)
    let read = fs::read_dir(&src_path)
        .map_err(|e| format!("读取目录失败 {}: {}", src_path.display(), e))?;

    for entry in read {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件 + 已经是规则目标文件夹本身
        if name.starts_with('.') { continue; }
        let is_rule_folder = rules.iter().any(|r| r.folder == name);
        if is_rule_folder { skipped_count += 1; continue; }

        // 只处理文件 + 软链(不动文件夹)
        let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        if metadata.is_dir() { skipped_count += 1; continue; }

        // 找匹配规则
        let ext_lower = Path::new(&name).extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
            .unwrap_or_default();

        let matched_rule = rules.iter().find(|r| {
            r.extensions.iter().any(|e| {
                let ee = if e.starts_with('.') { e.to_lowercase() } else { format!(".{}", e.to_lowercase()) };
                ee == ext_lower
            })
        });

        let rule = match matched_rule {
            Some(r) => r,
            None => { skipped_count += 1; continue; }
        };

        let dest_dir = src_path.join(&rule.folder);
        let dest_file = dest_dir.join(&name);

        plan.push(OrganizeMove {
            from: entry_path.to_string_lossy().to_string(),
            to: dest_file.to_string_lossy().to_string(),
            size: metadata.len(),
        });
    }

    if dry_run {
        return Ok(OrganizeResult {
            dry_run: true,
            source: source.to_string(),
            plan,
            moved_count: 0,
            skipped_count,
            created_folders: vec![],
            errors,
            transaction_id: None,
        });
    }

    // ━━━ 真执行 ━━━
    let txn_id = format!("organize-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    let mut txn_log: Vec<(PathBuf, PathBuf)> = Vec::new();

    // 1) 创建必要目录
    let mut needed_folders: std::collections::HashSet<String> = std::collections::HashSet::new();
    for mv in &plan {
        if let Some(parent) = Path::new(&mv.to).parent() {
            needed_folders.insert(parent.to_string_lossy().to_string());
        }
    }

    for folder in &needed_folders {
        let folder_path = Path::new(folder);
        if !folder_path.exists() {
            if !create_folders_if_missing {
                errors.push(format!("目录不存在且未启用自动创建: {}", folder));
                continue;
            }
            if let Err(e) = fs::create_dir_all(folder_path) {
                errors.push(format!("创建 {} 失败: {}", folder, e));
                continue;
            }
            let folder_name = folder_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if !folder_name.is_empty() && !created_folders.contains(&folder_name) {
                created_folders.push(folder_name);
            }
        }
    }

    // 2) 移文件 + conflict 处理
    for mv in &plan {
        let src = PathBuf::from(&mv.from);
        let dst_initial = PathBuf::from(&mv.to);

        let dst = match resolve_conflict(&dst_initial, on_conflict) {
            Ok(p) => p,
            Err(e) => {
                if e == "目标已存在,跳过" {
                    skipped_count += 1;
                    continue;
                }
                errors.push(format!("{}: {}", mv.from, e));
                continue;
            }
        };

        match fs::rename(&src, &dst) {
            Ok(()) => {
                txn_log.push((src.clone(), dst.clone()));
                moved_count += 1;
            }
            Err(e) => errors.push(format!("移动 {} → {} 失败: {}", mv.from, dst.display(), e)),
        }
    }

    // 3) 写 transaction log 到磁盘 (用户 home 下,30 天保留)
    let _ = write_transaction_log(&txn_id, &txn_log);

    Ok(OrganizeResult {
        dry_run: false,
        source: source.to_string(),
        plan,
        moved_count,
        skipped_count,
        created_folders,
        errors,
        transaction_id: Some(txn_id),
    })
}

// ═══════════════════════════════════════════
// 2. file_rename_batch — 模板批量重命名
// ═══════════════════════════════════════════

pub fn file_rename_batch(
    source: &str,
    pattern: &str,
    extension_filter: Option<&str>,
    dry_run: bool,
) -> Result<RenameBatchResult, String> {
    let src_path = expand_home(source);
    if !src_path.is_dir() {
        return Err(format!("源不是目录: {}", source));
    }
    is_path_safe(&src_path)?;

    let mut plan: Vec<RenameMove> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut renamed_count: u32 = 0;

    let read = fs::read_dir(&src_path)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    for (idx, entry) in read.enumerate() {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }

        let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        if metadata.is_dir() { continue; }

        let stem = Path::new(&name).file_stem()
            .map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let ext = Path::new(&name).extension()
            .map(|e| e.to_string_lossy().to_string()).unwrap_or_default();

        if let Some(filter) = extension_filter {
            let f = filter.trim_start_matches('.').to_lowercase();
            if ext.to_lowercase() != f { continue; }
        }

        let date_str = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| {
                let dt = chrono::DateTime::from_timestamp(d.as_secs() as i64, 0).unwrap_or_default();
                dt.format("%Y-%m-%d").to_string()
            })
            .unwrap_or_default();

        // pattern 替换:
        //   {date} → 修改日期, {name} → stem (无扩展名), {ext} → 扩展名, {n} → 序号
        let new_stem = pattern
            .replace("{date}", &date_str)
            .replace("{name}", &stem)
            .replace("{originalName}", &stem)
            .replace("{ext}", &ext)
            .replace("{n}", &(idx + 1).to_string());

        let new_name = if ext.is_empty() || new_stem.contains(&ext) || pattern.contains("{ext}") {
            new_stem.clone()
        } else {
            format!("{}.{}", new_stem, ext)
        };

        if new_name == name { continue; }  // 没变就跳
        let new_path = src_path.join(&new_name);

        plan.push(RenameMove {
            from: path.to_string_lossy().to_string(),
            to: new_path.to_string_lossy().to_string(),
        });
    }

    if dry_run {
        return Ok(RenameBatchResult { dry_run: true, plan, renamed_count: 0, errors });
    }

    for mv in &plan {
        match fs::rename(&mv.from, &mv.to) {
            Ok(()) => renamed_count += 1,
            Err(e) => errors.push(format!("{} → {}: {}", mv.from, mv.to, e)),
        }
    }

    Ok(RenameBatchResult { dry_run: false, plan, renamed_count, errors })
}

// ═══════════════════════════════════════════
// 3. file_trash — 移到回收站(跨平台)
// ═══════════════════════════════════════════

pub fn file_trash(paths: &[String]) -> Result<TrashResult, String> {
    let mut trashed_count: u32 = 0;
    let mut errors: Vec<String> = Vec::new();

    for p in paths {
        let resolved = expand_home(p);
        if !resolved.exists() {
            errors.push(format!("{}: 不存在", p));
            continue;
        }
        if let Err(e) = is_path_safe(&resolved) {
            errors.push(format!("{}: {}", p, e));
            continue;
        }
        match move_to_trash(&resolved) {
            Ok(()) => trashed_count += 1,
            Err(e) => errors.push(format!("{}: {}", p, e)),
        }
    }

    Ok(TrashResult { trashed_count, errors })
}

#[cfg(target_os = "windows")]
fn move_to_trash(path: &Path) -> Result<(), String> {
    use std::process::Command;
    // PowerShell 调 Shell.Application 走系统回收站
    let abs = path.canonicalize().map_err(|e| format!("规范路径失败: {}", e))?;
    let ps = format!(
        "Add-Type -AssemblyName Microsoft.VisualBasic; \
         [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{}', 'OnlyErrorDialogs', 'SendToRecycleBin')",
        abs.to_string_lossy().replace("'", "''")
    );
    let out = Command::new("powershell").args(["-Command", &ps]).output()
        .map_err(|e| format!("PS 调用失败: {}", e))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn move_to_trash(path: &Path) -> Result<(), String> {
    use std::process::Command;
    let abs = path.canonicalize().map_err(|e| format!("规范路径失败: {}", e))?;
    let script = format!(
        "tell application \"Finder\" to delete POSIX file \"{}\"",
        abs.to_string_lossy().replace("\"", "\\\"")
    );
    Command::new("osascript").args(["-e", &script]).output()
        .map_err(|e| format!("osascript 失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn move_to_trash(path: &Path) -> Result<(), String> {
    use std::process::Command;
    // gio trash 是 GNOME 标准, 大部分发行版都有
    Command::new("gio").args(["trash", &path.to_string_lossy()]).output()
        .map_err(|e| format!("gio trash 失败 (需要 GNOME 工具): {}", e))?;
    Ok(())
}

// ═══════════════════════════════════════════
// 4. file_group — 按相似性聚类
// ═══════════════════════════════════════════

pub fn file_group(
    source: &str,
    group_by: &str,        // "extension" | "date" | "size_range" | "name_prefix"
    dry_run: bool,
    output_folder: Option<&str>,
) -> Result<GroupResult, String> {
    let src_path = expand_home(source);
    if !src_path.is_dir() {
        return Err(format!("源不是目录: {}", source));
    }
    is_path_safe(&src_path)?;
    if let Some(out) = output_folder {
        is_path_safe(&expand_home(out))?;
    }

    let mut buckets: std::collections::BTreeMap<String, Vec<(PathBuf, u64)>> = Default::default();
    let mut total: u32 = 0;

    let read = fs::read_dir(&src_path).map_err(|e| format!("读取失败: {}", e))?;
    for entry in read {
        let entry = match entry { Ok(e) => e, Err(_) => continue };
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        if metadata.is_dir() { continue; }
        total += 1;

        let key = match group_by {
            "extension" => Path::new(&name).extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_else(|| "其他".into()),
            "date" => metadata.modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .unwrap_or_default()
                    .format("%Y-%m").to_string())
                .unwrap_or_else(|| "未知日期".into()),
            "size_range" => {
                let mb = metadata.len() / 1_048_576;
                if mb < 1 { "小文件 (<1MB)".into() }
                else if mb < 10 { "中等 (1-10MB)".into() }
                else if mb < 100 { "较大 (10-100MB)".into() }
                else { "超大 (>100MB)".into() }
            },
            "name_prefix" => {
                let stem = Path::new(&name).file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                stem.chars().take(4).collect::<String>()
            },
            _ => "其他".into(),
        };

        buckets.entry(key).or_default().push((p, metadata.len()));
    }

    let mut clusters: Vec<GroupCluster> = buckets.into_iter()
        .filter(|(_, v)| !v.is_empty())
        .map(|(name, members)| GroupCluster {
            name: name.clone(),
            size: members.len() as u32,
            members: members.iter().map(|(p, _)| p.to_string_lossy().to_string()).collect(),
        })
        .collect();
    clusters.sort_by(|a, b| b.size.cmp(&a.size));

    if dry_run || output_folder.is_none() {
        return Ok(GroupResult { dry_run: true, clusters, total_files: total });
    }

    // 真执行 — 把每个 cluster 移到对应子文件夹
    let out_root = expand_home(output_folder.unwrap());
    fs::create_dir_all(&out_root).map_err(|e| format!("创建输出目录失败: {}", e))?;

    for cluster in &clusters {
        let cluster_dir = out_root.join(&cluster.name);
        let _ = fs::create_dir_all(&cluster_dir);
        for member in &cluster.members {
            let src = PathBuf::from(member);
            let dst = cluster_dir.join(src.file_name().unwrap_or_default());
            let _ = fs::rename(&src, &dst);
        }
    }

    Ok(GroupResult { dry_run: false, clusters, total_files: total })
}

// ═══════════════════════════════════════════
// Transaction log (rollback 支持)
// ═══════════════════════════════════════════

fn write_transaction_log(txn_id: &str, ops: &[(PathBuf, PathBuf)]) -> Result<(), String> {
    let log_dir = dirs::data_local_dir()
        .ok_or("无法定位 data dir")?
        .join("InsiDesktop")
        .join("transactions");
    fs::create_dir_all(&log_dir).map_err(|e| format!("创建 log 目录失败: {}", e))?;

    let log_file = log_dir.join(format!("{}.json", txn_id));
    let entries: Vec<serde_json::Value> = ops.iter().map(|(from, to)| {
        serde_json::json!({ "from": from.to_string_lossy(), "to": to.to_string_lossy() })
    }).collect();
    let log_data = serde_json::json!({
        "txn_id": txn_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "ops": entries,
    });
    fs::write(&log_file, serde_json::to_string_pretty(&log_data).unwrap_or_default())
        .map_err(|e| format!("写 log 失败: {}", e))?;
    Ok(())
}

/// 反向执行 transaction (rollback)
pub fn rollback_transaction(txn_id: &str) -> Result<u32, String> {
    let log_file = dirs::data_local_dir()
        .ok_or("无法定位 data dir")?
        .join("InsiDesktop")
        .join("transactions")
        .join(format!("{}.json", txn_id));

    let content = fs::read_to_string(&log_file)
        .map_err(|e| format!("读 log 失败: {}", e))?;
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 log 失败: {}", e))?;

    let ops = parsed.get("ops").and_then(|o| o.as_array())
        .ok_or("log 格式错误,缺 ops 字段")?;

    let mut undone: u32 = 0;
    // 反向执行(LIFO 顺序避免冲突)
    for op in ops.iter().rev() {
        let from = op.get("from").and_then(|v| v.as_str()).unwrap_or("");
        let to = op.get("to").and_then(|v| v.as_str()).unwrap_or("");
        if from.is_empty() || to.is_empty() { continue; }
        // rollback: to → from
        if PathBuf::from(to).exists() {
            if let Ok(()) = fs::rename(to, from) {
                undone += 1;
            }
        }
    }

    Ok(undone)
}

// ═══════════════════════════════════════════
// v0.6.0: 读图片文件为 base64 — 给服务端 desktop.ocr_file 工具用
// ═══════════════════════════════════════════

/// 读图片文件,返回 (base64_bytes, mime_type, size_bytes)。
///
/// 安全:
///   - 复用 is_path_safe 的家目录护栏(拦 /etc, /usr 等系统路径)
///   - 上限 10 MB,超出直接拒
///   - 仅识别图像扩展名(png/jpg/jpeg/webp/bmp),否则拒
///   - 只读不写,即使被服务端 prompt injection 也不会改文件
pub fn read_image_as_base64(path: &str) -> Result<(String, String, u64), String> {
    use base64::Engine;

    const MAX_BYTES: u64 = 10 * 1024 * 1024;

    let resolved = expand_home(path);

    // 必须存在 + 必须是文件
    if !resolved.exists() {
        return Err(format!("文件不存在: {}", resolved.display()));
    }
    if !resolved.is_file() {
        return Err(format!("路径不是文件: {}", resolved.display()));
    }

    // 安全护栏
    is_path_safe(&resolved)?;

    // 大小检查 — 在 read 之前先 stat,避免读到一半才发现
    let metadata = fs::metadata(&resolved)
        .map_err(|e| format!("无法读取文件元数据: {}", e))?;
    let size = metadata.len();
    if size > MAX_BYTES {
        return Err(format!(
            "文件大小 {:.1} MB 超过 {} MB 上限",
            size as f64 / 1024.0 / 1024.0,
            MAX_BYTES / 1024 / 1024,
        ));
    }

    // 扩展名白名单
    let ext = resolved
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        _ => return Err(format!("不支持的扩展名 .{},仅接受 png/jpg/jpeg/webp/bmp/gif", ext)),
    };

    // 读字节
    let bytes = fs::read(&resolved)
        .map_err(|e| format!("读文件失败: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok((b64, mime.to_string(), size))
}

// ═══════════════════════════════════════════
// v0.7.0: 公开 expand_home 给 shell_exec 模块复用
// ═══════════════════════════════════════════

/// expand_home 的公开 wrapper(给 shell_exec.rs 用)
pub fn expand_home_for_shell(path: &str) -> PathBuf {
    expand_home(path)
}
