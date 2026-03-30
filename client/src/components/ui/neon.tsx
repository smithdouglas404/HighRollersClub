import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

/* ══════════════════════════════════════════════
   NeonButton — Primary action button system
   Variants: primary (cyan gradient), secondary, destructive, success, ghost, gold
   ══════════════════════════════════════════════ */

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "success" | "ghost" | "gold";
  size?: "sm" | "md" | "lg" | "icon";
}

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {

    const variants = {
      primary: "gradient-primary text-primary-foreground font-semibold hover:shadow-[0_0_20px_rgba(129,236,255,0.6)] active:scale-95 transition-all duration-200 border-none",
      secondary: "bg-surface-high border border-white/15 text-foreground hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200",
      destructive: "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:shadow-[0_0_20px_rgba(255,112,118,0.4)] transition-all duration-200",
      success: "bg-secondary/10 border border-secondary/30 text-secondary hover:bg-secondary hover:text-secondary-foreground hover:shadow-[0_0_20px_rgba(63,255,139,0.4)] transition-all duration-200",
      ghost: "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200",
      gold: "gradient-gold text-[#0a0a0c] font-bold gold-glow hover:scale-105 active:scale-95 transition-all duration-200 border-none",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-6 py-2.5",
      lg: "px-8 py-4 text-lg",
      icon: "p-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "relative overflow-hidden rounded-md inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NeonButton.displayName = "NeonButton";

/* ══════════════════════════════════════════════
   GlassCard — Frosted glass container with gradient sheen
   ══════════════════════════════════════════════ */

export const GlassCard = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn("glass-card p-6", className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

/* ══════════════════════════════════════════════
   GhostInput — Bottom-border animated input
   ══════════════════════════════════════════════ */

interface GhostInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GhostInput = React.forwardRef<HTMLInputElement, GhostInputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-muted-foreground">{label}</label>}
        <div className="relative group">
          <input
            ref={ref}
            className={cn(
              "w-full bg-surface-highest/50 border-b-2 border-white/10 rounded-t-md px-4 py-3 text-foreground placeholder:text-muted-foreground/50",
              "focus:outline-none focus:border-primary focus:bg-surface-highest transition-all duration-300",
              error && "border-destructive focus:border-destructive",
              className
            )}
            {...props}
          />
          <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary group-focus-within:w-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(129,236,255,0.8)]" />
        </div>
        {error && <span className="text-xs text-destructive mt-1">{error}</span>}
      </div>
    );
  }
);
GhostInput.displayName = "GhostInput";

/* ══════════════════════════════════════════════
   LuxuryInput — Gold-bordered premium input
   ══════════════════════════════════════════════ */

interface LuxuryInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const LuxuryInput = React.forwardRef<HTMLInputElement, LuxuryInputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col mb-4 group">
        {label && (
          <label className="label-luxury group-focus-within:text-[#f3e2ad] transition-colors">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "input-gold-border w-full py-3 px-4 rounded-lg text-sm placeholder:text-gray-600",
              error && "border-destructive",
              className
            )}
            {...props}
          />
          <div className="absolute inset-0 rounded-lg border border-[#d4af37]/0 group-hover:border-[#d4af37]/20 pointer-events-none transition-all duration-500" />
        </div>
        {error && <span className="text-xs text-destructive mt-1">{error}</span>}
      </div>
    );
  }
);
LuxuryInput.displayName = "LuxuryInput";

/* ══════════════════════════════════════════════
   GlassPanel — Simple glass container (used in game)
   ══════════════════════════════════════════════ */

export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-[#0a0a0c]/70 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl", className)}>
      {children}
    </div>
  );
}
