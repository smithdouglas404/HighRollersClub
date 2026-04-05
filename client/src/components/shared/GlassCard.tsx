import { type ReactNode } from "react";
import { CARD_CLASSES, CARD_HOVER } from "@/lib/design-tokens";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", hover = true, onClick }: GlassCardProps) {
  return (
    <div
      className={`${CARD_CLASSES} ${hover ? CARD_HOVER : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}
