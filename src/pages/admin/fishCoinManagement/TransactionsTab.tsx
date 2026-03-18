/**
 * TransactionsTab — 交易记录标签页
 * 从 FishCoinManagement.tsx 拆分
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Undo2 } from "lucide-react";

interface TransactionsTabProps {
  users: any[] | undefined;
  transactions: any[] | undefined;
  transactionsLoading: boolean;
  selectedUserId: number | null;
  setSelectedUserId: (id: number) => void;
  userSearchTerm: string;
  setUserSearchTerm: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterSyncStatus: string;
  setFilterSyncStatus: (v: string) => void;
  filterDateRange: string;
  setFilterDateRange: (v: string) => void;
  selectedTransactions: number[];
  setSelectedTransactions: (v: number[]) => void;
  handleReverseDeduction: (id: number) => void;
  handleBatchReverse: () => void;
  batchReversePending: boolean;
}

export function TransactionsTab(props: TransactionsTabProps) {
  const {
    users, transactions, transactionsLoading,
    selectedUserId, setSelectedUserId,
    userSearchTerm, setUserSearchTerm,
    filterType, setFilterType,
    filterSyncStatus, setFilterSyncStatus,
    filterDateRange, setFilterDateRange,
    selectedTransactions, setSelectedTransactions,
    handleReverseDeduction, handleBatchReverse, batchReversePending,
  } = props;

  return (
    <Card className="p-6 bg-white/80 backdrop-blur-sm">
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>搜索用户（昵称或邮箱）</Label>
            <Input placeholder="输入用户昵称或邮箱进行搜索" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="mt-2" />
          </div>
          <div>
            <Label>选择用户查看交易记录</Label>
            <Select value={selectedUserId?.toString()} onValueChange={(v) => setSelectedUserId(parseInt(v))}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="请选择用户" /></SelectTrigger>
              <SelectContent>
                {users?.filter((user) => {
                  if (!userSearchTerm) return true;
                  const s = userSearchTerm.toLowerCase();
                  return (user.name || "").toLowerCase().includes(s) || (user.email || "").toLowerCase().includes(s);
                }).map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>{user.name} ({user.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedUserId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label>交易类型</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="recharge">充值</SelectItem>
                  <SelectItem value="consume">消费</SelectItem>
                  <SelectItem value="admin_adjust">调整</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>同步状态</Label>
              <Select value={filterSyncStatus} onValueChange={setFilterSyncStatus}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="synced">已同步</SelectItem>
                  <SelectItem value="unsynced">未同步</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>日期范围</Label>
              <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="week">最近7天</SelectItem>
                  <SelectItem value="month">最近30天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {transactionsLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : !selectedUserId ? (
        <div className="text-center py-8 text-gray-500">请先选择用户</div>
      ) : transactions && transactions.length > 0 ? (
        <>
          {selectedTransactions.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-4 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-700">已选择 {selectedTransactions.length} 笔交易</span>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleBatchReverse} disabled={batchReversePending}>
                  {batchReversePending ? "处理中..." : "批量撤销"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedTransactions([])}>取消选择</Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input type="checkbox"
                      checked={transactions.every((tx: any) => selectedTransactions.includes(tx.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTransactions(transactions.filter((tx: any) => tx.forumSynced && tx.forumRef && tx.type === "consume" && !tx.description.includes("[已撤销]")).map((tx: any) => tx.id));
                        } else { setSelectedTransactions([]); }
                      }}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>时间</TableHead><TableHead>类型</TableHead><TableHead>金额</TableHead>
                  <TableHead>描述</TableHead><TableHead>余额</TableHead><TableHead>论坛同步</TableHead>
                  <TableHead>参考编号</TableHead><TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {tx.forumSynced && tx.forumRef && tx.type === "consume" && !tx.description.includes("[已撤销]") ? (
                        <input type="checkbox" checked={selectedTransactions.includes(tx.id)}
                          onChange={(e) => e.target.checked
                            ? setSelectedTransactions([...selectedTransactions, tx.id])
                            : setSelectedTransactions(selectedTransactions.filter(id => id !== tx.id))
                          } className="cursor-pointer" />
                      ) : <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{new Date(tx.createdAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "recharge" ? "default" : tx.type === "consume" ? "destructive" : "secondary"}>
                        {tx.type === "recharge" ? "充值" : tx.type === "consume" ? "消费" : "调整"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`font-semibold ${parseFloat(tx.amount) > 0 ? "text-green-600" : "text-red-600"}`}>
                      {parseFloat(tx.amount) > 0 ? "+" : ""}{parseFloat(tx.amount).toFixed(2)} 🐟
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="font-mono">{parseFloat(tx.balanceAfter).toFixed(2)} 🐟</TableCell>
                    <TableCell>
                      {tx.forumSynced ? (
                        <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />已同步</Badge>
                      ) : (
                        <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />未同步</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{tx.forumRef || "-"}</TableCell>
                    <TableCell>
                      {tx.forumSynced && tx.forumRef && tx.type === "consume" && !tx.description.includes("[已撤销]") ? (
                        <Button variant="outline" size="sm" onClick={() => handleReverseDeduction(tx.id)} className="text-red-600 hover:text-red-700">
                          <Undo2 className="h-3 w-3 mr-1" />撤销
                        </Button>
                      ) : <span className="text-gray-400 text-sm">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">暂无交易记录</div>
      )}
    </Card>
  );
}
