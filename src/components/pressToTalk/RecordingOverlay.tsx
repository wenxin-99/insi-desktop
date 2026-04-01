/**
 * pressToTalk/RecordingOverlay — 录音中全屏覆盖 UI
 * 从 PressToTalkButton.tsx 第 455-503 行提取
 */
import { X } from "lucide-react";
import { WaveCanvas } from "./WaveCanvas";

const CANCEL_THRESHOLD = 80;

interface RecordingOverlayProps {
  state: "recording" | "cancel-zone";
  duration: number;
  dragY: number;
  audioStream?: MediaStream;
  isRealtimeActive: boolean;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function RecordingOverlay({ state, duration, dragY, audioStream, isRealtimeActive }: RecordingOverlayProps) {
  const isCancelZone = state === "cancel-zone";
  const cancelProgress = Math.min(dragY / CANCEL_THRESHOLD, 1);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 transition-transform duration-75"
        style={{ transform: `translateY(${-dragY * 0.25}px)` }}
      >
        {/* Cancel bubble */}
        <div
          className={[
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-150",
            isCancelZone
              ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110"
              : "bg-background/90 text-muted-foreground border border-border/60",
          ].join(" ")}
          style={{ opacity: 0.3 + cancelProgress * 0.7 }}
        >
          <X className="w-4 h-4" />
          {isCancelZone ? "松开取消" : "↑ 上滑取消"}
        </div>

        {/* Recording card */}
        <div
          className={[
            "bg-background/95 backdrop-blur rounded-2xl shadow-2xl border px-8 py-6 flex flex-col items-center gap-4 min-w-[240px] transition-all duration-150",
            isCancelZone ? "border-red-500/40 opacity-75" : "border-border",
          ].join(" ")}
        >
          <WaveCanvas stream={audioStream} active={state === "recording"} />
          <div className={`text-3xl font-mono font-bold tabular-nums transition-colors duration-150 ${isCancelZone ? "text-red-500" : ""}`}>
            {fmt(duration)}
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className={`text-sm font-medium transition-colors ${isCancelZone ? "text-red-500" : "text-red-500"}`}>
              {isCancelZone ? "⚠ 松开即可取消" : "● 正在录音"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCancelZone ? "" : isRealtimeActive ? "边说边识别中..." : "松开发送"}
            </p>
          </div>
          {cancelProgress > 0 && (
            <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-red-500 transition-all duration-75" style={{ width: `${cancelProgress * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
