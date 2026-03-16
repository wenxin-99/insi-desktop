import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload, FileText, FileAudio, Coins, Download, Eye, Camera } from "lucide-react";
import BackButton from "@/components/BackButton";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from '@/components/DashboardLayout';


export default function Files() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { data: files, refetch: refetchFiles } = trpc.file.getAll.useQuery();
  const { data: balance, refetch: refetchBalance } = trpc.fishCoin.getBalance.useQuery();

  const getUploadUrlMutation = trpc.file.getUploadUrl.useMutation();
  const confirmUploadMutation = trpc.file.confirmUpload.useMutation({
    onSuccess: () => {
      refetchFiles();
    },
    onError: (error) => {
      toast.error(`上传失败: ${error.message}`);
    },
  });

  const processPdfMutation = trpc.file.processPdf.useMutation({
    onSuccess: (data) => {
      toast.success(`PDF处理完成，消耗 ${data.cost} 🐟币`);
      refetchFiles();
      refetchBalance();
    },
    onError: (error) => {
      toast.error(`处理失败: ${error.message}`);
    },
  });

  const transcribeAudioMutation = trpc.file.transcribeAudio.useMutation({
    onSuccess: (data) => {
      toast.success(`语音转录完成，消耗 ${data.cost} 🐟币`);
      refetchFiles();
      refetchBalance();
    },
    onError: (error) => {
      toast.error(`转录失败: ${error.message}`);
    },
  });

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件大小限制 (16MB)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("文件大小超过16MB限制");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. 获取上传URL和fileKey
      const uploadUrlData = await getUploadUrlMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // 2. 使用storagePut上传文件到S3
      // 由于storagePut是服务端函数，我们需要通过API路由来调用
      const reader = new FileReader();
      
      const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // 调用后端上传API
      const uploadHeaders: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'X-File-Key': uploadUrlData.fileKey,
        'X-File-Type': file.type,
      };
      const token = localStorage.getItem('auth_token');
      if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: uploadHeaders,
        credentials: 'include',
        body: fileBuffer,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!uploadResponse.ok) {
        throw new Error('文件上传失败');
      }

      const { url: fileUrl } = await uploadResponse.json();

      // 3. 确认上传，创建数据库记录
      await confirmUploadMutation.mutateAsync({
        fileKey: uploadUrlData.fileKey,
        fileUrl: fileUrl,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(0);

      // 清空输入
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("文件上传失败");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleProcessPdf = (fileId: number) => {
    // 需要选择模型，这里使用默认模型ID（1）
    processPdfMutation.mutate({ fileId, modelId: 1, task: "提取文本" });
  };

  const handleTranscribeAudio = (fileId: number) => {
    // 需要选择模型，这里使用默认模型ID（1）
    transcribeAudioMutation.mutate({ fileId, modelId: 1 });
  };

  const handleViewResult = (file: any) => {
    setSelectedFile(file);
    setViewDialogOpen(true);
  };

  const documentFiles = files?.filter((f) => f.category === "pdf" || f.category === "word");
  const audioFiles = files?.filter((f) => f.category === "audio");

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      pending: { label: "待处理", className: "bg-yellow-500/10 text-yellow-500" },
      processing: { label: "处理中", className: "bg-blue-500/10 text-blue-500" },
      completed: { label: "已完成", className: "bg-green-500/10 text-green-500" },
      failed: { label: "失败", className: "bg-red-500/10 text-red-500" },
    };
    const badge = badges[status] || badges.pending;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  return (
    <DashboardLayout>
    <div className="container mx-auto py-8 space-y-6">
      <BackButton className="mb-4" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文件处理</h1>
          <p className="text-muted-foreground mt-2">上传PDF、Word文档或音频文件进行AI处理</p>
        </div>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-yellow-500" />
          <span className="text-lg font-semibold">{balance ? parseFloat(balance.balance).toFixed(2) : "0.00"} 🐟币</span>
        </div>
      </div>

      {/* 文件上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle>上传文件</CardTitle>
          <CardDescription>支持PDF、Word文档和音频文件，最大16MB</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">点击选择文件或拖拽文件到此处</p>
              <p className="text-xs text-muted-foreground mt-1">支持 PDF, DOCX, MP3, WAV 等格式</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.mp3,.wav,.m4a,.ogg,image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              id="camera-upload"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="lg"
                variant="default"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    选择文件
                  </>
                )}
              </Button>
              {isMobile && (
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  size="lg"
                  variant="outline"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  拍照
                </Button>
              )}
            </div>
            {uploading && uploadProgress > 0 && (
              <div className="w-full max-w-md space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{uploadProgress}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            文档 ({documentFiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="audio">
            <FileAudio className="mr-2 h-4 w-4" />
            音频 ({audioFiles?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>文档列表</CardTitle>
              <CardDescription>已上传的PDF和Word文档</CardDescription>
            </CardHeader>
            <CardContent>
              {!documentFiles || documentFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无文档文件
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>上传时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.originalName}</TableCell>
                        <TableCell>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</TableCell>
                        <TableCell>{getStatusBadge(file.status)}</TableCell>
                        <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {file.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleProcessPdf(file.id)}
                                disabled={processPdfMutation.isPending}
                              >
                                {processPdfMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "处理"
                                )}
                              </Button>
                            )}
                            {file.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewResult(file)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                查看
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild>
                              <a href={file.fileUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>音频列表</CardTitle>
              <CardDescription>已上传的音频文件</CardDescription>
            </CardHeader>
            <CardContent>
              {!audioFiles || audioFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无音频文件
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>上传时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audioFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.originalName}</TableCell>
                        <TableCell>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</TableCell>
                        <TableCell>{getStatusBadge(file.status)}</TableCell>
                        <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {file.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleTranscribeAudio(file.id)}
                                disabled={transcribeAudioMutation.isPending}
                              >
                                {transcribeAudioMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "转录"
                                )}
                              </Button>
                            )}
                            {file.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewResult(file)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                查看
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild>
                              <a href={file.fileUrl} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 查看结果对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>处理结果</DialogTitle>
            <DialogDescription>
              文件: {selectedFile?.originalName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile?.result && (
              <div className="bg-muted p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">
                  {typeof selectedFile.result === 'string' 
                    ? selectedFile.result 
                    : JSON.stringify(selectedFile.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
