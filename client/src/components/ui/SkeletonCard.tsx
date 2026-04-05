import { CARD_CLASSES } from "@/lib/design-tokens";

interface SkeletonCardProps {
  height?: string;
  className?: string;
}

export function SkeletonCard({ height = "h-32", className }: SkeletonCardProps) {
  return (
    <div className={`${CARD_CLASSES} ${height} animate-pulse bg-white/[0.04] ${className || ""}`} />
  );
}
