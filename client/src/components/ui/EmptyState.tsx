import { GLASS_PANEL, HEADING_SM, BTN_GOLD, BTN_GOLD_HOVER } from "@/lib/design-tokens";

interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, message, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={`${GLASS_PANEL} flex flex-col items-center justify-center gap-4 py-12 px-6 ${className || ""}`}>
      <span className="text-gray-500 text-4xl">{icon}</span>
      <p className={HEADING_SM}>{message}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className={`${BTN_GOLD} ${BTN_GOLD_HOVER}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
