/**
 * BranchManager — 分支管理 Popover
 *
 * 功能:
 *   - 显示当前分支名
 *   - 列出本地+远程分支，点击切换
 *   - 新建分支输入框
 */
import { useState, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitBranch, Plus, Loader2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import axios from "axios";

interface BranchManagerProps {
  taskId: number;
  currentBranch: string;
  onBranchChanged?: (newBranch: string) => void;
  className?: string;
}

interface LocalBranch {
  name: string;
  current: boolean;
  lastCommit?: string;
}

export function BranchManager({
  taskId,
  currentBranch,
  onBranchChanged,
  className,
}: BranchManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [localBranches, setLocalBranches] = useState<LocalBranch[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState(currentBranch);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/github/workspace/${taskId}/branches`);
      setLocalBranches(data.local || []);
      setRemoteBranches(data.remote || []);
      setCurrent(data.current || currentBranch);
    } catch {
      // 静默失败
    }
    setLoading(false);
  }, [taskId, currentBranch]);

  useEffect(() => {
    if (open) loadBranches();
  }, [open, loadBranches]);

  const handleSwitch = async (branchName: string, create: boolean = false) => {
    if (branchName === current && !create) return;
    setSwitching(true);
    try {
      const { data } = await axios.post(`/api/github/workspace/${taskId}/branch`, {
        branchName,
        create,
      });
      if (data.success) {
        setCurrent(branchName);
        toast.success(data.message);
        onBranchChanged?.(branchName);
        setOpen(false);
        setShowCreate(false);
        setNewBranchName("");
      } else {
        toast.error(data.message);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "切换失败");
    }
    setSwitching(false);
  };

  const handleCreate = () => {
    const name = newBranchName.trim();
    if (!name) return;
    // 简单校验分支名
    if (/[^a-zA-Z0-9\-_\/.]/.test(name)) {
      toast.error("分支名只能包含字母、数字、-、_、/、.");
      return;
    }
    handleSwitch(name, true);
  };

  // 远程分支中不在本地的
  const localNames = new Set(localBranches.map((b) => b.name));
  const remoteOnly = remoteBranches.filter((b) => !localNames.has(b));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 h-8 text-xs font-mono", className)}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span className="truncate max-w-[120px]">{current}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-medium">切换分支</p>
        </div>

        <div className="max-h-[280px] overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* 本地分支 */}
              {localBranches.length > 0 && (
                <div className="px-2 py-1">
                  <p className="text-[10px] text-muted-foreground px-1 mb-1 uppercase tracking-wider">
                    本地分支
                  </p>
                  {localBranches.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      disabled={switching}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors",
                        b.name === current
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                      onClick={() => handleSwitch(b.name)}
                    >
                      {b.name === current && (
                        <Check className="h-3 w-3 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "font-mono truncate",
                          b.name !== current && "ml-5"
                        )}
                      >
                        {b.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* 远程分支 */}
              {remoteOnly.length > 0 && (
                <div className="px-2 py-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground px-1 mb-1 mt-1 uppercase tracking-wider">
                    远程分支
                  </p>
                  {remoteOnly.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={switching}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-muted transition-colors"
                      onClick={() => handleSwitch(name)}
                    >
                      <span className="font-mono truncate ml-5 text-muted-foreground">
                        {name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 新建分支 */}
        <div className="border-t border-border p-2">
          {showCreate ? (
            <div className="flex gap-1">
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="new-branch-name"
                className="h-7 text-xs font-mono"
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleCreate}
                disabled={switching || !newBranchName.trim()}
              >
                {switching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3 w-3" />
              新建分支
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
