import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Download, Trash2, Image as ImageIcon, Loader2, CheckSquare, Square, Edit, RefreshCw, ArrowLeft } from "lucide-react";
import { safeToast } from "@/lib/safeToast";
import { toast } from "sonner";
import JSZip from "jszip";
import { formatRelativeTime } from "@/lib/timeUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


export function ImageGridCard(props: any) {
  return (
    <>
      {/* 图片网格 - 响应式瀑布流布局 */}
      {images && images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((image: any) => (
            <Card
              key={image.id}
              className={`group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                selectionMode && selectedImages.has(image.id) ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => {
                if (selectionMode) {
                  const newSelected = new Set(selectedImages);
                  if (newSelected.has(image.id)) {
                    newSelected.delete(image.id);
                  } else {
                    newSelected.add(image.id);
                  }
                  setSelectedImages(newSelected);
                } else {
                  setSelectedImage(image);
                  setLightboxOpen(true);
                }
              }}
            >
              <CardContent className="p-0">
                {/* 图片 */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt={image.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  
                  {/* 选择框 - 批量选择模式 */}
                  {selectionMode && (
                    <div className="absolute top-2 left-2 p-2 rounded-full bg-background/80 backdrop-blur-sm">
                      {selectedImages.has(image.id) ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  
                  {/* 收藏按钮 - 移动端始终显示，桌面端hover显示 */}
                  {!selectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteMutation.mutate({ imageId: image.id });
                      }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          image.isFavorite ? "fill-red-500 text-red-500" : "text-foreground"
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* 信息区域 */}
                <div className="p-3 space-y-2">
                  {/* Prompt */}
                  <p className="text-sm line-clamp-2 text-foreground">
                    {image.prompt}
                  </p>

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatRelativeTime(new Date(image.createdAt).getTime())}</span>
                    <span>{Number(image.cost).toFixed(2)} 🐟币</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {filter === "favorites" ? t('imageGallery.noFavorites') : t('imageGallery.noImages')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filter === "favorites"
              ? t('imageGallery.noFavoritesDesc')
              : t('imageGallery.noImagesDesc')}
          </p>
        </div>
      )}

    </>
  );
}