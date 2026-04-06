import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSoundEngine } from "@/lib/sound-context";
import { useGameUI } from "@/lib/game-ui-context";

interface ControlsProps {
  onAction: (action: string, amount?: number) => void;
  minBet: number;
  maxBet: number;
  callCost?: number;
  pot?: number;
  phase?: string;
  currentTurnSeat?: number;
  isHeroTurn?: boolean;
  onBuyTime?: () => void;
  bigBlind?: number;
  heroTimeLeft?: number;
  heroStatus?: string;
  heroCardsSlot?: ReactNode;
  handBadgeSlot?: ReactNode;
}

export function PokerControls({ onAction, minBet, maxBet, callCost, pot = 0, phase, currentTurnSeat, isHeroTurn, onBuyTime, bigBlind, heroTimeLeft, heroStatus, heroCardsSlot, handBadgeSlot }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  useEffect(() => {
    setBetAmount(prev => prev < minBet ? minBet : prev);
  }, [minBet]);
  const [isPending, setIsPending] = useState(false);
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [kbFlash, setKbFlash] = useState<string | null>(null);
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
  const needsToCall = (callCost ?? 0) > 0;
  const callAmount = callCost ?? 0;
  const buttonsDisabled = isPending || !isHeroTurn;

  // Auto-fold/check logic
  const autoFoldTriggeredRef = useRef(false);
  useEffect(() => {
    if (!isHeroTurn || isPending) return;
    if (autoFold) {
      autoFoldTriggeredRef.current = true;
      setAutoFold(false);
      setIsPending(true);
      sound.playFold();
      sound.stopBgm();
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
        sound.stopBgm();
        onAction("fold");
      }
    }
  }, [isHeroTurn, autoFold, autoCheckFold, needsToCall, isPending, sound, onAction]);

  useEffect(() => {
    setIsPending(false);
    setFoldConfirm(false);
    setShowCustomInput(false);
    setBetAmount(minBet);
  }, [phase, currentTurnSeat, minBet]);

  const sliderStep = Math.max(1, Math.floor(bb)) || 1;
  const potRaiseTotal = Math.min(Math.max(pot + callAmount * 2, minBet), maxBet);
  const clamp = (v: number) => Math.min(Math.max(Math.round(v), minBet), maxBet);

  const presets = isPreFlop
    ? [
        { label: "2x", value: clamp(bb * 2), tooltip: "Min-raise" },
        { label: "2.5x", value: clamp(bb * 2.5), tooltip: "Standard open" },
        { label: "3x", value: clamp(bb * 3), tooltip: "3x BB raise" },
        { label: "POT", value: potRaiseTotal, tooltip: "Pot-sized" },
      ]
    : [
        { label: "⅓", value: clamp(pot * 0.33), tooltip: "33% pot" },
        { label: "½", value: clamp(pot * 0.5), tooltip: "50% pot" },
        { label: "¾", value: clamp(pot * 0.75), tooltip: "75% pot" },
        { label: "POT", value: potRaiseTotal, tooltip: "Full pot" },
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
    sound.stopBgm();
    onAction("fold");
  }, [sound, onAction, isPending]);

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
    sound.playChipSlide();
    onAction("call");
  }, [sound, onAction, isPending]);

  const handleRaise = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    sound.playChipSlide();
    onAction("raise", betAmount);
  }, [sound, onAction, betAmount, isPending]);

  const handleAllIn = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    sound.playRaise();
    sound.playChipSlide();
    onAction("raise", maxBet);
  }, [sound, onAction, maxBet, isPending]);

  const isAllIn = betAmount >= maxBet;

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPending || !isHeroTurn) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "f":
          setKbFlash("fold"); setTimeout(() => setKbFlash(null), 150);
          handleFoldKeyboard();
          break;
        case "c":
          setKbFlash("call"); setTimeout(() => setKbFlash(null), 150);
          if (needsToCall) handleCall();
          else handleCheck();
          break;
        case "r":
          setKbFlash("raise"); setTimeout(() => setKbFlash(null), 150);
          if (isAllIn) handleAllIn();
          else handleRaise();
          break;
        case "a":
          setKbFlash("raise"); setTimeout(() => setKbFlash(null), 150);
          handleAllIn();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPending, needsToCall, isAllIn, handleFoldKeyboard, handleCall, handleCheck, handleRaise, handleAllIn]);

  useEffect(() => {
    return () => { if (foldTimerRef.current) clearTimeout(foldTimerRef.current); };
  }, []);

  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
      setCustomInputValue(String(betAmount));
    }
  }, [showCustomInput, betAmount]);

  const stepDown = () => setBetAmount(prev => Math.max(minBet, prev - sliderStep));
  const stepUp = () => setBetAmount(prev => Math.min(maxBet, prev + sliderStep));

  const timerPct = heroTimeLeft ?? 100;
  const timerColor = timerPct > 50 ? "#d4af37" : timerPct > 25 ? "#f59e0b" : "#ef4444";
  const timerUrgent = timerPct <= 25;

  // Slider percentage for visual fill
  const sliderPct = maxBet > minBet ? ((betAmount - minBet) / (maxBet - minBet)) * 100 : 0;

  // Pot odds display
  const potOdds = needsToCall && pot > 0 ? Math.round((callAmount / (pot + callAmount)) * 100) : 0;

  return (
    <motion.div
      initial={compactMode ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
      className="relative z-[60]"
      data-testid="poker-controls"
    >
      {/* Timer bar — full width, pulsing when urgent */}
      {isHeroTurn && (
        <div className="h-[3px] w-full overflow-hidden" style={{ background: "rgba(0,0,0,0.7)" }}>
          <motion.div
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}dd)`,
              boxShadow: `0 0 12px ${timerColor}`,
            }}
            initial={{ width: "100%" }}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>
      )}

      {/* Gradient mask from table into controls */}
      <div className="h-5 bg-gradient-to-t from-[rgba(12,12,16,0.98)] to-transparent pointer-events-none" />

      {/* Main controls — dark glass panel */}
      <div
        className="px-4 pb-4 pt-2 border-t border-white/[0.04]"
        style={{
          background: "linear-gradient(180deg, rgba(12,12,16,0.97) 0%, rgba(8,8,12,0.99) 100%)",
          backdropFilter: "blur(40px)",
        }}
      >
        <div className="max-w-6xl mx-auto">

          {/* === TOP ROW: Hero cards + Bet sizing + Amount === */}
          <div className="flex items-center gap-4 mb-3">

            {/* Hero cards */}
            {heroCardsSlot && (
              <div className="flex items-center gap-2 shrink-0">
                {heroCardsSlot}
                {handBadgeSlot}
              </div>
            )}

            {/* Bet sizing area */}
            <div className={`flex-1 flex items-center gap-2 transition-opacity duration-200 ${!isHeroTurn ? "opacity-25 pointer-events-none" : ""}`}>

              {/* Preset chips — pill buttons */}
              <div className="flex gap-1.5">
                {presets.map((p) => {
                  const isActive = betAmount === p.value;
                  return (
                    <motion.button
                      key={p.label}
                      whileHover={{ scale: 1.08, y: -2 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handlePreset(p.value)}
                      title={`${p.tooltip} ($${p.value.toLocaleString()})`}
                      className="relative overflow-hidden rounded-full font-black uppercase transition-all"
                      style={{
                        padding: "0.45rem 0.85rem",
                        fontSize: "0.8rem",
                        letterSpacing: "0.05em",
                        color: isActive ? "#1a1a1a" : "rgba(212,175,55,0.8)",
                        background: isActive
                          ? "linear-gradient(180deg, #f5d76e 0%, #d4af37 50%, #b8941f 100%)"
                          : "rgba(212,175,55,0.08)",
                        border: isActive ? "1.5px solid #f5d76e" : "1.5px solid rgba(212,175,55,0.2)",
                        boxShadow: isActive
                          ? "0 4px 20px rgba(212,175,55,0.4), 0 0 8px rgba(212,175,55,0.2)"
                          : "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      {p.label}
                    </motion.button>
                  );
                })}

                {/* ALL IN pill */}
                <motion.button
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handlePreset(maxBet)}
                  title={`All-In ($${maxBet.toLocaleString()})`}
                  className="relative overflow-hidden rounded-full font-black uppercase transition-all"
                  style={{
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.8rem",
                    letterSpacing: "0.05em",
                    color: betAmount === maxBet ? "#1a1a1a" : "rgba(239,68,68,0.8)",
                    background: betAmount === maxBet
                      ? "linear-gradient(180deg, #f87171 0%, #ef4444 50%, #dc2626 100%)"
                      : "rgba(239,68,68,0.08)",
                    border: betAmount === maxBet ? "1.5px solid #f87171" : "1.5px solid rgba(239,68,68,0.2)",
                    boxShadow: betAmount === maxBet
                      ? "0 4px 20px rgba(239,68,68,0.3), 0 0 8px rgba(239,68,68,0.15)"
                      : "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  ALL IN
                </motion.button>
              </div>

              {/* Slider track */}
              <div className="flex-1 relative h-10 flex items-center mx-2">
                {/* Track background */}
                <div className="absolute inset-x-0 h-2.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Fill */}
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${sliderPct}%`,
                      background: sliderPct > 90
                        ? "linear-gradient(90deg, #d4af37, #ef4444)"
                        : "linear-gradient(90deg, #d4af37, #f5d76e)",
                      boxShadow: `0 0 10px rgba(212,175,55,0.3)`,
                    }}
                  />
                </div>
                {/* Invisible range input on top */}
                <input
                  type="range"
                  min={minBet}
                  max={maxBet}
                  step={sliderStep}
                  value={betAmount}
                  onChange={(e) => { setBetAmount(Number(e.target.value)); setShowCustomInput(false); }}
                  className="absolute inset-x-0 w-full h-10 opacity-0 cursor-pointer z-10"
                  data-testid="bet-slider"
                />
                {/* Thumb indicator */}
                <div
                  className="absolute w-5 h-5 rounded-full pointer-events-none transition-all duration-100"
                  style={{
                    left: `calc(${sliderPct}% - 10px)`,
                    background: "linear-gradient(135deg, #f5d76e, #d4af37)",
                    border: "2px solid #fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 12px rgba(212,175,55,0.3)",
                  }}
                />
              </div>

              {/* Bet amount display — clickable for custom input */}
              <div className="shrink-0">
                {showCustomInput ? (
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-mono text-amber-400 font-black">$</span>
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
                      data-testid="custom-bet-input"
                      className="w-28 rounded-xl px-3 py-2.5 text-base font-mono font-black text-amber-300 bg-amber-500/10 border-2 border-amber-500/40 outline-none focus:border-amber-400/70"
                      style={{ appearance: "textfield" }}
                    />
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowCustomInput(true)}
                    data-testid="bet-amount-display"
                    className="rounded-xl min-w-[100px] text-center cursor-text"
                    title="Click to type custom amount"
                    style={{
                      padding: "0.5rem 1rem",
                      background: "rgba(212,175,55,0.08)",
                      border: "1.5px solid rgba(212,175,55,0.25)",
                      boxShadow: "0 0 12px rgba(212,175,55,0.08)",
                    }}
                  >
                    <span className="text-lg font-mono font-black text-amber-200" style={{ textShadow: "0 0 10px rgba(212,175,55,0.3)" }}>
                      ${betAmount.toLocaleString()}
                    </span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          {/* === BOTTOM ROW: Action Buttons === */}
          <div className="flex items-center gap-3 justify-center">

            {/* Pot odds indicator (when facing a bet) */}
            {needsToCall && potOdds > 0 && isHeroTurn && (
              <div className="flex flex-col items-center mr-2 shrink-0">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Pot Odds</span>
                <span className="text-sm font-mono font-black text-amber-400">{potOdds}%</span>
              </div>
            )}

            {/* FOLD button */}
            <motion.button
              whileHover={buttonsDisabled ? {} : { scale: 1.06, y: -3 }}
              whileTap={buttonsDisabled ? {} : { scale: 0.94 }}
              onClick={handleFold}
              disabled={buttonsDisabled}
              title="Fold (F)"
              data-testid="button-fold"
              className={`relative overflow-hidden rounded-2xl transition-all ${buttonsDisabled ? "opacity-40 pointer-events-none" : ""} ${kbFlash === "fold" ? "ring-2 ring-white/50" : ""}`}
              style={{
                padding: "1rem 2rem",
                minWidth: "120px",
                minHeight: "3.5rem",
                color: "#fff",
                background: foldConfirm
                  ? "linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)"
                  : "linear-gradient(180deg, rgba(220,38,38,0.9) 0%, rgba(185,28,28,0.95) 50%, rgba(127,29,29,1) 100%)",
                border: foldConfirm ? "2px solid rgba(248,113,113,0.6)" : "1px solid rgba(239,68,68,0.2)",
                boxShadow: foldConfirm
                  ? "0 0 30px rgba(239,68,68,0.4), 0 8px 24px rgba(0,0,0,0.5)"
                  : "0 8px 24px rgba(0,0,0,0.4), 0 0 10px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {foldConfirm && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent h-1/2 rounded-2xl" />
              <span className="relative flex flex-col items-center gap-1">
                <span className="text-base font-black tracking-[0.2em]">{foldConfirm ? "CONFIRM" : "FOLD"}</span>
                <kbd className="text-[0.6rem] font-mono opacity-30 bg-black/20 px-2 py-0.5 rounded border border-white/10">F</kbd>
              </span>
            </motion.button>

            {/* CHECK / CALL button */}
            <motion.button
              whileHover={buttonsDisabled ? {} : { scale: 1.06, y: -3 }}
              whileTap={buttonsDisabled ? {} : { scale: 0.94 }}
              onClick={needsToCall ? handleCall : handleCheck}
              disabled={buttonsDisabled}
              title={needsToCall ? `Call $${callAmount} (C)` : "Check (C)"}
              data-testid="button-call"
              className={`relative overflow-hidden rounded-2xl transition-all ${buttonsDisabled ? "opacity-40 pointer-events-none" : ""} ${kbFlash === "call" ? "ring-2 ring-white/50" : ""}`}
              style={{
                padding: "1rem 2rem",
                minWidth: "140px",
                minHeight: "3.5rem",
                color: "#fff",
                background: "linear-gradient(180deg, rgba(22,163,74,0.95) 0%, rgba(21,128,61,0.98) 50%, rgba(20,83,45,1) 100%)",
                border: "1px solid rgba(34,197,94,0.25)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 16px rgba(34,197,94,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2 rounded-2xl" />
              <span className="relative flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="text-base font-black tracking-[0.2em]">{needsToCall ? "CALL" : "CHECK"}</span>
                  <kbd className="text-[0.6rem] font-mono opacity-30 bg-black/20 px-2 py-0.5 rounded border border-white/10">C</kbd>
                </span>
                {needsToCall && (
                  <span className="font-mono text-lg font-black text-emerald-200" style={{ textShadow: "0 0 10px rgba(34,197,94,0.4)" }}>
                    ${callAmount.toLocaleString()}
                  </span>
                )}
              </span>
            </motion.button>

            {/* RAISE / BET / ALL-IN button */}
            <motion.button
              whileHover={buttonsDisabled ? {} : { scale: 1.06, y: -3 }}
              whileTap={buttonsDisabled ? {} : { scale: 0.94 }}
              onClick={() => {
                if (buttonsDisabled) return;
                if (isAllIn) handleAllIn();
                else handleRaise();
              }}
              disabled={buttonsDisabled}
              title={`${isAllIn ? "All-In" : needsToCall ? "Raise" : "Bet"} $${betAmount.toLocaleString()} (R)`}
              data-testid="button-raise"
              className={`relative overflow-hidden rounded-2xl transition-all ${buttonsDisabled ? "opacity-40 pointer-events-none" : ""} ${kbFlash === "raise" ? "ring-2 ring-white/50" : ""}`}
              style={{
                padding: "1rem 2.5rem",
                minWidth: "160px",
                minHeight: "3.5rem",
                color: "#fff",
                background: isAllIn
                  ? "linear-gradient(180deg, rgba(245,158,11,1) 0%, rgba(217,119,6,1) 40%, rgba(180,83,9,1) 100%)"
                  : "linear-gradient(180deg, rgba(234,179,8,0.95) 0%, rgba(202,138,4,0.98) 40%, rgba(133,77,14,1) 100%)",
                border: isAllIn ? "2px solid rgba(251,191,36,0.5)" : "1px solid rgba(234,179,8,0.25)",
                boxShadow: isAllIn
                  ? "0 0 40px rgba(245,158,11,0.35), 0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)"
                  : "0 8px 24px rgba(0,0,0,0.4), 0 0 14px rgba(234,179,8,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {isAllIn && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)" }}
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2 rounded-2xl" />
              <span className="relative flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="text-base font-black tracking-[0.2em]">
                    {isAllIn ? "ALL-IN" : needsToCall ? "RAISE" : "BET"}
                  </span>
                  <kbd className="text-[0.6rem] font-mono opacity-30 bg-black/20 px-2 py-0.5 rounded border border-white/10">R</kbd>
                </span>
                <span
                  className="font-mono text-lg font-black"
                  style={{
                    color: isAllIn ? "#fde68a" : "#fef3c7",
                    textShadow: isAllIn ? "0 0 12px rgba(245,158,11,0.5)" : "0 0 6px rgba(234,179,8,0.3)",
                  }}
                >
                  ${betAmount.toLocaleString()}
                </span>
              </span>
            </motion.button>

            {/* Buy Time */}
            {onBuyTime && isHeroTurn && heroTimeLeft !== undefined && heroTimeLeft < 30 && (
              <motion.button
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={onBuyTime}
                data-testid="button-buytime"
                className={`relative overflow-hidden rounded-2xl font-bold text-sm uppercase tracking-wider text-white ${timerUrgent ? "animate-pulse" : ""}`}
                style={{
                  padding: "1rem 1.25rem",
                  minHeight: "3.5rem",
                  background: "linear-gradient(180deg, #b45309 0%, #92400e 50%, #78350f 100%)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4), 0 0 12px rgba(245,158,11,0.2)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2" />
                <span className="relative text-base font-black">+10s</span>
                {bigBlind && <span className="font-mono text-xs opacity-40 ml-1 relative">(${bigBlind})</span>}
              </motion.button>
            )}
          </div>

          {/* Auto toggles — below action buttons */}
          {!isHeroTurn && heroStatus !== "folded" && heroStatus !== "all-in" && (
            <div className="flex items-center gap-4 justify-center mt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoFold}
                    onChange={(e) => { setAutoFold(e.target.checked); if (e.target.checked) setAutoCheckFold(false); }}
                    className="sr-only"
                    data-testid="toggle-autofold"
                  />
                  <div className={`w-5 h-5 rounded-md border transition-all ${autoFold ? "bg-red-500/80 border-red-400/60" : "bg-white/5 border-white/15 group-hover:border-white/30"}`}>
                    {autoFold && <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                  Auto-Fold
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoCheckFold}
                    onChange={(e) => { setAutoCheckFold(e.target.checked); if (e.target.checked) setAutoFold(false); }}
                    className="sr-only"
                    data-testid="toggle-checkfold"
                  />
                  <div className={`w-5 h-5 rounded-md border transition-all ${autoCheckFold ? "bg-emerald-500/80 border-emerald-400/60" : "bg-white/5 border-white/15 group-hover:border-white/30"}`}>
                    {autoCheckFold && <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
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
