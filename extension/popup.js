/**
 * Insi Cookie Sync — Chrome Extension Popup Logic
 *
 * 功能：
 * 1. 读取当前站点的所有 Cookie
 * 2. 一键同步到 Insi 服务器（匹配站点账号自动注入）
 * 3. 复制 Cookie JSON 到剪贴板（手动粘贴方案）
 */

let currentDomain = "";
let currentCookies = [];
let serverUrl = "";
let authToken = "";

// ═══ 初始化 ═══

document.addEventListener("DOMContentLoaded", async () => {
  // 加载配置
  const config = await chrome.storage.local.get(["serverUrl", "authToken"]);
  serverUrl = config.serverUrl || "";
  authToken = config.authToken || "";
  document.getElementById("serverUrl").value = serverUrl;

  // 获取当前 Tab 信息
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    showStatus("无法获取当前页面信息", "error");
    return;
  }

  try {
    const url = new URL(tab.url);
    currentDomain = url.hostname;
    document.getElementById("domain").textContent = currentDomain;
    document.getElementById("favicon").src = `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=32`;
  } catch {
    document.getElementById("domain").textContent = "无效页面";
    return;
  }

  // 读取 Cookie
  currentCookies = await chrome.cookies.getAll({ domain: currentDomain });
  // 也获取不带前导点的 Cookie
  if (currentDomain.startsWith("www.")) {
    const bareDomain = currentDomain.replace("www.", "");
    const bareCookies = await chrome.cookies.getAll({ domain: bareDomain });
    const dotCookies = await chrome.cookies.getAll({ domain: "." + bareDomain });
    const seen = new Set(currentCookies.map(c => `${c.name}:${c.domain}:${c.path}`));
    for (const c of [...bareCookies, ...dotCookies]) {
      const key = `${c.name}:${c.domain}:${c.path}`;
      if (!seen.has(key)) { currentCookies.push(c); seen.add(key); }
    }
  }

  document.getElementById("cookieCount").textContent = `${currentCookies.length} cookies`;
  document.getElementById("syncBtn").disabled = !serverUrl;
  document.getElementById("copyBtn").disabled = currentCookies.length === 0;

  // 如果已配置服务器，查询匹配的站点账号
  if (serverUrl) {
    loadMatchingAccounts();
  }

  // 绑定事件
  document.getElementById("syncBtn").addEventListener("click", handleSync);
  document.getElementById("copyBtn").addEventListener("click", handleCopy);
  document.getElementById("saveConfig").addEventListener("click", handleSaveConfig);
});

// ═══ 保存配置 ═══

async function handleSaveConfig() {
  const url = document.getElementById("serverUrl").value.trim().replace(/\/+$/, "");
  if (!url) {
    showStatus("请输入服务器地址", "error");
    return;
  }

  serverUrl = url;
  await chrome.storage.local.set({ serverUrl: url });

  // 尝试获取 auth token（通过 cookie）
  try {
    const insiDomain = new URL(url).hostname;
    const insiCookies = await chrome.cookies.getAll({ domain: insiDomain });
    const tokenCookie = insiCookies.find(c => c.name === "auth_token" || c.name === "session");
    if (tokenCookie) {
      authToken = tokenCookie.value;
      await chrome.storage.local.set({ authToken });
    }
  } catch {}

  document.getElementById("syncBtn").disabled = false;
  showStatus("配置已保存", "success");
  loadMatchingAccounts();
}

// ═══ 同步到 Insi ═══

async function handleSync() {
  if (!serverUrl || currentCookies.length === 0) return;

  const btn = document.getElementById("syncBtn");
  btn.disabled = true;
  btn.textContent = "同步中...";

  try {
    // 格式化为 Playwright 兼容格式
    const playwrightCookies = currentCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expirationDate || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: (c.sameSite === "strict" ? "Strict" : c.sameSite === "lax" ? "Lax" : "None"),
    }));

    const cookieJson = JSON.stringify(playwrightCookies);

    // 查找匹配的站点账号
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const accountsRes = await fetch(`${serverUrl}/api/automation/accounts`, {
      headers, credentials: "include",
    });

    if (!accountsRes.ok) {
      throw new Error(`获取账号列表失败 (${accountsRes.status})，请检查服务器地址和登录状态`);
    }

    const { accounts } = await accountsRes.json();
    const matched = (accounts || []).filter(a =>
      currentDomain.includes(new URL(a.siteUrl).hostname) ||
      new URL(a.siteUrl).hostname.includes(currentDomain.replace("www.", ""))
    );

    if (matched.length === 0) {
      // 没有匹配的账号，提示用户先添加
      showStatus(`未找到匹配 ${currentDomain} 的站点账号，请先在 Insi 中添加`, "info");
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> 同步到 Insi`;
      return;
    }

    // 向所有匹配账号注入 Cookie
    let successCount = 0;
    for (const acct of matched) {
      try {
        const res = await fetch(`${serverUrl}/api/automation/accounts/${acct.id}`, {
          method: "PUT",
          headers,
          credentials: "include",
          body: JSON.stringify({ cookies: cookieJson }),
        });
        if (res.ok) successCount++;
      } catch {}
    }

    if (successCount > 0) {
      showStatus(`已同步 ${currentCookies.length} 个 Cookie 到 ${successCount} 个账号`, "success");
    } else {
      showStatus("同步失败，请检查网络连接", "error");
    }

    loadMatchingAccounts();
  } catch (err) {
    showStatus(err.message || "同步失败", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> 同步到 Insi`;
  }
}

// ═══ 复制到剪贴板 ═══

async function handleCopy() {
  const playwrightCookies = currentCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || "/",
    expires: c.expirationDate || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: (c.sameSite === "strict" ? "Strict" : c.sameSite === "lax" ? "Lax" : "None"),
  }));

  try {
    await navigator.clipboard.writeText(JSON.stringify(playwrightCookies, null, 2));
    showStatus(`已复制 ${playwrightCookies.length} 个 Cookie（Playwright 格式）`, "success");
  } catch {
    showStatus("复制失败", "error");
  }
}

// ═══ 加载匹配账号 ═══

async function loadMatchingAccounts() {
  if (!serverUrl) return;
  try {
    const headers = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const res = await fetch(`${serverUrl}/api/automation/accounts`, {
      headers, credentials: "include",
    });
    if (!res.ok) return;

    const { accounts } = await res.json();
    const matched = (accounts || []).filter(a => {
      try {
        const h = new URL(a.siteUrl).hostname;
        return currentDomain.includes(h) || h.includes(currentDomain.replace("www.", ""));
      } catch { return false; }
    });

    const list = document.getElementById("accountList");
    const items = document.getElementById("accountItems");

    if (matched.length > 0) {
      list.style.display = "block";
      items.innerHTML = matched.map(a => {
        const hasRecentLogin = a.lastLoginAt && (Date.now() - new Date(a.lastLoginAt).getTime() < 7 * 24 * 3600 * 1000);
        return `<div class="account-item">
          <span class="status-dot ${hasRecentLogin ? "active" : "stale"}"></span>
          <span class="name">${a.username}</span>
          <span style="font-size:10px;color:#aaa">${a.siteName}</span>
        </div>`;
      }).join("");
    } else {
      list.style.display = "none";
    }
  } catch {}
}

// ═══ 工具函数 ═══

function showStatus(msg, type) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg;
  el.className = `status ${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}
