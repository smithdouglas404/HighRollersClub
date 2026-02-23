import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
}

function ActionButton({
  label,
  subLabel,
  variant,
  onClick,
}: {
  label: string;
  subLabel?: string;
  variant: "fold" | "check" | "call" | "raise";
  onClick: () => void;
}) {
  const styles: Record<string, { bg: string; border: string; text: string; glow: string; hoverBg: string }> = {
    fold: {
      bg: "from-red-950/80 to-red-900/40",
      border: "border-red-500/30",
      text: "text-red-400",
      glow: "rgba(255,51,102,0.15)",
      hoverBg: "rgba(255,51,102,0.1)",
    },
    check: {
      bg: "from-gray-800/80 to-gray-900/40",
      border: "border-gray-500/30",
      text: "text-gray-300",
      glow: "rgba(200,200,200,0.1)",
      hoverBg: "rgba(200,200,200,0.05)",
    },
    call: {
      bg: "from-emerald-950/80 to-emerald-900/40",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      glow: "rgba(0,255,157,0.15)",
      hoverBg: "rgba(0,255,157,0.1)",
    },
    raise: {
      bg: "from-cyan-950/80 to-blue-900/40",
      border: "border-cyan-500/40",
      text: "text-cyan-300",
      glow: "rgba(0,240,255,0.2)",
      hoverBg: "rgba(0,240,255,0.1)",
    },
  };

  const s = styles[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl px-6 py-3 min-w-[110px]
        bg-gradient-to-b ${s.bg}
        border ${s.border}
        ${s.text}
        font-bold text-sm uppercase tracking-wider
        transition-all duration-200
        backdrop-blur-md
        btn-neon
      `}
      style={{
        boxShadow: `0 0 20px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Hover fill effect */}
      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{ background: s.hoverBg }}
      />
      <div className="relative z-10 flex flex-col items-center">
        <span>{label}</span>
        {subLabel && (
          <span className="text-[10px] font-mono opacity-70 mt-0.5">{subLabel}</span>
        )}
      </div>
    </motion.button>
  );
}

export function PokerControls({ onAction, minBet, maxBet }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);

  const presets = [
    { label: "Min", value: minBet },
    { label: "2x", value: Math.min(minBet * 2, maxBet) },
    { label: "3x", value: Math.min(minBet * 3, maxBet) },
    { label: "Pot", value: Math.min(minBet * 4, maxBet) },
    { label: "All In", value: maxBet },
  ];

  const handlePreset = useCallback((value: number) => {
    setBetAmount(value);
  }, []);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Gradient fade above controls */}
      <div className="h-16 bg-gradient-to-t from-[#050810] to-transparent pointer-events-none" />

      <div className="bg-[#050810]/95 backdrop-blur-xl border-t border-white/5 pb-6 pt-3 px-4">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* Bet slider section */}
          <div className="flex items-center gap-3 px-2">
            {/* Preset buttons */}
            <div className="flex gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.value)}
                  className={`
                    px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200
                    ${betAmount === p.value
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-gray-300"
                    }
                  `}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="flex-1 px-2">
              <Slider
                defaultValue={[minBet]}
                value={[betAmount]}
                max={maxBet}
                min={minBet}
                step={10}
                onValueChange={(val) => setBetAmount(val[0])}
                className="flex-1"
              />
            </div>

            {/* Amount display */}
            <div className="glass rounded-lg px-3 py-1.5 min-w-[70px] text-center neon-border-cyan">
              <span className="text-sm font-mono font-bold neon-text-cyan">{betAmount}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <ActionButton label="Fold" variant="fold" onClick={() => onAction("fold")} />
            <ActionButton label="Check" variant="check" onClick={() => onAction("check")} />
            <ActionButton label="Call" subLabel={`${minBet}`} variant="call" onClick={() => onAction("call")} />
            <ActionButton
              label="Raise"
              subLabel={`${betAmount}`}
              variant="raise"
              onClick={() => onAction("raise", betAmount)}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
