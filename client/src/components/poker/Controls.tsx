import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useSoundEngine } from "@/lib/sound-context";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
  /** Current game phase (preflop, flop, etc.) — used to reset pending state */
  phase?: string;
  /** Current turn seat index — used to reset pending state */
  currentTurnSeat?: number;
}

export function PokerControls({ onAction, minBet, maxBet, phase, currentTurnSeat }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  const [isPending, setIsPending] = useState(false);
  const sound = useSoundEngine();

  // Reset pending state when game state advances (server confirmed the action)
  useEffect(() => {
    setIsPending(false);
  }, [phase, currentTurnSeat]);

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
    if (isPending) return;
    setIsPending(true);
    sound.playFold();
    onAction("fold");
  }, [sound, onAction, isPending]);

  const handleCheck = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playCheck();
    onAction("check");
  }, [sound, onAction, isPending]);

  const handleCall = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playCall();
    onAction("call");
  }, [sound, onAction, isPending]);

  const handleRaise = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    onAction("raise", betAmount);
  }, [sound, onAction, betAmount, isPending]);

  const handleAllIn = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    onAction("raise", maxBet);
  }, [sound, onAction, maxBet, isPending]);

  const isAllIn = betAmount >= maxBet;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Gradient fade above controls */}
      <div className="h-8 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      <div className="py-3 px-6 bg-black/70 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-3xl mx-auto space-y-2.5">

          {/* ─── Action Buttons Row ──────────────────────────── */}
          <div className="flex items-center gap-2.5 justify-center">
            {/* FOLD */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={handleFold}
              disabled={isPending}
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] py-3.5 px-6
                font-bold text-sm uppercase tracking-wider transition-all
                bg-red-600/80 text-white border border-red-500/30
                ${isPending ? "opacity-50 pointer-events-none" : "hover:bg-red-600/90"}
              `}
              style={{
                boxShadow: "0 0 20px rgba(220,38,38,0.25), 0 0 8px rgba(220,38,38,0.15)",
              }}
            >
              FOLD
            </motion.button>

            {/* CHECK / CALL */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={minBet > 0 ? handleCall : handleCheck}
              disabled={isPending}
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] py-3.5 px-6
                font-bold text-sm uppercase tracking-wider transition-all
                bg-emerald-600/80 text-white border border-emerald-500/30
                ${isPending ? "opacity-50 pointer-events-none" : "hover:bg-emerald-600/90"}
              `}
              style={{
                boxShadow: "0 0 20px rgba(5,150,105,0.25), 0 0 8px rgba(5,150,105,0.15)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {minBet > 0 ? "CALL" : "CHECK"}
                {minBet > 0 && (
                  <span className="font-mono text-xs bg-white/15 px-2 py-0.5 rounded text-white">
                    ${minBet}
                  </span>
                )}
              </span>
            </motion.button>

            {/* RAISE (becomes ALL-IN text when slider is at max) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={isAllIn ? handleAllIn : handleRaise}
              disabled={isPending}
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] py-3.5 px-6
                font-bold text-sm uppercase tracking-wider transition-all
                ${isAllIn
                  ? "bg-gray-800/90 text-amber-400 border border-amber-500/40"
                  : "bg-cyan-600/80 text-white border border-cyan-500/30"
                }
                ${isPending ? "opacity-50 pointer-events-none" : isAllIn ? "hover:bg-gray-800" : "hover:bg-cyan-600/90"}
              `}
              style={{
                boxShadow: isAllIn
                  ? "0 0 20px rgba(245,158,11,0.2), 0 0 8px rgba(245,158,11,0.1)"
                  : "0 0 20px rgba(8,145,178,0.25), 0 0 8px rgba(8,145,178,0.15)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {isAllIn ? "ALL-IN" : "RAISE"}
                <span className={`font-mono text-xs px-2 py-0.5 rounded ${isAllIn ? "bg-amber-500/15 text-amber-300" : "bg-white/15 text-white"}`}>
                  ${betAmount}
                </span>
              </span>
            </motion.button>

            {/* ALL-IN (always-visible dedicated button) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={handleAllIn}
              disabled={isPending}
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] py-3.5 px-6
                font-bold text-sm uppercase tracking-wider transition-all
                bg-gray-800/90 text-amber-400 border border-amber-500/40
                ${isPending ? "opacity-50 pointer-events-none" : "hover:bg-gray-700/90"}
              `}
              style={{
                boxShadow: "0 0 20px rgba(245,158,11,0.2), 0 0 8px rgba(245,158,11,0.1)",
              }}
            >
              ALL-IN
            </motion.button>
          </div>

          {/* ─── Bet Slider Row (compact, below buttons) ─────── */}
          <div className="flex items-center gap-2 px-1">
            {/* Presets */}
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.value)}
                  className={`
                    px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all
                    ${betAmount === p.value
                      ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
                      : "bg-white/[0.05] text-gray-500 border border-white/[0.06] hover:bg-white/[0.08] hover:text-gray-300"
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
            <div className="rounded-lg px-3 py-1 min-w-[70px] text-center bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-sm font-mono font-bold text-cyan-300">${betAmount}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
