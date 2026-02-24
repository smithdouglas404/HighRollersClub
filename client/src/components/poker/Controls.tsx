import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useSoundEngine } from "@/lib/sound-context";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
}

export function PokerControls({ onAction, minBet, maxBet }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  const sound = useSoundEngine();

  const presets = [
    { label: "Min", value: minBet },
    { label: "2x", value: Math.min(minBet * 2, maxBet) },
    { label: "3x", value: Math.min(minBet * 3, maxBet) },
    { label: "Pot", value: Math.min(minBet * 4, maxBet) },
    { label: "ALL IN", value: maxBet },
  ];

  const handlePreset = useCallback((value: number) => {
    setBetAmount(value);
  }, []);

  const handleFold = useCallback(() => {
    sound.playFold();
    onAction("fold");
  }, [sound, onAction]);

  const handleCheck = useCallback(() => {
    sound.playCheck();
    onAction("check");
  }, [sound, onAction]);

  const handleCall = useCallback(() => {
    sound.playCall();
    onAction("call");
  }, [sound, onAction]);

  const handleRaise = useCallback(() => {
    sound.playRaise();
    onAction("raise", betAmount);
  }, [sound, onAction, betAmount]);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Gradient fade */}
      <div className="h-12 bg-gradient-to-t from-[#030508] to-transparent pointer-events-none" />

      <div
        className="pb-5 pt-2 px-4"
        style={{
          background: "linear-gradient(180deg, rgba(3,5,8,0.95) 0%, rgba(3,5,8,0.99) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="max-w-3xl mx-auto space-y-2.5">

          {/* ─── Bet Slider Row ──────────────────────────────── */}
          <div className="flex items-center gap-2 px-1">
            {/* Presets */}
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.value)}
                  className={`
                    px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all
                    ${betAmount === p.value
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-white/[0.03] text-gray-600 border border-white/[0.04] hover:bg-white/[0.06] hover:text-gray-400"
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

            {/* Amount badge */}
            <div
              className="rounded-lg px-3 py-1.5 min-w-[65px] text-center"
              style={{
                background: "rgba(0,240,255,0.06)",
                border: "1px solid rgba(0,240,255,0.15)",
                boxShadow: "0 0 12px rgba(0,240,255,0.06)",
              }}
            >
              <span className="text-sm font-mono font-bold text-cyan-300">{betAmount}</span>
            </div>
          </div>

          {/* ─── Action Buttons ──────────────────────────────── */}
          <div className="flex items-center gap-2 justify-center">
            {/* FOLD */}
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFold}
              className="relative overflow-hidden rounded-xl px-7 py-3 min-w-[100px] font-bold text-sm uppercase tracking-wider transition-all backdrop-blur-md"
              style={{
                background: "linear-gradient(180deg, rgba(180,30,50,0.25) 0%, rgba(120,20,30,0.15) 100%)",
                border: "1px solid rgba(255,60,80,0.2)",
                color: "#ff6b7a",
                boxShadow: "0 0 20px rgba(255,51,102,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              FOLD
            </motion.button>

            {/* CHECK / CALL */}
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={minBet > 0 ? handleCall : handleCheck}
              className="relative overflow-hidden rounded-xl px-7 py-3 min-w-[160px] font-bold text-sm uppercase tracking-wider transition-all backdrop-blur-md"
              style={{
                background: "linear-gradient(180deg, rgba(0,200,120,0.2) 0%, rgba(0,140,80,0.1) 100%)",
                border: "1px solid rgba(0,255,157,0.2)",
                color: "#4ade80",
                boxShadow: "0 0 20px rgba(0,255,157,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {minBet > 0 ? "CHECK/CALL" : "CHECK"}
                {minBet > 0 && (
                  <span
                    className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "rgba(0,255,157,0.1)",
                      color: "#6ee7b7",
                    }}
                  >
                    {minBet}
                  </span>
                )}
              </span>
            </motion.button>

            {/* RAISE */}
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRaise}
              className="relative overflow-hidden rounded-xl px-7 py-3 min-w-[130px] font-bold text-sm uppercase tracking-wider transition-all backdrop-blur-md"
              style={{
                background: "linear-gradient(180deg, rgba(0,180,240,0.2) 0%, rgba(0,100,200,0.1) 100%)",
                border: "1px solid rgba(0,240,255,0.25)",
                color: "#67e8f9",
                boxShadow: "0 0 20px rgba(0,240,255,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                RAISE
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(0,240,255,0.1)",
                    color: "#a5f3fc",
                  }}
                >
                  {betAmount}
                </span>
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
