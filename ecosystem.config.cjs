/**
 * ecosystem.config.cjs — PM2 配置
 *
 * ★ P0 Phase 1.3: PM2 Cluster 兼容
 *
 * 问题: PM2 cluster 模式 (exec_mode: "cluster", instances: 2) 导致
 *       WebSocket session 跨进程丢失，因为 Socket.IO 连接
 *       可能 handshake 到进程 A，后续消息路由到进程 B。
 *
 * 短期方案 (当前): Fork 模式 — 单实例，零改动
 *   - exec_mode: "fork"
 *   - instances: 1
 *   - 优点: WebSocket 连接不跨进程，所有 session 在同一进程内
 *   - 缺点: 不利用多核
 *
 * 中期方案 (TODO): Redis Adapter
 *   - 安装 @socket.io/redis-adapter
 *   - Socket.IO 创建时添加: io.adapter(createAdapter(pubClient, subClient))
 *   - PM2 配置改回 cluster + instances: 2
 *   - nginx 添加 sticky session (ip_hash)
 *   - 见下方 REDIS_ADAPTER_MIGRATION 注释
 */

module.exports = {
  apps: [
    {
      name: "insi-server",

      // ★ 关键: fork 模式，单实例
      exec_mode: "fork",
      instances: 1,

      script: "./dist/index.js",
      cwd: "/www/wwwroot/insi/server",

      // Node 参数
      node_args: "--max-old-space-size=4096",

      // 环境变量
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // 日志
      error_file: "/www/wwwroot/insi/logs/pm2-error.log",
      out_file: "/www/wwwroot/insi/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      merge_logs: true,

      // 重启策略
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      autorestart: true,

      // 监控
      max_memory_restart: "2G",

      // 文件监控（开发时用，生产关闭）
      watch: false,

      // 优雅关闭
      kill_timeout: 10000,
      listen_timeout: 15000,

      // 信号处理
      shutdown_with_message: true,
    },
  ],
};

/*
 * ═══════════════════════════════════════════
 * REDIS_ADAPTER_MIGRATION — 中期迁移到 Redis Adapter
 * ═══════════════════════════════════════════
 *
 * 当需要水平扩展（多实例）时，按以下步骤迁移:
 *
 * 1. 安装依赖:
 *    npm install @socket.io/redis-adapter redis
 *
 * 2. 修改 Socket.IO 初始化 (socketManager/index.ts):
 *
 *    import { createAdapter } from "@socket.io/redis-adapter";
 *    import { createClient } from "redis";
 *
 *    const pubClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
 *    const subClient = pubClient.duplicate();
 *    await Promise.all([pubClient.connect(), subClient.connect()]);
 *
 *    const io = new Server(httpServer, { ... });
 *    io.adapter(createAdapter(pubClient, subClient));
 *
 * 3. 修改此配置文件:
 *    exec_mode: "cluster",
 *    instances: 2,  // 或 "max" 使用所有 CPU 核心
 *
 * 4. Nginx 添加 sticky session:
 *
 *    upstream insi_backend {
 *      ip_hash;  # ← sticky session
 *      server 127.0.0.1:3000;
 *    }
 *
 * 5. 验证:
 *    - Desktop Agent 连接后能稳定保持 session
 *    - 心跳不中断
 *    - 截图传输正常
 *    - 操作执行 + 结果回传正常
 */
