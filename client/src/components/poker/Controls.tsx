import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { useSoundEngine } from "@/lib/sound-context";
import { useGameUI } from "@/lib/game-ui-context";
import { Minus, Plus } from "lucide-react";

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

/* ── Flat button style helper ── */
const flatBtn = (borderColor: string, textColor: string, dim = false) => ({
  padding: "0.7rem 1.25rem",
  color: textColor,
  background: dim ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.6)",
  border: `2px solid ${borderColor}`,
  boxShadow: "none",
});

export function PokerControls({ onAction, minBet, maxBet, callCost, pot = 0, phase, currentTurnSeat, isHeroTurn, onBuyTime, bigBlind, heroTimeLeft, heroStatus, heroCardsSlot, handBadgeSlot }: ControlsProps) {
  const [betAmount, setBetAmount] = useState(minBet);
  const [showRaisePanel, setShowRaisePanel] = useState(false);
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
  const needsToCall = (callCost ?? 0) > 0;
  const callAmount = callCost ?? 0;
  const buttonsDisabled = isPending || !isHeroTurn;

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
    setShowRaisePanel(false);
    setBetAmount(minBet);
  }, [phase, currentTurnSeat, minBet]);

  const sliderStep = Math.max(1, Math.floor(bb / 2)) || 1;
  const potRaiseTotal = Math.min(Math.max(pot + callAmount * 2, minBet), maxBet);
  const clamp = (v: number) => Math.min(Math.max(Math.round(v), minBet), maxBet);

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
    setShowRaisePanel(false);
    sound.playRaise();
    sound.playChipSlide();
    onAction("raise", betAmount);
  }, [sound, onAction, betAmount, isPending]);

  const handleAllIn = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    setShowRaisePanel(false);
    sound.playRaise();
    sound.playChipSlide();
    onAction("raise", maxBet);
  }, [sound, onAction, maxBet, isPending]);

  const isAllIn = betAmount >= maxBet;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPending || !isHeroTurn) return;
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
          if (showRaisePanel) {
            if (isAllIn) handleAllIn();
            else handleRaise();
          } else {
            setShowRaisePanel(true);
          }
          break;
        case "a":
          handleAllIn();
          break;
        case "escape":
          setShowRaisePanel(false);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPending, needsToCall, isAllIn, showRaisePanel, handleFoldKeyboard, handleCall, handleCheck, handleRaise, handleAllIn, isHeroTurn]);

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
  const timerColor = timerPct > 50 ? "#00d4ff" : timerPct > 25 ? "#f59e0b" : "#ef4444";
  const timerUrgent = timerPct <= 25;

  return (
    <motion.div
      initial={compactMode ? { y: 0, opacity: 1 } : { y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={compactMode ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }}
      className="relative z-50"
      data-testid="poker-controls"
    >
      {/* Timer bar */}
      {isHeroTurn && (
        <div className="h-[4px] w-full overflow-hidden" style={{ background: "rgba(0,0,0,0.6)" }}>
          <motion.div
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}dd)`,
              boxShadow: `0 0 12px ${timerColor}, 0 0 4px ${timerColor}`,
            }}
            initial={{ width: "100%" }}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>
      )}

      {/* Gradient fade from table */}
      <div className="h-3 bg-gradient-to-t from-[#080e18] to-transparent pointer-events-none" />

      {/* Main controls container */}
      <div
        className="px-4 pb-3 pt-1.5"
        style={{
          background: "linear-gradient(180deg, rgba(8,14,24,0.97) 0%, rgba(4,8,16,0.99) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col gap-2">

          {/* === Raise Panel (hidden until RAISE clicked) === */}
          <AnimatePresence>
            {showRaisePanel && isHeroTurn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 py-1">
                  {/* Presets */}
                  <div className="flex items-center justify-center gap-2">
                    {presets.map((p) => {
                      const isActive = betAmount === p.value;
                      return (
                        <button
                          key={p.label}
                          onClick={() => handlePreset(p.value)}
                          title={p.tooltip}
                          data-testid={`preset-${p.label.toLowerCase()}`}
                          className="rounded-lg text-[0.75rem] font-bold uppercase tracking-wide transition-all"
                          style={{
                            padding: "0.35rem 0.7rem",
                            color: isActive ? "#22c55e" : "#888",
                            background: "rgba(0,0,0,0.4)",
                            border: isActive ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.12)",
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePreset(maxBet)}
                      data-testid="preset-allin"
                      className="rounded-lg text-[0.75rem] font-bold uppercase tracking-wide transition-all"
                      style={{
                        padding: "0.35rem 0.7rem",
                        color: betAmount === maxBet ? "#f59e0b" : "#888",
                        background: "rgba(0,0,0,0.4)",
                        border: betAmount === maxBet ? "1.5px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      ALL IN
                    </button>
                  </div>

                  {/* Slider row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={stepDown}
                      className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      data-testid="bet-minus"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex-1 px-1">
                      <Slider
                        value={[betAmount]}
                        max={maxBet}
                        min={minBet}
                        step={sliderStep}
                        onValueChange={(val) => { setBetAmount(val[0]); setShowCustomInput(false); }}
                        className="flex-1"
                        data-testid="bet-slider"
                      />
                      <div className="flex justify-between mt-0.5 px-0.5">
                        <span className="text-[0.6rem] font-mono text-gray-500">${minBet.toLocaleString()}</span>
                        <span className="text-[0.6rem] font-mono text-gray-500">${maxBet.toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={stepUp}
                      className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      data-testid="bet-plus"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Bet amount / custom input */}
                    {showCustomInput ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-mono text-white">$</span>
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
                          className="w-24 rounded px-2 py-1.5 text-sm font-mono font-bold text-white bg-white/5 border border-white/20 outline-none focus:border-white/40"
                          style={{ appearance: "textfield" }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCustomInput(true)}
                        data-testid="bet-amount-display"
                        className="rounded px-3 py-1.5 min-w-[80px] text-center cursor-text shrink-0"
                        title="Click to type a custom amount"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        <span className="text-sm font-mono font-bold text-white">
                          ${betAmount.toLocaleString()}
                        </span>
                      </button>
                    )}

                    {/* Confirm raise */}
                    <button
                      onClick={() => { if (isAllIn) handleAllIn(); else handleRaise(); }}
                      data-testid="confirm-raise"
                      className="rounded-lg text-sm font-bold uppercase tracking-wide shrink-0 transition-all"
                      style={{
                        padding: "0.5rem 1rem",
                        color: isAllIn ? "#f59e0b" : "#22c55e",
                        background: "rgba(0,0,0,0.6)",
                        border: `2px solid ${isAllIn ? "#f59e0b" : "#22c55e"}`,
                      }}
                    >
                      {isAllIn ? `ALL IN $${maxBet.toLocaleString()}` : `RAISE $${betAmount.toLocaleString()}`}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === Main row: Hero cards + Action Buttons === */}
          <div className="flex items-center gap-4">

            {/* Hero cards + hand badge */}
            {heroCardsSlot && (
              <div className="flex items-center gap-2 shrink-0">
                {heroCardsSlot}
                {handBadgeSlot}
              </div>
            )}

            {/* Action buttons (always visible) */}
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`flex items-center gap-3 transition-all duration-200 ${!isHeroTurn ? "opacity-35 pointer-events-none" : ""}`}>

                {/* CALL / CHECK */}
                <button
                  onClick={needsToCall ? handleCall : handleCheck}
                  disabled={buttonsDisabled}
                  title={needsToCall ? `Call $${callAmount} (C)` : "Check (C)"}
                  data-testid="button-call"
                  className={`relative rounded-lg min-w-[140px] min-h-[3rem] font-bold uppercase tracking-wider transition-all ${buttonsDisabled ? "opacity-50 pointer-events-none" : "hover:brightness-110"}`}
                  style={needsToCall
                    ? flatBtn("#22c55e", "#22c55e")
                    : flatBtn("#555", "#888", true)
                  }
                >
                  <span className="absolute top-1 right-2 text-[0.6rem] font-mono opacity-40">C</span>
                  <span className="flex flex-col items-center">
                    <span className="text-[0.85rem] font-black tracking-[0.12em]">
                      {needsToCall ? `CALL ${callAmount}` : "CHECK"}
                    </span>
                  </span>
                </button>

                {/* RAISE */}
                <button
                  onClick={() => {
                    if (buttonsDisabled) return;
                    if (showRaisePanel) {
                      if (isAllIn) handleAllIn();
                      else handleRaise();
                    } else {
                      setShowRaisePanel(true);
                    }
                  }}
                  disabled={buttonsDisabled}
                  title="Raise (R)"
                  data-testid="button-raise"
                  className={`relative rounded-lg min-w-[140px] min-h-[3rem] font-bold uppercase tracking-wider transition-all ${buttonsDisabled ? "opacity-50 pointer-events-none" : "hover:brightness-110"}`}
                  style={flatBtn("#22c55e", "#22c55e")}
                >
                  <span className="absolute top-1 right-2 text-[0.6rem] font-mono opacity-40">R</span>
                  <span className="text-[0.85rem] font-black tracking-[0.12em]">RAISE</span>
                </button>

                {/* CHECK (shown only when not needing to call, as separate option) */}
                {needsToCall && (
                  <button
                    onClick={handleCheck}
                    disabled={buttonsDisabled || needsToCall}
                    data-testid="button-check"
                    className={`relative rounded-lg min-w-[140px] min-h-[3rem] font-bold uppercase tracking-wider transition-all opacity-30 pointer-events-none`}
                    style={flatBtn("#555", "#555", true)}
                  >
                    <span className="absolute top-1 right-2 text-[0.6rem] font-mono opacity-40">K</span>
                    <span className="text-[0.85rem] font-black tracking-[0.12em]">CHECK</span>
                  </button>
                )}

                {/* FOLD */}
                <button
                  onClick={() => {
                    if (buttonsDisabled) return;
                    if (foldConfirm) handleFold();
                    else {
                      setFoldConfirm(true);
                      if (foldTimerRef.current) clearTimeout(foldTimerRef.current);
                      foldTimerRef.current = setTimeout(() => setFoldConfirm(false), 2000);
                    }
                  }}
                  disabled={buttonsDisabled}
                  title="Fold (F)"
                  data-testid="button-fold"
                  className={`relative rounded-lg min-w-[140px] min-h-[3rem] font-bold uppercase tracking-wider transition-all ${buttonsDisabled ? "opacity-50 pointer-events-none" : "hover:brightness-110"}`}
                  style={{
                    ...flatBtn("#ef4444", "#ef4444"),
                    borderColor: foldConfirm ? "#f87171" : "#ef4444",
                    background: foldConfirm ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.6)",
                  }}
                >
                  <span className="absolute top-1 right-2 text-[0.6rem] font-mono opacity-40">F</span>
                  <span className="text-[0.85rem] font-black tracking-[0.12em]">
                    {foldConfirm ? "CONFIRM" : "FOLD"}
                  </span>
                </button>

                {/* Buy Time */}
                {onBuyTime && isHeroTurn && heroTimeLeft !== undefined && heroTimeLeft < 30 && (
                  <button
                    onClick={onBuyTime}
                    data-testid="button-buytime"
                    className={`relative rounded-lg min-h-[3rem] font-bold text-sm uppercase tracking-wider transition-all ${timerUrgent ? "animate-pulse" : ""}`}
                    style={flatBtn("#f59e0b", "#f59e0b")}
                  >
                    <span>+10s</span>
                    {bigBlind && <span className="font-mono text-[0.55rem] opacity-40 ml-1">(${bigBlind})</span>}
                  </button>
                )}
              </div>

              {/* Auto toggles */}
              {!isHeroTurn && heroStatus !== "folded" && heroStatus !== "all-in" && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={autoFold}
                        onChange={(e) => { setAutoFold(e.target.checked); if (e.target.checked) setAutoCheckFold(false); }}
                        className="sr-only"
                        data-testid="toggle-autofold"
                      />
                      <div className={`w-4 h-4 rounded-md border transition-all ${autoFold ? "bg-red-500/80 border-red-400/60" : "bg-white/5 border-white/15 group-hover:border-white/30"}`}>
                        {autoFold && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                      Auto-Fold
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={autoCheckFold}
                        onChange={(e) => { setAutoCheckFold(e.target.checked); if (e.target.checked) setAutoFold(false); }}
                        className="sr-only"
                        data-testid="toggle-checkfold"
                      />
                      <div className={`w-4 h-4 rounded-md border transition-all ${autoCheckFold ? "bg-emerald-500/80 border-emerald-400/60" : "bg-white/5 border-white/15 group-hover:border-white/30"}`}>
                        {autoCheckFold && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">
                      Check/Fold
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
