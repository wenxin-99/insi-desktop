import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDownload } from "../hooks/useDownload";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Video, Download, Loader2, CheckCircle2, XCircle, Clock, Search, Star, StarOff, Filter, Download as DownloadIcon, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/timeUtils";
import JSZip from "jszip";

export default function VideoHistory() {
  const { t } = useTranslation();

export function VideoFilterBar(props: any) {
  const { t, data } = props;
  return (
    <>
      {/* 筛选栏 */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('videoHistory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* 状态筛选 */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t('videoHistory.statusFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('videoHistory.allStatus')}</SelectItem>
              <SelectItem value="pending">{t('videoHistory.status.pending')}</SelectItem>
              <SelectItem value="processing">{t('videoHistory.status.processing')}</SelectItem>
              <SelectItem value="completed">{t('videoHistory.status.completed')}</SelectItem>
              <SelectItem value="failed">{t('videoHistory.status.failed')}</SelectItem>
            </SelectContent>
          </Select>

          {/* 服务商筛选 */}
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t('videoHistory.providerFilter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('videoHistory.allProviders')}</SelectItem>
              <SelectItem value="Pika">Pika</SelectItem>
            </SelectContent>
          </Select>

          {/* 全选/取消全选 */}
          {filteredVideos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSelectAll}
            >
              {selectedVideos.size === filteredVideos.filter(v => v.status === 'completed' && v.videoUrl).length
                ? t('videoHistory.deselectAll')
                : t('videoHistory.selectAll')}
            </Button>
          )}
        </div>
      </Card>

      {/* 视频列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card className="p-12">
    </>
  );
}