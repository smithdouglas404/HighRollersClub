import { Brain, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachingToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function CoachingToggle({ enabled, onToggle }: CoachingToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border",
        enabled
          ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_rgba(212,175,55,0.3)]"
          : "bg-surface-high/50 border-white/10 text-muted-foreground hover:border-white/20"
      )}
    >
      <Brain className={cn("w-4 h-4 transition-colors", enabled ? "text-primary" : "text-muted-foreground")} />
      <span>Coach</span>
      <span className={cn(
        "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
        enabled ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
      )}>
        {enabled ? "ON" : "OFF"}
      </span>
      {!enabled && (
        <span className="flex items-center gap-0.5 text-[9px] text-amber-400/60">
          <Coins className="w-2.5 h-2.5" />
          50
        </span>
      )}
    </button>
  );
}
