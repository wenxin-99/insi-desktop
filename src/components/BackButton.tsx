import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
}

export default function BackButton({ onClick, className = "" }: BackButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.history.back();
    }
  };

  return (
    <Button
      variant="ghost"
      size="default"
      onClick={handleClick}
      className={`min-h-[44px] px-4 ${className}`}
    >
      <ArrowLeft className="h-5 w-5 mr-2" />
      <span className="text-base">返回</span>
    </Button>
  );
}
