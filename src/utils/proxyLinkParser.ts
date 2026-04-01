/**
 * 代理链接解析工具
 * 支持 VLESS, VMess, Shadowsocks, Trojan 等协议
 */

interface ParsedProxy {
  name: string;
  type: "vless" | "vmess" | "socks5" | "http" | "https" | "trojan";
  host: string;
  port: number;
  username?: string;
  password?: string;
  vlessConfig?: any;
}

/**
 * 解析 VLESS 链接
 * 格式: vless://uuid@host:port?params#name
 */

/**
 * 安全解码 base64（支持包含 Unicode/中文的内容）
 * atob 只支持 Latin1，对含中文的 base64 会抛异常
 */
function safeBase64Decode(str: string): string {
  try {
    // 补全 padding
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    // 先用 atob 解码字节，再用 TextDecoder 处理 UTF-8
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    // fallback: 直接 atob
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
}

export function parseVlessLink(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    
    if (url.protocol !== "vless:") {
      return null;
    }

    const uuid = url.username;
    const host = url.hostname;
    const port = parseInt(url.port);
    const name = decodeURIComponent(url.hash.substring(1)) || "VLESS代理";
    
    // 解析查询参数
    const params = new URLSearchParams(url.search);
    
    const vlessConfig: any = {
      uuid,
      encryption: params.get("encryption") || "none",
    };

    // TLS/Reality 配置
    const security = params.get("security");
    if (security) {
      vlessConfig.tls = security === "tls" || security === "reality";
      vlessConfig.security = security;
      
      if (security === "reality") {
        vlessConfig.sni = params.get("sni") || "";
        vlessConfig.publicKey = params.get("pbk") || "";
        vlessConfig.shortId = params.get("sid") || "";
        vlessConfig.fingerprint = params.get("fp") || "chrome";
      } else if (security === "tls") {
        vlessConfig.sni = params.get("sni") || "";
        vlessConfig.fingerprint = params.get("fp") || "";
      }
    }

    // 传输协议
    const type = params.get("type");
    if (type) {
      vlessConfig.transport = type;
      
      if (type === "ws" || type === "websocket") {
        vlessConfig.path = params.get("path") || "/";
        vlessConfig.host = params.get("host") || "";
      } else if (type === "grpc") {
        vlessConfig.serviceName = params.get("serviceName") || "";
      } else if (type === "http" || type === "h2") {
        vlessConfig.path = params.get("path") || "/";
        vlessConfig.host = params.get("host") || "";
      } else if (type === "splithttp" || type === "xhttp") {
        vlessConfig.path = params.get("path") || "/";
        vlessConfig.host = params.get("host") || "";
      }
    }

    // Flow (XTLS)
    const flow = params.get("flow");
    if (flow) {
      vlessConfig.flow = flow;
    }

    return {
      name,
      type: "vless",
      host,
      port,
      vlessConfig,
    };
  } catch (error) {
    console.error("Failed to parse VLESS link:", error);
    return null;
  }
}

/**
 * 解析 VMess 链接
 * 格式: vmess://base64(json)
 */
export function parseVmessLink(link: string): ParsedProxy | null {
  try {
    if (!link.startsWith("vmess://")) {
      return null;
    }

    const base64 = link.substring(8);
    const json = safeBase64Decode(base64);
    const config = JSON.parse(json);

    return {
      name: config.ps || "VMess代理",
      type: "vless", // 使用 vless 类型存储
      host: config.add,
      port: parseInt(config.port),
      vlessConfig: {
        uuid: config.id,
        alterId: config.aid || 0,
        security: config.scy || "auto",
        transport: config.net || "tcp",
        tls: config.tls === "tls",
        sni: config.sni || "",
        path: config.path || "/",
        host: config.host || "",
      },
    };
  } catch (error) {
    console.error("Failed to parse VMess link:", error);
    return null;
  }
}

/**
 * 解析 Shadowsocks 链接
 * 格式: ss://base64(method:password)@host:port#name
 */
