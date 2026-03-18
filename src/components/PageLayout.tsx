import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useSwipeable } from "react-swipeable";

interface PageLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
}

export default function PageLayout({
  children,
  showBackButton = true,
  onBack,
  className = "",
}: PageLayoutProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  // 左滑返回手势（仅移动端）
  const swipeHandlers = useSwipeable({
    onSwipedRight: (eventData) => {
      // 只有从屏幕左边缘开始的滑动才触发返回
      if (eventData.initial[0] < 50 && showBackButton) {
        handleBack();
      }
    },
    trackMouse: false, // 桌面端不启用
    trackTouch: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={className}
      {...swipeHandlers}
    >
      {showBackButton && (
        <Button
          variant="ghost"
          size="default"
          onClick={handleBack}
          className="min-h-[44px] px-4 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span className="text-base">返回</span>
        </Button>
      )}
      {children}
    </motion.div>
  );
}
