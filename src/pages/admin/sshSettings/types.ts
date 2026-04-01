/**
 * sshSettings/types — 类型定义与常量
 */

export interface SSHConfigItem {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "privateKey";
  isDefault: boolean;
  isActive: boolean;
  connectTimeout: number;
  createdAt: string;
  updatedAt: string;
  sandboxEnabled?: boolean;
  sandboxWsPort?: number;
  sandboxStatus?: "offline" | "deploying" | "online" | "error";
  sandboxWsEndpoint?: string;
  sandboxMaxTasks?: number;
  sandboxRunningTasks?: number;
  sandboxError?: string;
  sandboxLastCheckAt?: string;
}

export interface SSHFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "privateKey";
  password: string;
  privateKey: string;
  passphrase: string;
  connectTimeout: number;
}

export const DEFAULT_SSH_FORM: SSHFormData = {
  name: "",
  host: "",
  port: 22,
  username: "root",
  authType: "password",
  password: "",
  privateKey: "",
  passphrase: "",
  connectTimeout: 10,
};

export const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  offline:   { label: "离线",   color: "bg-gray-100 text-gray-600",    dot: "bg-gray-400" },
  deploying: { label: "部署中", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400 animate-pulse" },
  online:    { label: "在线",   color: "bg-green-100 text-green-700",  dot: "bg-green-500" },
  error:     { label: "异常",   color: "bg-red-100 text-red-700",      dot: "bg-red-500" },
};

/** 构建带认证头的请求 headers */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return {
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...extra,
  };
}
