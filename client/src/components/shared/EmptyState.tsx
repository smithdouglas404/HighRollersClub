import { type ReactNode } from "react";
import { GLASS_PANEL } from "@/lib/design-tokens";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`${GLASS_PANEL} p-10 flex flex-col items-center text-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground/60 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
