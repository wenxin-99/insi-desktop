import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Tag {
  id: number;
  name: string;
  color: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: number | null;
}

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export function TagManagementDialog({ open, onOpenChange, conversationId }: TagManagementDialogProps) {
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const utils = trpc.useUtils();
  const { data: tags = [], isLoading } = trpc.tag.getAll.useQuery();
  const { data: conversationTags = [] } = trpc.conversation.getTags.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );
  
  const conversationTagIds = conversationTags.map((t: any) => t.id);

  const createMutation = trpc.tag.create.useMutation({
    onSuccess: () => {
      utils.tag.getAll.invalidate();
      utils.conversation.getAllWithTags.invalidate();
      setNewTagName("");
      setNewTagColor(PRESET_COLORS[0]);
      setIsCreating(false);
      toast.success("标签创建成功");
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.tag.update.useMutation({
    onSuccess: () => {
      utils.tag.getAll.invalidate();
      utils.conversation.getAllWithTags.invalidate();
      setEditingTag(null);
      toast.success("标签更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: () => {
      utils.tag.getAll.invalidate();
      utils.conversation.getAllWithTags.invalidate();
      toast.success("标签删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const addTagToConversationMutation = trpc.conversation.addTag.useMutation({
    onSuccess: () => {
      utils.conversation.getTags.invalidate();
      utils.conversation.getAll.invalidate();
      toast.success("标签已添加");
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    },
  });

  const removeTagFromConversationMutation = trpc.conversation.removeTag.useMutation({
    onSuccess: () => {
      utils.conversation.getTags.invalidate();
      utils.conversation.getAll.invalidate();
      toast.success("标签已移除");
    },
    onError: (error) => {
      toast.error(`移除失败: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newTagName.trim()) {
      toast.error("请输入标签名称");
      return;
    }
    createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const handleUpdate = () => {
    if (!editingTag) return;
    updateMutation.mutate({
      tagId: editingTag.id,
      name: editingTag.name,
      color: editingTag.color,
    });
  };

  const handleDelete = (tagId: number) => {
    if (confirm("确定要删除这个标签吗？这将从所有对话中移除该标签。")) {
      deleteMutation.mutate({ tagId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>管理标签</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 创建新标签 */}
          {isCreating ? (
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <Label htmlFor="new-tag-name">标签名称</Label>
                <Input
                  id="new-tag-name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="输入标签名称"
                  maxLength={50}
                />
              </div>
              <div>
                <Label>选择颜色</Label>
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newTagColor === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1">
                  <Check className="w-4 h-4 mr-1" />
                  创建
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName("");
                    setNewTagColor(PRESET_COLORS[0]);
                  }}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-1" />
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsCreating(true)} className="w-full">
              <Plus className="w-4 h-4 mr-1" />
              创建新标签
            </Button>
          )}

          {/* 标签列表 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">加载中...</div>
            ) : tags.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">还没有标签，创建一个吧！</div>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className="border rounded-lg p-3">
                  {editingTag?.id === tag.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        maxLength={50}
                      />
                      <div className="flex gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditingTag({ ...editingTag, color })}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              editingTag.color === color ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleUpdate} disabled={updateMutation.isPending} size="sm" className="flex-1">
                          <Check className="w-4 h-4 mr-1" />
                          保存
                        </Button>
                        <Button variant="outline" onClick={() => setEditingTag(null)} size="sm" className="flex-1">
                          <X className="w-4 h-4 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {conversationId && (
                          <input
                            type="checkbox"
                            checked={conversationTagIds.includes(tag.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                addTagToConversationMutation.mutate({ conversationId, tagId: tag.id });
                              } else {
                                removeTagFromConversationMutation.mutate({ conversationId, tagId: tag.id });
                              }
                            }}
                            className="w-4 h-4 rounded"
                          />
                        )}
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="font-medium">{tag.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingTag(tag)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
