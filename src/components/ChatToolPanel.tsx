
import { ThinkingProcessPanel, ThinkingStep } from "@/components/ThinkingProcessPanel";

interface ChatToolPanelProps {
  onNewConversation: () => void;
  onClearHistory: () => void;
  messageCount: number;
  conversationCount: number;
  thinkingSteps?: ThinkingStep[];
}

export function ChatToolPanel({
  onNewConversation,
  onClearHistory,
  messageCount,
  conversationCount,
  thinkingSteps = [],
}: ChatToolPanelProps) {
  return (
    <div className="hidden 2xl:flex flex-col gap-4 w-80 h-full overflow-y-auto p-4 border-l border-border/50 bg-muted/20">
      {/* AI思考流程面板 - 始终显示 */}
      <ThinkingProcessPanel steps={thinkingSteps} />
    </div>
  );
}