export function parseShadowsocksLink(link: string): ParsedProxy | null {
  try {
    if (!link.startsWith("ss://")) {
      return null;
    }

    // 不使用 URL API 解析，因为它会对 username 做 URL decode（把 + 变成空格）破坏 base64
    const withoutScheme = link.substring(5); // 去掉 ss://
    
    // 提取 fragment（#name）
    const hashIdx = withoutScheme.indexOf("#");
    const name = hashIdx >= 0 
      ? decodeURIComponent(withoutScheme.substring(hashIdx + 1)) 
      : "Shadowsocks代理";
    const withoutHash = hashIdx >= 0 ? withoutScheme.substring(0, hashIdx) : withoutScheme;
    
    // 找到 @ 分隔符
    const atIdx = withoutHash.lastIndexOf("@");
    
    let method = "", password = "", host = "", port = 0;
    
    if (atIdx >= 0) {
      // SIP002 格式: base64(method:password)@host:port
      const rawUserinfo = withoutHash.substring(0, atIdx);
      const hostPort = withoutHash.substring(atIdx + 1);
      
      // 解码 userinfo（保持原始 base64，不经过 URL decode）
      const decoded = safeBase64Decode(rawUserinfo);
      const colonIdx = decoded.indexOf(":");
      method = colonIdx >= 0 ? decoded.substring(0, colonIdx) : decoded;
      password = colonIdx >= 0 ? decoded.substring(colonIdx + 1) : "";
      
      // 解析 host:port
      const lastColon = hostPort.lastIndexOf(":");
      host = hostPort.substring(0, lastColon);
      port = parseInt(hostPort.substring(lastColon + 1));
    } else {
      // 旧格式: base64(method:password@host:port)
      const decoded = safeBase64Decode(withoutHash);
      const atInDecoded = decoded.lastIndexOf("@");
      if (atInDecoded >= 0) {
        const userinfo = decoded.substring(0, atInDecoded);
        const hostPort = decoded.substring(atInDecoded + 1);
        const colonIdx = userinfo.indexOf(":");
        method = colonIdx >= 0 ? userinfo.substring(0, colonIdx) : userinfo;
        password = colonIdx >= 0 ? userinfo.substring(colonIdx + 1) : "";
        const lastColon = hostPort.lastIndexOf(":");
        host = hostPort.substring(0, lastColon);
        port = parseInt(hostPort.substring(lastColon + 1));
      }
    }

    return {
      name,
      type: "socks5", // Shadowsocks 使用 SOCKS5 类型
      host,
      port,
      username: method,
      password,
    };
  } catch (error) {
    console.error("Failed to parse Shadowsocks link:", error);
    return null;
  }
}

/**
 * 解析 Trojan 链接
 * 格式: trojan://password@host:port?params#name
 */
export function parseTrojanLink(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    
    if (url.protocol !== "trojan:") {
      return null;
    }

    const password = url.username;
    const host = url.hostname;
    const port = parseInt(url.port);
    const name = decodeURIComponent(url.hash.substring(1)) || "Trojan代理";
    
    const params = new URLSearchParams(url.search);
    
    return {
      name,
      type: "vless", // 使用 vless 类型存储 Trojan
      host,
      port,
      vlessConfig: {
        password,
        sni: params.get("sni") || "",
        type: params.get("type") || "tcp",
        security: "tls",
      },
    };
  } catch (error) {
    console.error("Failed to parse Trojan link:", error);
    return null;
  }
}

/**
 * 自动检测并解析代理链接
 */
export function parseProxyLink(link: string): ParsedProxy | null {
  const trimmed = link.trim();
  
  if (trimmed.startsWith("vless://")) {
    return parseVlessLink(trimmed);
  } else if (trimmed.startsWith("vmess://")) {
    return parseVmessLink(trimmed);
  } else if (trimmed.startsWith("ss://")) {
    return parseShadowsocksLink(trimmed);
  } else if (trimmed.startsWith("trojan://")) {
    return parseTrojanLink(trimmed);
  }
  
  return null;
}
