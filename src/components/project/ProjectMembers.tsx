/**
 * ProjectMembers.tsx — 项目成员管理面板
 *
 * 展示在 ProjectDetail 的"成员"tab 中：
 *   - 成员列表（头像 + 角色标签）
 *   - 邀请链接生成 + 复制
 *   - 角色修改（owner only）
 *   - 移除成员 / 退出项目
 */

import { useState, useCallback } from "react";
import {
  Users, UserPlus, Copy, Check, Trash2, Crown,
  Pencil, Eye, Link2, Loader2, LogOut, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_CONFIG = {
  owner:  { label: "Owner",  icon: Crown,  color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  editor: { label: "Editor", icon: Pencil, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  viewer: { label: "Viewer", icon: Eye,    color: "text-gray-500 bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-700" },
};

interface ProjectMembersProps {
  projectId: number;
  myRole: string | null;
}

export function ProjectMembers({ projectId, myRole }: ProjectMembersProps) {
  const utils = trpc.useUtils();
  const isOwner = myRole === "owner";
  const isEditor = myRole === "editor" || isOwner;

  const { data: members, isLoading } = trpc.project.getMembers.useQuery({ projectId });
  const { data: invites } = trpc.project.getInvites.useQuery({ projectId }, { enabled: isEditor });

  const createInviteMutation = trpc.project.createInvite.useMutation({
    onSuccess: () => { utils.project.getInvites.invalidate({ projectId }); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: () => { utils.project.getMembers.invalidate({ projectId }); toast.success("已移除成员"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateRoleMutation = trpc.project.updateMemberRole.useMutation({
    onSuccess: () => { utils.project.getMembers.invalidate({ projectId }); toast.success("角色已更新"); },
    onError: (e: any) => toast.error(e.message),
  });
  const leaveMutation = trpc.project.leave.useMutation({
    onSuccess: () => { toast.success("已退出项目"); window.location.href = "/projects"; },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteInviteMutation = trpc.project.deleteInvite.useMutation({
    onSuccess: () => { utils.project.getInvites.invalidate({ projectId }); toast.success("链接已删除"); },
    onError: (e: any) => toast.error(e.message),
  });

  // 邀请配置
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreateInvite = useCallback(() => {
    createInviteMutation.mutate({ projectId, role: inviteRole, maxUses: 10, expiresInHours: 72 });
  }, [projectId, inviteRole, createInviteMutation]);

  const handleCopyLink = useCallback(async (token: string) => {
    const url = `${window.location.origin}/projects/join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("邀请链接已复制");
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 px-4">
      {/* 成员列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            成员 ({members?.length || 0})
          </h3>
        </div>

        <div className="space-y-2">
          {members?.map((m: any) => {
            const cfg = ROLE_CONFIG[m.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
            const RoleIcon = cfg.icon;
            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                {/* 头像 */}
                {m.userAvatar ? (
                  <img src={m.userAvatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(m.userName || "?")[0].toUpperCase()}
                  </div>
                )}

                {/* 名称 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.userName || m.userEmail || `User #${m.userId}`}</p>
                  {m.userEmail && <p className="text-[11px] text-muted-foreground truncate">{m.userEmail}</p>}
                </div>

                {/* 角色标签 */}
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", cfg.color)}>
                  <RoleIcon className="w-3 h-3" />
                  {cfg.label}
                </span>

                {/* 操作 */}
                {isOwner && m.role !== "owner" && (
                  <div className="flex items-center gap-1">
                    <select
                      value={m.role}
                      onChange={(e) => updateRoleMutation.mutate({ projectId, userId: m.userId, role: e.target.value as "editor" | "viewer" })}
                      className="h-6 text-[11px] bg-transparent border rounded px-1 text-muted-foreground"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => removeMemberMutation.mutate({ projectId, userId: m.userId })}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-muted-foreground hover:text-red-500 transition-colors"
                      title="移除成员"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 邀请 */}
      {isEditor && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            邀请协作者
          </h3>

          <div className="flex items-center gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              className="h-8 text-sm bg-background border rounded-md px-2"
            >
              <option value="editor">可编辑</option>
              <option value="viewer">仅查看</option>
            </select>
            <Button
              size="sm"
              onClick={handleCreateInvite}
              disabled={createInviteMutation.isPending}
              className="h-8 gap-1.5"
            >
              {createInviteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              生成邀请链接
            </Button>
          </div>

          {/* 已有邀请链接 */}
          {invites && invites.length > 0 && (
            <div className="space-y-1.5">
              {invites.map((inv: any) => {
                const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                const exhausted = inv.usedCount >= inv.maxUses;
                const invCfg = ROLE_CONFIG[inv.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
                return (
                  <div key={inv.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs", expired || exhausted ? "opacity-50" : "")}>
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-muted-foreground truncate flex-1">
                      ...{inv.token.slice(-8)}
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] border", invCfg.color)}>
                      {invCfg.label}
                    </span>
                    <span className="text-muted-foreground/60">
                      {inv.usedCount}/{inv.maxUses}
                    </span>
                    {!expired && !exhausted && (
                      <button onClick={() => handleCopyLink(inv.token)} className="p-1 hover:bg-muted rounded">
                        {copied === inv.token ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => deleteInviteMutation.mutate({ projectId, inviteId: inv.id })}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 新生成的邀请链接（即时显示） */}
          {createInviteMutation.data && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5">
              <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
              <code className="text-xs text-primary font-mono truncate flex-1">
                {window.location.origin}/projects/join/{createInviteMutation.data.token}
              </code>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleCopyLink(createInviteMutation.data!.token)}
              >
                {copied === createInviteMutation.data.token ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                复制
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 退出项目（非 owner） */}
      {!isOwner && myRole && (
        <div className="pt-4 border-t">
          <Button
            variant="outline" size="sm"
            className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 gap-1.5"
            onClick={() => {
              if (confirm("确定要退出此项目吗？")) {
                leaveMutation.mutate({ projectId });
              }
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            退出项目
          </Button>
        </div>
      )}
    </div>
  );
}
