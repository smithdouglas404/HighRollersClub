import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useSoundEngine } from "@/lib/sound-context";
import { useGameUI } from "@/lib/game-ui-context";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
  pot?: number;
  /** Current game phase (preflop, flop, etc.) — used to reset pending state */
  phase?: string;
  /** Current turn seat index — used to reset pending state */
  currentTurnSeat?: number;
  /** Whether it's currently the hero's turn */
  isHeroTurn?: boolean;
  /** Buy extra time callback */
  onBuyTime?: () => void;
  /** Big blind amount for buy-time cost display */
  bigBlind?: number;
  /** Hero time remaining percentage (0-100) */
  heroTimeLeft?: number;
  /** Hero's status (folded, all-in, etc.) */
  heroStatus?: string;
}

export function PokerControls({ onAction, minBet, maxBet, pot = 0, phase, currentTurnSeat, isHeroTurn, onBuyTime, bigBlind, heroTimeLeft, heroStatus }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  // Sync betAmount when minBet increases (e.g. opponent raises)
  useEffect(() => {
    setBetAmount(prev => prev < minBet ? minBet : prev);
  }, [minBet]);
  const [isPending, setIsPending] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [autoFold, setAutoFold] = useState(false);
  const [autoCheckFold, setAutoCheckFold] = useState(false);
  const foldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useSoundEngine();
  let compactMode = false;
  try { compactMode = useGameUI().compactMode; } catch {}

  // Auto-fold: when hero's turn arrives and autoFold is checked, auto-fold immediately
  const autoFoldTriggeredRef = useRef(false);
  useEffect(() => {
    if (!isHeroTurn || isPending) return;
    if (autoFold) {
      autoFoldTriggeredRef.current = true;
      setAutoFold(false);
      setIsPending(true);
      sound.playFold();
      onAction("fold");
    } else if (autoCheckFold) {
      autoFoldTriggeredRef.current = true;
      setAutoCheckFold(false);
      if (minBet === 0) {
        setIsPending(true);
        sound.playCheck();
        onAction("check");
      } else {
        setIsPending(true);
        sound.playFold();
        onAction("fold");
      }
    }
  }, [isHeroTurn, autoFold, autoCheckFold, minBet, isPending, sound, onAction]);

  // Reset pending state when game state advances (server confirmed the action)
  useEffect(() => {
    setIsPending(false);
    setFoldConfirm(false);
  }, [phase, currentTurnSeat]);

  // Scale slider step with blind level
  const sliderStep = Math.max(1, Math.floor(minBet / 2)) || 1;

  const presets = [
    { label: "Min", value: minBet },
    { label: "2x", value: Math.min(minBet * 2, maxBet) },
    { label: "3x", value: Math.min(minBet * 3, maxBet) },
    { label: "Pot", value: Math.min(pot > 0 ? pot : minBet * 4, maxBet) },
    { label: "ALL IN", value: maxBet },
  ];

  const handlePreset = useCallback((value: number) => {
    setBetAmount(value);
  }, []);

  const handleFold = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    setFoldConfirm(false);
    sound.playFold();
    onAction("fold");
  }, [sound, onAction, isPending]);

  // Keyboard fold requires double-tap: first press shows confirm, second press folds
  const handleFoldKeyboard = useCallback(() => {
    if (isPending) return;
    if (foldConfirm) {
      handleFold();
    } else {
      setFoldConfirm(true);
      if (foldTimerRef.current) clearTimeout(foldTimerRef.current);
      foldTimerRef.current = setTimeout(() => setFoldConfirm(false), 2000);
    }
  }, [isPending, foldConfirm, handleFold]);

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

  // Keyboard shortcuts: F=fold (double-tap), C=check/call, R=raise, A=all-in
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPending) return;
      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "f":
          handleFoldKeyboard();
          break;
        case "c":
          if (minBet > 0) handleCall();
          else handleCheck();
          break;
        case "r":
          if (isAllIn) handleAllIn();
          else handleRaise();
          break;
        case "a":
          handleAllIn();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPending, minBet, isAllIn, handleFoldKeyboard, handleCall, handleCheck, handleRaise, handleAllIn]);

  // Clean up fold timer
  useEffect(() => {
    return () => { if (foldTimerRef.current) clearTimeout(foldTimerRef.current); };
  }, []);

  return (
    <motion.div
      initial={compactMode ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Gradient fade above controls */}
      <div className="h-8 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* YOUR TURN banner */}
      <AnimatePresence>
        {isHeroTurn && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-center mb-1"
          >
            <div
              className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{
                background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(0,255,157,0.1))",
                border: "1px solid rgba(0,240,255,0.3)",
                color: "#00f0ff",
                boxShadow: "0 0 20px rgba(0,240,255,0.15)",
                animation: compactMode ? "none" : "neonPulse 2s ease-in-out infinite",
              }}
            >
              Your Turn — Make Your Move
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="py-3 px-6 bg-black/70 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-3xl mx-auto space-y-2.5">

          {/* ─── Action Buttons Row ──────────────────────────── */}
          <div className="flex items-center gap-2.5 justify-center">
            {/* FOLD (F — double-tap to confirm) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={handleFold}
              disabled={isPending}
              title="Fold — Give up your hand and sit out this round"
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
                font-bold text-sm uppercase tracking-wider transition-all
                ${foldConfirm
                  ? "bg-red-700 text-white border-2 border-red-400 animate-pulse"
                  : "bg-red-600/80 text-white border border-red-500/30"
                }
                ${isPending ? "opacity-50 pointer-events-none" : "hover:bg-red-600/90"}
              `}
              style={{
                boxShadow: foldConfirm
                  ? "0 0 30px rgba(220,38,38,0.5), 0 0 12px rgba(220,38,38,0.3)"
                  : "0 0 20px rgba(220,38,38,0.25), 0 0 8px rgba(220,38,38,0.15)",
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {foldConfirm ? "CONFIRM?" : "FOLD"}
                <kbd className="text-[9px] font-mono opacity-50 bg-white/10 px-1 rounded">{foldConfirm ? "F F" : "F"}</kbd>
              </span>
            </motion.button>

            {/* CHECK / CALL (C) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={minBet > 0 ? handleCall : handleCheck}
              disabled={isPending}
              title={minBet > 0
                ? `Call — Match the current bet of $${minBet} to stay in the hand`
                : "Check — Stay in the hand without betting (no cost)"
              }
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
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
                <kbd className="text-[9px] font-mono opacity-50 bg-white/10 px-1 rounded">C</kbd>
              </span>
            </motion.button>

            {/* RAISE / ALL-IN (R) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={isAllIn ? handleAllIn : handleRaise}
              disabled={isPending}
              title={isAllIn
                ? "All-In — Bet all your remaining chips"
                : `Raise — Increase the bet to $${betAmount}`
              }
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
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
                <kbd className="text-[9px] font-mono opacity-50 bg-white/10 px-1 rounded">{isAllIn ? "A" : "R"}</kbd>
              </span>
            </motion.button>
            {/* BUY TIME button — visible when hero turn & time is low */}
            {onBuyTime && isHeroTurn && heroTimeLeft !== undefined && heroTimeLeft < 30 && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onBuyTime}
                className={`
                  relative overflow-hidden rounded-xl min-w-[80px] ${compactMode ? 'py-2 px-3' : 'py-3.5 px-4'}
                  font-bold text-[11px] uppercase tracking-wider transition-all
                  bg-amber-600/80 text-white border border-amber-500/40
                  hover:bg-amber-600/90
                `}
                style={{
                  boxShadow: "0 0 15px rgba(245,158,11,0.3), 0 0 6px rgba(245,158,11,0.15)",
                  animation: "neonPulse 1.5s ease-in-out infinite",
                }}
              >
                <span className="flex items-center justify-center gap-1">
                  +10s
                  {bigBlind && <span className="font-mono text-[9px] opacity-70">(${bigBlind})</span>}
                </span>
              </motion.button>
            )}
          </div>

          {/* ─── Bet Slider Row (compact, below buttons) ─────── */}
          <div className="flex items-center gap-2 px-1">
            {/* Presets */}
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.value)}
                  title={
                    p.label === "Min" ? "Minimum allowed bet" :
                    p.label === "Pot" ? `Bet the size of the pot ($${pot > 0 ? pot : '?'})` :
                    p.label === "ALL IN" ? "Bet all your chips" :
                    `Bet ${p.label} the minimum`
                  }
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
                value={[betAmount]}
                max={maxBet}
                min={minBet}
                step={sliderStep}
                onValueChange={(val) => setBetAmount(val[0])}
                className="flex-1"
              />
            </div>

            {/* Amount badge */}
            <div className="rounded-lg px-3 py-1 min-w-[70px] text-center bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-sm font-mono font-bold text-cyan-300">${betAmount}</span>
            </div>
          </div>

          {/* ─── Pre-action toggles (visible when not hero's turn) ── */}
          {!isHeroTurn && heroStatus !== "folded" && heroStatus !== "all-in" && (
            <div className="flex items-center gap-4 justify-center pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={autoFold}
                  onChange={(e) => { setAutoFold(e.target.checked); if (e.target.checked) setAutoCheckFold(false); }}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-white/5 accent-red-500"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                  Auto-Fold
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={autoCheckFold}
                  onChange={(e) => { setAutoCheckFold(e.target.checked); if (e.target.checked) setAutoFold(false); }}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-white/5 accent-emerald-500"
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                  Check/Fold
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
