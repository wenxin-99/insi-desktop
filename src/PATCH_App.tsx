/**
 * ═══════════════════════════════════════════════════════
 * App.tsx 补丁说明 — /scheduled-tasks 路由重定向
 * ═══════════════════════════════════════════════════════
 *
 * 在 App.tsx 中找到以下两行：
 *
 *   const ScheduledTasks = lazy(() => import("./pages/ScheduledTasks"));
 *
 * 替换为：
 *
 *   const ScheduledTasks = lazy(() => import("./pages/ScheduledTasksRedirect"));
 *
 * 路由定义不需要改（仍然是）：
 *
 *   <Route path="/scheduled-tasks" component={ScheduledTasks} />
 *
 * 这样旧的 /scheduled-tasks URL 会自动跳转到 /agent
 *
 * ═══════════════════════════════════════════════════════
 */
