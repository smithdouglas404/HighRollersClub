import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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
  /** Hero cards slot — rendered left of action buttons */
  heroCardsSlot?: ReactNode;
  /** Hand badge slot — rendered after hero cards */
  handBadgeSlot?: ReactNode;
}

export function PokerControls({ onAction, minBet, maxBet, callCost, pot = 0, phase, currentTurnSeat, isHeroTurn, onBuyTime, bigBlind, heroTimeLeft, heroStatus, heroCardsSlot, handBadgeSlot }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
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
    setShowRaiseSlider(false);
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
      ]
    : [
        { label: "33%", value: clamp(pot * 0.33), tooltip: "Small c-bet or thin value" },
        { label: "50%", value: clamp(pot * 0.5), tooltip: "Standard balanced sizing" },
        { label: "75%", value: clamp(pot * 0.75), tooltip: "Charge draws, build pot" },
        { label: "Pot", value: potRaiseTotal, tooltip: "Polarized: nuts or bluff" },
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
          if (!showRaiseSlider) { setShowRaiseSlider(true); break; }
          if (isAllIn) handleAllIn();
          else handleRaise();
          break;
        case "a":
          handleAllIn();
          break;
        case "escape":
          setShowRaiseSlider(false);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPending, needsToCall, isAllIn, showRaiseSlider, handleFoldKeyboard, handleCall, handleCheck, handleRaise, handleAllIn]);

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
      initial={compactMode ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
      className="relative z-50"
    >
      {/* Gradient fade above controls */}
      <div className="h-6 bg-gradient-to-t from-[#0d1525]/90 to-transparent pointer-events-none" />

      <div className="py-2 px-4 bg-[#0d1525]/90 backdrop-blur-xl border-t border-white/10">
        {/* ═══ UNIFIED BOTTOM PANEL: Hero Cards + Actions ═══ */}
        <div className="max-w-5xl mx-auto">

          {/* Main row: Hero cards | Action buttons | Raise amount */}
          <div className="flex items-center gap-4">

            {/* Hero cards slot (left side) */}
            {heroCardsSlot && (
              <div className="flex items-center gap-2 shrink-0">
                {heroCardsSlot}
                {handBadgeSlot}
              </div>
            )}

            {/* Action buttons (center) */}
            <div className="flex items-center gap-2 flex-1 justify-center">
              {/* FOLD */}
              <motion.button
                whileHover={isPending ? {} : { scale: 1.03 }}
                whileTap={isPending ? {} : { scale: 0.96 }}
                onClick={handleFold}
                disabled={isPending}
                title="Fold (F)"
                className={`
                  relative overflow-hidden rounded-xl py-2.5 px-5 min-w-[80px]
                  font-bold text-sm uppercase tracking-wider transition-all
                  ${foldConfirm
                    ? "bg-red-700 text-white border-2 border-red-400 animate-pulse"
                    : "text-white border border-red-500/40"
                  }
                  ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
                `}
                style={{
                  background: foldConfirm ? undefined : "linear-gradient(to bottom, #ef4444, #b91c1c)",
                  boxShadow: foldConfirm
                    ? "0 0 30px rgba(220,38,38,0.5)"
                    : "0 0 12px rgba(220,38,38,0.2)",
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {foldConfirm ? "CONFIRM?" : "FOLD"}
                  <kbd className="text-[0.5rem] font-mono opacity-40 bg-white/10 px-1 rounded">F</kbd>
                </span>
              </motion.button>

              {/* CHECK / CALL */}
              <motion.button
                whileHover={isPending ? {} : { scale: 1.03 }}
                whileTap={isPending ? {} : { scale: 0.96 }}
                onClick={needsToCall ? handleCall : handleCheck}
                disabled={isPending}
                title={needsToCall ? `Call $${callAmount} (C)` : "Check (C)"}
                className={`
                  relative overflow-hidden rounded-xl py-2.5 px-5 min-w-[80px]
                  font-bold text-sm uppercase tracking-wider transition-all
                  text-white border border-emerald-500/40
                  ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
                `}
                style={{
                  background: "linear-gradient(to bottom, #10b981, #047857)",
                  boxShadow: "0 0 12px rgba(5,150,105,0.2)",
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {needsToCall ? "CALL" : "CHECK"}
                  {needsToCall && (
                    <span className="font-mono text-xs bg-white/15 px-1.5 py-0.5 rounded">
                      ${callAmount.toLocaleString()}
                    </span>
                  )}
                  <kbd className="text-[0.5rem] font-mono opacity-40 bg-white/10 px-1 rounded">C</kbd>
                </span>
              </motion.button>

              {/* RAISE — click to open sizing, or direct action */}
              <motion.button
                whileHover={isPending ? {} : { scale: 1.03 }}
                whileTap={isPending ? {} : { scale: 0.96 }}
                onClick={() => {
                  if (isPending) return;
                  if (!showRaiseSlider) {
                    setShowRaiseSlider(true);
                  } else if (isAllIn) {
                    handleAllIn();
                  } else {
                    handleRaise();
                  }
                }}
                disabled={isPending}
                title={showRaiseSlider ? `Raise to $${betAmount.toLocaleString()} (R)` : "Open raise sizing (R)"}
                className={`
                  relative overflow-hidden rounded-xl py-2.5 px-5 min-w-[80px]
                  font-bold text-sm uppercase tracking-wider transition-all
                  ${isAllIn && showRaiseSlider
                    ? "text-cyan-400 border border-cyan-500/50"
                    : showRaiseSlider
                    ? "text-white border border-cyan-400/60"
                    : "text-white border border-cyan-500/40"
                  }
                  ${isPending ? "opacity-50 pointer-events-none" : "hover:brightness-110"}
                `}
                style={{
                  background: isAllIn && showRaiseSlider
                    ? "linear-gradient(to bottom, #78350f, #451a03)"
                    : "linear-gradient(to bottom, #00d4ff, #009ec2)",
                  boxShadow: showRaiseSlider
                    ? "0 0 16px rgba(0,212,255,0.35)"
                    : "0 0 12px rgba(0,212,255,0.2)",
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {isAllIn && showRaiseSlider ? "ALL-IN" : showRaiseSlider ? "RAISE" : "RAISE"}
                  {showRaiseSlider && (
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${isAllIn ? "bg-cyan-500/15 text-cyan-300" : "bg-white/15 text-white"}`}>
                      ${betAmount.toLocaleString()}
                    </span>
                  )}
                  <kbd className="text-[0.5rem] font-mono opacity-40 bg-white/10 px-1 rounded">R</kbd>
                </span>
              </motion.button>

              {/* BUY TIME button */}
              {onBuyTime && isHeroTurn && heroTimeLeft !== undefined && heroTimeLeft < 30 && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onBuyTime}
                  className="relative overflow-hidden rounded-xl py-2.5 px-4
                    font-bold text-[0.6875rem] uppercase tracking-wider
                    bg-amber-600/80 text-white border border-amber-500/40 hover:bg-amber-600/90"
                  style={{
                    boxShadow: "0 0 12px rgba(245,158,11,0.25)",
                  }}
                >
                  +10s
                  {bigBlind && <span className="font-mono text-[0.5rem] opacity-70 ml-1">(${bigBlind})</span>}
                </motion.button>
              )}
            </div>

            {/* Pot / info badge (right side) */}
            <div className="shrink-0 flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5 text-[0.625rem] text-gray-500">
                <span className="uppercase tracking-wider font-bold">
                  {isPreFlop ? "Pre-Flop" : "Post-Flop"}
                </span>
                <span className="text-gray-600">|</span>
                <span>Pot <span className="font-mono font-bold" style={{ color: "rgba(255,215,0,0.8)" }}>${pot.toLocaleString()}</span></span>
              </div>
              {/* Pre-action toggles (inline when not hero's turn) */}
              {!isHeroTurn && heroStatus !== "folded" && heroStatus !== "all-in" && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={autoFold}
                      onChange={(e) => { setAutoFold(e.target.checked); if (e.target.checked) setAutoCheckFold(false); }}
                      className="w-3 h-3 rounded border-gray-600 bg-white/5 accent-red-500"
                    />
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                      Auto-Fold
                    </span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={autoCheckFold}
                      onChange={(e) => { setAutoCheckFold(e.target.checked); if (e.target.checked) setAutoFold(false); }}
                      className="w-3 h-3 rounded border-gray-600 bg-white/5 accent-emerald-500"
                    />
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                      Check/Fold
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ─── Raise Sizing Panel (slides open when RAISE is clicked) ─── */}
          <AnimatePresence>
            {showRaiseSlider && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 pt-2 pb-1 px-1">
                  {/* Context-aware presets */}
                  <div className="flex gap-1">
                    {presets.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => handlePreset(p.value)}
                        title={p.tooltip}
                        className={`
                          px-2 py-1 rounded text-[0.625rem] font-bold uppercase tracking-wider transition-all
                          ${betAmount === p.value
                            ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
                            : "bg-white/[0.05] text-gray-500 border border-white/10 hover:bg-white/[0.08] hover:text-gray-300"
                          }
                        `}
                      >
                        {p.label}
                      </button>
                    ))}
                    {/* ALL IN preset */}
                    <button
                      onClick={() => handlePreset(maxBet)}
                      title="Shove your entire stack"
                      className={`
                        px-2 py-1 rounded text-[0.625rem] font-bold uppercase tracking-wider transition-all
                        ${betAmount === maxBet
                          ? "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                          : "bg-white/[0.05] text-gray-500 border border-white/10 hover:bg-white/[0.08] hover:text-gray-300"
                        }
                      `}
                    >
                      ALL IN
                    </button>
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
                        <span className="text-sm font-mono text-cyan-400">$</span>
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
                          className="w-20 rounded-lg px-2 py-1 text-sm font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 outline-none focus:border-cyan-400/60"
                          style={{ appearance: "textfield" }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCustomInput(true)}
                        className="rounded-lg px-3 py-1 min-w-[70px] text-center bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors cursor-text"
                        title="Click to type a custom amount"
                      >
                        <span className="text-sm font-mono font-bold text-cyan-300">${betAmount.toLocaleString()}</span>
                      </button>
                    )}
                  </div>

                  {/* Close raise panel */}
                  <button
                    onClick={() => setShowRaiseSlider(false)}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Close (Esc)"
                  >
                    <span className="text-xs font-bold">&times;</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
