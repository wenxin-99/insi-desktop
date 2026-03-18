/**
 * UsersTab — 用户余额管理标签页
 * 从 FishCoinManagement.tsx 拆分
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Plus, Minus } from "lucide-react";

interface UsersTabProps {
  filteredUsers: any[] | undefined;
  usersLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  refetchUsers: () => void;
  setSelectedUserId: (id: number) => void;
  adjustType: "add" | "deduct";
  setAdjustType: (v: "add" | "deduct") => void;
  adjustAmount: string;
  setAdjustAmount: (v: string) => void;
  adjustReason: string;
  setAdjustReason: (v: string) => void;
  handleAdjustBalance: () => void;
  adjustBalancePending: boolean;
}

export function UsersTab(props: UsersTabProps) {
  const {
    filteredUsers, usersLoading, searchTerm, setSearchTerm, refetchUsers,
    setSelectedUserId, adjustType, setAdjustType, adjustAmount, setAdjustAmount,
    adjustReason, setAdjustReason, handleAdjustBalance, adjustBalancePending,
  } = props;

  return (
    <Card className="p-6 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="搜索用户名或邮箱..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => refetchUsers()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />刷新
        </Button>
      </div>

      {usersLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户ID</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>登录方式</TableHead>
                <TableHead>鱼币余额</TableHead>
                <TableHead>论坛积分</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{user.id}</TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={user.loginMethod.includes("forum") ? "default" : "secondary"}>
                      {user.loginMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-blue-600">
                    {parseFloat(user.fishCoinBalance).toFixed(2)} 🐟
                  </TableCell>
                  <TableCell>{user.forumPoints !== null ? `${user.forumPoints} 分` : "-"}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedUserId(user.id)}>调整余额</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>调整用户余额</DialogTitle>
                          <DialogDescription>
                            用户：{user.name} (ID: {user.id})<br />
                            当前余额：{parseFloat(user.fishCoinBalance).toFixed(2)} 🐟
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>操作类型</Label>
                            <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "add" | "deduct")}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="add"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-green-600" />增加余额</div></SelectItem>
                                <SelectItem value="deduct"><div className="flex items-center gap-2"><Minus className="h-4 w-4 text-red-600" />扣除余额</div></SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>金额</Label>
                            <Input type="number" placeholder="请输入金额" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} min="0" step="0.01" />
                          </div>
                          <div className="space-y-2">
                            <Label>原因</Label>
                            <Input placeholder="请输入调整原因" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAdjustBalance} disabled={adjustBalancePending}>
                            {adjustBalancePending ? "处理中..." : "确认调整"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
