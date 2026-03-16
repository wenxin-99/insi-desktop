import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Star, ImagePlus, X, Loader2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  url?: string;
  fileKey?: string;    // S3 key for deletion after AI analysis
  uploading: boolean;
  error?: string;
}

export default function Feedback() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [type, setType] = useState<"bug" | "feature" | "improvement" | "other">("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: myFeedbacks, refetch } = trpc.feedback.getMyFeedbacks.useQuery();
  const uploadMutation = trpc.file.uploadToS3.useMutation();

  const createFeedback = trpc.feedback.create.useMutation({
    onSuccess: () => {
      toast.success(t('feedback.toast.submitSuccess'));
      setTitle(""); setContent(""); setRating(5);
      images.forEach(i => URL.revokeObjectURL(i.preview));
      setImages([]);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // ── 压缩图片 ──
  const compressImage = useCallback((file: File, maxW = 1920): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width: w, height: h } = img;
          if (w > maxW) { h = (h * maxW) / w; w = maxW; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
  }, []);

  // ── 上传到 S3 ──
  const uploadImage = useCallback(async (img: UploadedImage) => {
    try {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, uploading: true, error: undefined } : i));
      const base64 = await compressImage(img.file);
      const result = await uploadMutation.mutateAsync({
        filename: `feedback-${Date.now()}-${img.file.name}`,
        mimeType: "image/jpeg",
        fileData: base64,
      });
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, url: result.fileUrl, fileKey: result.fileKey, uploading: false } : i));
    } catch (err: any) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, uploading: false, error: err.message || "上传失败" } : i));
    }
  }, [compressImage, uploadMutation]);

  // ── 选择图片 ──
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`最多只能上传 ${MAX_IMAGES} 张图片`); return; }

    const newImgs: UploadedImage[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) { toast.error(`${file.name} 格式不支持`); continue; }
      if (file.size > MAX_IMAGE_SIZE) { toast.error(`${file.name} 超过5MB`); continue; }
      newImgs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file, preview: URL.createObjectURL(file), uploading: false,
      });
    }
    if (newImgs.length > 0) {
      setImages(prev => [...prev, ...newImgs]);
      for (const img of newImgs) uploadImage(img);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images.length, uploadImage]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { toast.error(t('feedback.toast.fillRequired')); return; }
    if (images.some(i => i.uploading)) { toast.error("图片上传中，请稍候..."); return; }
    const imageData = images.filter(i => i.url).map(i => ({ url: i.url!, key: i.fileKey || "" }));
    createFeedback.mutate({ type, title, content, rating, images: imageData });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pending: "secondary", in_progress: "default", resolved: "outline", closed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: t('feedback.status.pending'), in_progress: t('feedback.status.inProgress'),
      resolved: t('feedback.status.resolved'), closed: t('feedback.status.closed'),
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      bug: t('feedback.type.bug'), feature: t('feedback.type.feature'),
      improvement: t('feedback.type.improvement'), other: t('feedback.type.other'),
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t('feedback.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('feedback.description')}</p>
        </div>

        {/* 提交反馈表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />{t('feedback.form.title')}
            </CardTitle>
            <CardDescription>{t('feedback.form.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="type">{t('feedback.form.typeLabel')}</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">{t('feedback.type.bug')}</SelectItem>
                      <SelectItem value="feature">{t('feedback.type.feature')}</SelectItem>
                      <SelectItem value="improvement">{t('feedback.type.improvement')}</SelectItem>
                      <SelectItem value="other">{t('feedback.type.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rating">{t('feedback.form.ratingLabel')}</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setRating(star)} className="transition-colors">
                        <Star className={`h-6 w-6 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">{rating} {t('feedback.form.stars')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">{t('feedback.form.titleLabel')}</Label>
                <Input id="title" placeholder={t('feedback.form.titlePlaceholder')} value={title}
                  onChange={(e) => setTitle(e.target.value)} maxLength={255} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{t('feedback.form.contentLabel')}</Label>
                <Textarea id="content" placeholder={t('feedback.form.contentPlaceholder')} value={content}
                  onChange={(e) => setContent(e.target.value)} rows={6} className="resize-none" />
              </div>

              {/* ── 图片上传 ── */}
              <div className="space-y-2">
                <Label>截图 / 图片（可选，最多 {MAX_IMAGES} 张）</Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                      {img.error && (
                        <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center p-1"
                          onClick={() => uploadImage(img)}>
                          <span className="text-white text-[10px] text-center leading-tight">失败，点击重试</span>
                        </div>
                      )}
                      <button type="button" onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                      {img.url && !img.uploading && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-[11px]">添加图片</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                {images.length > 0 && (
                  <p className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES} 张，支持 JPG/PNG/GIF/WebP，单张≤5MB</p>
                )}
              </div>

              <Button type="submit" disabled={createFeedback.isPending || images.some(i => i.uploading)} className="w-full md:w-auto">
                {createFeedback.isPending ? t('feedback.form.submitting') : t('feedback.form.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 反馈历史 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('feedback.history.title')}</CardTitle>
            <CardDescription>{t('feedback.history.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!myFeedbacks || myFeedbacks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('feedback.history.empty')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myFeedbacks.map((feedback) => (
                  <Card key={feedback.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{feedback.title}</CardTitle>
                            {getTypeBadge(feedback.type)}
                            {getStatusBadge(feedback.status)}
                          </div>
                          {feedback.rating && (
                            <div className="flex items-center gap-1">
                              {[...Array(feedback.rating)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{new Date(feedback.createdAt).toLocaleDateString()}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{feedback.content}</p>
                      {/* 反馈图片 */}
                      {(() => {
                        try {
                          const raw = (feedback as any).screenshotUrl;
                          if (!raw) return null;
                          const imgs = JSON.parse(raw);
                          if (!Array.isArray(imgs) || imgs.length === 0) return null;
                          // 兼容 [{url,key}] 和 [url] 两种格式
                          const urls = imgs.map((item: any) => typeof item === "string" ? item : item?.url).filter(Boolean);
                          if (urls.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-2">
                              {urls.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`截图${i + 1}`}
                                    className="w-20 h-20 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity" />
                                </a>
                              ))}
                            </div>
                          );
                        } catch { return null; }
                      })()}
                      {feedback.adminResponse && (
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">管理员回复：</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{feedback.adminResponse}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
