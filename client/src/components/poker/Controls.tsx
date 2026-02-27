import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useSoundEngine } from "@/lib/sound-context";
import { useGameUI } from "@/lib/game-ui-context";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  /** Minimum raise total (used for slider min and presets) */
  minBet: number;
  maxBet: number;
  /** Amount hero needs to add to call (0 = can check) */
  callCost?: number;
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

export function PokerControls({ onAction, minBet, maxBet, callCost, pot = 0, phase, currentTurnSeat, isHeroTurn, onBuyTime, bigBlind, heroTimeLeft, heroStatus }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  // Sync betAmount when minBet increases (e.g. opponent raises)
  useEffect(() => {
    setBetAmount(prev => prev < minBet ? minBet : prev);
  }, [minBet]);
  const [isPending, setIsPending] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [autoFold, setAutoFold] = useState(false);
  const [autoCheckFold, setAutoCheckFold] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInputValue, setCustomInputValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  const foldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useSoundEngine();
  let compactMode = false;
  try { compactMode = useGameUI().compactMode; } catch {}

  const isPreFlop = phase === "pre-flop";
  const bb = bigBlind || 1;
  // callCost is the amount the hero needs to add to match the current bet (0 = can check)
  const needsToCall = (callCost ?? 0) > 0;
  const callAmount = callCost ?? 0;

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
      if (!needsToCall) {
        setIsPending(true);
        sound.playCheck();
        onAction("check");
      } else {
        setIsPending(true);
        sound.playFold();
        onAction("fold");
      }
    }
  }, [isHeroTurn, autoFold, autoCheckFold, needsToCall, isPending, sound, onAction]);

  // Reset pending state when game state advances (server confirmed the action)
  useEffect(() => {
    setIsPending(false);
    setFoldConfirm(false);
    setShowCustomInput(false);
    setBetAmount(minBet);
  }, [phase, currentTurnSeat, minBet]);

  // Scale slider step with blind level
  const sliderStep = Math.max(1, Math.floor(bb / 2)) || 1;

  // Pot-sized raise: pot + 2 * call amount (standard poker pot-raise formula)
  const potRaiseTotal = Math.min(Math.max(pot + callAmount * 2, minBet), maxBet);

  // Clamp helper: every preset must be at least minBet (min legal raise) and at most maxBet
  const clamp = (v: number) => Math.min(Math.max(Math.round(v), minBet), maxBet);

  // Context-aware presets: Pre-flop = BB multiples, Post-flop = pot percentages
  const presets = isPreFlop
    ? [
        { label: "2x", value: clamp(bb * 2), tooltip: "Min-raise (2x BB)" },
        { label: "2.5x", value: clamp(bb * 2.5), tooltip: "Standard open raise" },
        { label: "3x", value: clamp(bb * 3), tooltip: "Classic 3x BB raise" },
        { label: "Pot", value: potRaiseTotal, tooltip: "Pot-sized raise" },
        { label: "ALL IN", value: maxBet, tooltip: "Shove your entire stack" },
      ]
    : [
        { label: "33%", value: clamp(pot * 0.33), tooltip: "Small c-bet or thin value" },
        { label: "50%", value: clamp(pot * 0.5), tooltip: "Standard balanced sizing" },
        { label: "75%", value: clamp(pot * 0.75), tooltip: "Charge draws, build pot" },
        { label: "Pot", value: potRaiseTotal, tooltip: "Polarized: nuts or bluff" },
        { label: "ALL IN", value: maxBet, tooltip: "Shove your entire stack" },
      ];

  const handlePreset = useCallback((value: number) => {
    setBetAmount(value);
    setShowCustomInput(false);
  }, []);

  const handleCustomAmount = useCallback(() => {
    const val = parseInt(customInputValue, 10);
    if (!isNaN(val) && val >= minBet && val <= maxBet) {
      setBetAmount(val);
      setShowCustomInput(false);
    }
  }, [customInputValue, minBet, maxBet]);

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
    sound.playChipClink(); // Hero's chips going in
    onAction("call");
  }, [sound, onAction, isPending]);

  const handleRaise = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    sound.playChipClink(); // Hero's chips going in
    onAction("raise", betAmount);
  }, [sound, onAction, betAmount, isPending]);

  const handleAllIn = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    sound.playChipClink(); // Hero shoves all chips
    onAction("raise", maxBet);
  }, [sound, onAction, maxBet, isPending]);

  const isAllIn = betAmount >= maxBet;

  // Keyboard shortcuts: F=fold (double-tap), C=check/call, R=raise, A=all-in
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPending) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "f":
          handleFoldKeyboard();
          break;
        case "c":
          if (needsToCall) handleCall();
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
  }, [isPending, needsToCall, isAllIn, handleFoldKeyboard, handleCall, handleCheck, handleRaise, handleAllIn]);

  // Clean up fold timer
  useEffect(() => {
    return () => { if (foldTimerRef.current) clearTimeout(foldTimerRef.current); };
  }, []);

  // Focus custom input when opened
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
      setCustomInputValue(String(betAmount));
    }
  }, [showCustomInput, betAmount]);

  return (
    <motion.div
      initial={compactMode ? { y: 0, opacity: 1 } : { y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
      className="relative z-50"
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
              className="px-4 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-[0.2em]"
              style={{
                background: "linear-gradient(135deg, rgba(212,168,67,0.2), rgba(201,168,76,0.15))",
                border: "1px solid rgba(212,168,67,0.45)",
                color: "#d4a843",
                boxShadow: "0 0 30px rgba(212,168,67,0.25), 0 0 60px rgba(212,168,67,0.1)",
                animation: compactMode ? "none" : "neonPulse 1.5s ease-in-out infinite",
              }}
            >
              Your Turn — Make Your Move
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="py-3 px-6 bg-[#0d1525]/85 backdrop-blur-xl border-t border-white/15">
        <div className="max-w-3xl mx-auto space-y-2.5">

          {/* ─── Action Buttons Row ──────────────────────────── */}
          <div className="flex items-center gap-3 justify-center">
            {/* FOLD (F — double-tap to confirm) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={handleFold}
              disabled={isPending}
              title="Fold — Give up your hand and sit out this round (F)"
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
                font-bold text-sm uppercase tracking-wider transition-all focus-ring
                ${foldConfirm
                  ? "bg-red-700 text-white border-2 border-red-400 animate-pulse"
                  : "text-white border border-red-500/40"
                }
                ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
              `}
              style={{
                background: foldConfirm ? undefined : "linear-gradient(to bottom, #ef4444, #b91c1c)",
                boxShadow: foldConfirm
                  ? "0 0 30px rgba(220,38,38,0.5), 0 0 12px rgba(220,38,38,0.3)"
                  : "0 0 20px rgba(220,38,38,0.25)",
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {foldConfirm ? "CONFIRM?" : "FOLD"}
                <kbd className="text-[0.5625rem] font-mono opacity-50 bg-white/10 px-1 rounded">{foldConfirm ? "F F" : "F"}</kbd>
              </span>
            </motion.button>

            {/* CHECK / CALL (C) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={needsToCall ? handleCall : handleCheck}
              disabled={isPending}
              title={needsToCall
                ? `Call — Match the current bet of $${callAmount} to stay in the hand (C)`
                : "Check — Stay in the hand without betting (C)"
              }
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
                font-bold text-sm uppercase tracking-wider transition-all focus-ring
                text-white border border-emerald-500/40
                ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
              `}
              style={{
                background: "linear-gradient(to bottom, #10b981, #047857)",
                boxShadow: "0 0 20px rgba(5,150,105,0.25)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {needsToCall ? "CALL" : "CHECK"}
                {needsToCall && (
                  <span className="font-mono text-xs bg-white/15 px-2 py-0.5 rounded text-white">
                    ${callAmount.toLocaleString()}
                  </span>
                )}
                <kbd className="text-[0.5625rem] font-mono opacity-50 bg-white/10 px-1 rounded">C</kbd>
              </span>
            </motion.button>

            {/* RAISE / ALL-IN (R) */}
            <motion.button
              whileHover={isPending ? {} : { scale: 1.02, y: -1 }}
              whileTap={isPending ? {} : { scale: 0.97 }}
              onClick={isAllIn ? handleAllIn : handleRaise}
              disabled={isPending}
              title={isAllIn
                ? "All-In — Bet all your remaining chips (A)"
                : `Raise to $${betAmount.toLocaleString()} (R)`
              }
              className={`
                relative overflow-hidden rounded-xl min-w-[90px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-6'}
                font-bold text-sm uppercase tracking-wider transition-all focus-ring
                ${isAllIn
                  ? "text-amber-400 border border-amber-500/50"
                  : "text-white border border-amber-500/40"
                }
                ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
              `}
              style={{
                background: isAllIn
                  ? "linear-gradient(to bottom, #78350f, #451a03)"
                  : "linear-gradient(to bottom, #d4a843, #9c7c2e)",
                boxShadow: isAllIn
                  ? "0 0 20px rgba(245,158,11,0.25)"
                  : "0 0 20px rgba(212,168,67,0.25)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                {isAllIn ? "ALL-IN" : "RAISE"}
                <span className={`font-mono text-xs px-2 py-0.5 rounded ${isAllIn ? "bg-amber-500/15 text-amber-300" : "bg-white/15 text-white"}`}>
                  ${betAmount.toLocaleString()}
                </span>
                <kbd className="text-[0.5625rem] font-mono opacity-50 bg-white/10 px-1 rounded">{isAllIn ? "A" : "R"}</kbd>
              </span>
            </motion.button>

            {/* BUY TIME button — visible when hero turn & time is low */}
            {onBuyTime && isHeroTurn && heroTimeLeft !== undefined && heroTimeLeft < 30 && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onBuyTime}
                className={`
                  relative overflow-hidden rounded-xl min-w-[80px] ${compactMode ? 'py-2 px-4' : 'py-3.5 px-5'}
                  font-bold text-[0.6875rem] uppercase tracking-wider transition-all
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
                  {bigBlind && <span className="font-mono text-[0.5625rem] opacity-70">(${bigBlind})</span>}
                </span>
              </motion.button>
            )}
          </div>

          {/* ─── Bet Sizing Row: Presets + Slider + Custom Input ─────── */}
          <div className="flex items-center gap-2 px-1">
            {/* Context-aware presets */}
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.value)}
                  title={p.tooltip}
                  className={`
                    px-2.5 py-1 rounded text-[0.625rem] font-bold uppercase tracking-wider transition-all
                    ${betAmount === p.value
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                      : "bg-white/[0.05] text-gray-500 border border-white/10 hover:bg-white/[0.08] hover:text-gray-300"
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
                onValueChange={(val) => { setBetAmount(val[0]); setShowCustomInput(false); }}
                className="flex-1"
              />
            </div>

            {/* Amount badge — click to type custom amount */}
            <div className="relative">
              {showCustomInput ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-amber-400">$</span>
                  <input
                    ref={customInputRef}
                    type="number"
                    value={customInputValue}
                    onChange={(e) => setCustomInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomAmount();
                      if (e.key === "Escape") setShowCustomInput(false);
                    }}
                    onBlur={handleCustomAmount}
                    min={minBet}
                    max={maxBet}
                    className="w-20 rounded-lg px-2 py-1 text-sm font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 outline-none focus:border-amber-400/60"
                    style={{ appearance: "textfield" }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="rounded-lg px-3 py-1 min-w-[70px] text-center bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors cursor-text"
                  title="Click to type a custom amount"
                >
                  <span className="text-sm font-mono font-bold text-amber-300">${betAmount.toLocaleString()}</span>
                </button>
              )}
            </div>
          </div>

          {/* Phase context hint */}
          <div className="flex items-center justify-center gap-2 text-[0.5625rem] text-gray-600">
            <span className="uppercase tracking-wider font-bold">
              {isPreFlop ? "Pre-Flop: BB Multiples" : "Post-Flop: Pot %"}
            </span>
            <span>|</span>
            <span>Pot: <span className="text-gray-400 font-mono">${pot.toLocaleString()}</span></span>
            {bigBlind && <><span>|</span><span>BB: <span className="text-gray-400 font-mono">${bigBlind}</span></span></>}
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
                <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
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
                <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
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
