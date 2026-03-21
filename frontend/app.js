/**
 * Insi Desktop Agent — Frontend Logic
 *
 * Uses window.__TAURI__.core.invoke() (Tauri 2 global API)
 * to communicate with the Rust backend.
 *
 * Commands: get_status, login, disconnect, test_screenshot, authorize
 */

// ═══════════════════════════════════════════
// DOM refs
// ═══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const dot       = $('dot');
const stxt      = $('stxt');
const ver       = $('ver');
const iPlatform = $('iPlatform');
const iScreen   = $('iScreen');
const loginBox  = $('loginBox');
const connBadge = $('connBadge');
const connMsg   = $('connMsg');
const logBody   = $('logBody');
const emptyLog  = $('emptyLog');
const logCnt    = $('logCnt');
const btnConnect  = $('btnConnect');
const btnTest     = $('btnTest');
const btnDisconn  = $('btnDisconn');
const inToken     = $('inToken');
const inServer    = $('inServer');

// ═══════════════════════════════════════════
// Tauri bridge
// ═══════════════════════════════════════════
function invoke(cmd, args) {
  if (window.__TAURI__ && window.__TAURI__.core) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }
  // Fallback: dev mode without Tauri
  console.warn('[app.js] __TAURI__ not available, cmd:', cmd);
  return Promise.reject(new Error('Tauri runtime not available'));
}

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
let logs = [];
let connected = false;
let pollTimer = null;

// ═══════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════
function addLog(msg, level) {
  level = level || 'info';
  const now = new Date();
  const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
  logs.push({ ts: ts, msg: msg, level: level });
  if (logs.length > 200) logs.shift();

  if (emptyLog) emptyLog.style.display = 'none';

  const el = document.createElement('div');
  el.className = 'log-entry ' + level;
  el.innerHTML = '<span class="log-time">' + ts + '</span><span class="log-msg">' + escHtml(msg) + '</span>';
  logBody.appendChild(el);
  logBody.scrollTop = logBody.scrollHeight;
  logCnt.textContent = String(logs.length);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════
// UI updates
// ═══════════════════════════════════════════
function setConnected(val) {
  connected = val;
  if (val) {
    loginBox.classList.add('hide');
    connBadge.classList.remove('hide');
    btnDisconn.classList.remove('hide');
    btnTest.disabled = false;
  } else {
    loginBox.classList.remove('hide');
    connBadge.classList.add('hide');
    btnDisconn.classList.add('hide');
    btnTest.disabled = true;
  }
}

function updateStatusUI(data) {
  // Connection dot
  dot.className = 'dot';
  if (data.connected) {
    dot.classList.add('on');
    stxt.textContent = '已连接';
    setConnected(true);
  } else if (data.status && data.status.includes('onnecting')) {
    dot.classList.add('mid');
    stxt.textContent = '连接中…';
  } else {
    stxt.textContent = '未连接';
    setConnected(false);
  }

  // Info
  ver.textContent = 'v' + (data.clientVersion || '-');
  iPlatform.textContent = (data.platform || '-') + ' / ' + (data.osVersion || '').substring(0, 20);
  if (data.screen) {
    iScreen.textContent = data.screen.width + '×' + data.screen.height +
      (data.screen.scale !== 1 ? ' @' + data.screen.scale + 'x' : '');
  }
}

// ═══════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════

/* eslint-disable no-unused-vars */
// Called from onclick in HTML

async function doLogin() {
  var token = inToken.value.trim();
  if (!token) {
    addLog('请输入 Token', 'warn');
    inToken.focus();
    return;
  }

  btnConnect.disabled = true;
  btnConnect.textContent = '连接中…';
  addLog('正在连接服务端…', 'info');

  try {
    var serverUrl = inServer.value.trim() || undefined;
    var res = await invoke('login', { token: token, serverUrl: serverUrl });
    addLog(res.message || '连接请求已发送', 'ok');
  } catch (e) {
    addLog('连接失败: ' + (e.message || e), 'error');
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = '连接';
  }
}

async function doDisconnect() {
  try {
    var res = await invoke('disconnect');
    addLog(res.message || '已断开', 'warn');
    setConnected(false);
    dot.className = 'dot';
    stxt.textContent = '未连接';
  } catch (e) {
    addLog('断开失败: ' + (e.message || e), 'error');
  }
}

async function doTest() {
  addLog('截屏测试…', 'info');
  btnTest.disabled = true;
  try {
    var res = await invoke('test_screenshot');
    addLog('截屏成功: ' + res.width + '×' + res.height + ' (' + Math.round(res.imageSize / 1024) + 'KB)', 'ok');
  } catch (e) {
    addLog('截屏失败: ' + (e.message || e), 'error');
  } finally {
    btnTest.disabled = connected ? false : true;
  }
}

/* eslint-enable no-unused-vars */

// ═══════════════════════════════════════════
// Polling
// ═══════════════════════════════════════════
let lastStatus = '';

async function pollStatus() {
  try {
    var data = await invoke('get_status');
    updateStatusUI(data);

    // 状态变化时记日志
    var newStatus = data.status || '';
    if (newStatus !== lastStatus) {
      if (newStatus.includes('Connected') && !lastStatus.includes('Connected')) {
        addLog('已成功连接到服务端', 'ok');
      } else if (newStatus.includes('Reconnecting')) {
        addLog('正在重连…', 'warn');
      } else if (lastStatus.includes('Connected') && newStatus.includes('Disconnected')) {
        addLog('连接已断开', 'warn');
      }
      lastStatus = newStatus;
    }
  } catch (_) {
    // Tauri not ready yet, ignore
  }
}

// ═══════════════════════════════════════════
// Init
// ═══════════════════════════════════════════
(function init() {
  addLog('Insi Desktop Agent 启动', 'info');

  // 立即获取一次状态
  pollStatus();

  // 每 2 秒轮询
  pollTimer = setInterval(pollStatus, 2000);

  // Enter 键连接
  inToken.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  inServer.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
})();
