import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";

/**
 * 视频分享页面 - 公开访问，无需登录
 */
export default function VideoShare() {
  const params = useParams();
  const shareToken = params.token || "";

  const { data, isLoading, error } = trpc.videos.getSharedVideo.useQuery(
    { shareToken },
    { enabled: !!shareToken }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载视频中...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-semibold mb-2 text-gray-900">无法加载视频</h2>
          <p className="text-gray-600">{error.message}</p>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // 生成分享页面的完整URL
  const sharePageUrl = `${window.location.origin}/share/video/${shareToken}`;
  const siteName = "Insi智能代理平台";
  
  // 使用视频缩略图作为OG图片，如果没有则使用视频第一帧
  const ogImage = data.videoUrl; // 可以后续添加缩略图生成功能
  
  return (
    <>
      <Helmet>
        {/* 基本元标签 */}
        <title>{data.title} - {siteName}</title>
        <meta name="description" content={data.description || `观看这个由AI生成的${data.duration}秒视频`} />
        
        {/* Open Graph 标签 */}
        <meta property="og:type" content="video.other" />
        <meta property="og:title" content={data.title} />
        <meta property="og:description" content={data.description || `观看这个由AI生成的${data.duration}秒视频`} />
        <meta property="og:url" content={sharePageUrl} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:video" content={data.videoUrl} />
        <meta property="og:video:secure_url" content={data.videoUrl} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1920" />
        <meta property="og:video:height" content="1080" />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter Card 标签 */}
        <meta name="twitter:card" content="player" />
        <meta name="twitter:title" content={data.title} />
        <meta name="twitter:description" content={data.description || `观看这个由AI生成的${data.duration}秒视频`} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:player" content={data.videoUrl} />
        <meta name="twitter:player:width" content="1920" />
        <meta name="twitter:player:height" content="1080" />
        <meta name="twitter:player:stream" content={data.videoUrl} />
        <meta name="twitter:player:stream:content_type" content="video/mp4" />
        
        {/* 微信分享优化 */}
        <meta itemProp="name" content={data.title} />
        <meta itemProp="description" content={data.description || `观看这个由AI生成的${data.duration}秒视频`} />
        <meta itemProp="image" content={ogImage} />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="overflow-hidden shadow-2xl">
          {/* 视频标题 */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
            {data.description && (
              <p className="text-purple-100">{data.description}</p>
            )}
          </div>

          {/* 视频播放器 */}
          <div className="bg-black">
            <video
              src={data.videoUrl}
              controls
              className="w-full aspect-video"
              autoPlay
              loop
            >
              您的浏览器不支持视频播放
            </video>
          </div>

          {/* 视频信息 */}
          <div className="p-6 bg-white">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-4">
                <span>时长: {data.duration}秒</span>
                <span>·</span>
                <span>观看次数: {data.viewCount}</span>
              </div>
              <span>
                生成于{" "}
                {new Date(data.createdAt).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* CTA按钮 */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-gray-700 mb-4">
                想生成自己的AI视频吗？
              </p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                立即体验 AI视频生成
              </a>
            </div>
          </div>
        </Card>

        {/* 页脚 */}
        <div className="text-center mt-8 text-gray-600">
          <p>由 Insi智能代理平台 提供技术支持</p>
        </div>
      </div>
    </div>
    </>
  );
}
