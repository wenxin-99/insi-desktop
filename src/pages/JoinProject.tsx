/**
 * JoinProject.tsx — 通过邀请链接加入项目
 *
 * 路由：/projects/join/:token
 */
import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinProject() {
  const [, params] = useRoute("/projects/join/:token");
  const [, setLocation] = useLocation();
  const token = params?.token || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);

  const acceptMutation = trpc.project.acceptInvite.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setProjectId(data.projectId || null);
    },
    onError: (e) => {
      setStatus("error");
      setErrorMsg(e.message);
    },
  });

  useEffect(() => {
    if (token) {
      acceptMutation.mutate({ token });
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="text-lg font-medium">正在加入项目...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <p className="text-lg font-medium">已成功加入项目</p>
            <p className="text-sm text-muted-foreground">你现在可以查看项目中的对话和文件</p>
            <Button onClick={() => setLocation(projectId ? `/projects/${projectId}` : "/projects")} className="mt-4 gap-2">
              <Users className="w-4 h-4" />
              进入项目
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
            <p className="text-lg font-medium">加入失败</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={() => setLocation("/projects")} className="mt-4">
              返回项目列表
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
