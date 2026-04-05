import { CARD_CLASSES, CARD_HOVER } from "@/lib/design-tokens";

export function GlassCard({ children, className, hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return <div className={`${CARD_CLASSES} ${hover ? CARD_HOVER : ""} ${className || ""}`}>{children}</div>;
}
