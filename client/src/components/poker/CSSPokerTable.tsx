import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useGameUI } from "@/lib/game-ui-context";
import { TABLE_SEATS, DEALER_POSITIONS } from "@/lib/table-constants";
import { Card } from "./Card";
import type { CardType } from "@/lib/poker-types";
import type { Player } from "@/lib/poker-types";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

function formatChips(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

interface CSSPokerTableProps {
  communityCards: CardType[];
  pot: number;
  playerCount: number;
  maxSeats?: number;
  players?: Player[];
  dealerSeatIndex?: number;
  visibleCommunityCards?: number;
  communityFlipped?: boolean;
  showBurnCard?: boolean;
  dealPhase?: string;
  actionLog?: string[];
}

export function CSSPokerTable({
  communityCards,
  pot,
  playerCount,
  maxSeats = 10,
  players,
  dealerSeatIndex = -1,
  visibleCommunityCards,
  communityFlipped = true,
  showBurnCard = false,
  dealPhase,
  actionLog,
}: CSSPokerTableProps) {
  const { compactMode } = useGameUI();
  const occupiedCount = players?.length || playerCount;
  const dealerPos = dealerSeatIndex >= 0 && dealerSeatIndex < DEALER_POSITIONS.length
    ? DEALER_POSITIONS[dealerSeatIndex]
    : null;

  const { value: animatedPot, animating: potAnimating, delta: potDelta } = useAnimatedCounter(pot, 500);

  const potRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (window as any).__potRef = potRef;
    return () => { delete (window as any).__potRef; };
  }, []);

  const [showFlash, setShowFlash] = useState(false);
  const prevPhaseRef = useRef(dealPhase);
  useEffect(() => {
    if (dealPhase && dealPhase !== prevPhaseRef.current && !compactMode) {
      setShowFlash(true);
      const t = setTimeout(() => setShowFlash(false), 500);
      prevPhaseRef.current = dealPhase;
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = dealPhase;
  }, [dealPhase, compactMode]);

  const prevDealerRef = useRef(dealerSeatIndex);
  const dealerChanged = dealerSeatIndex !== prevDealerRef.current;
  useEffect(() => { prevDealerRef.current = dealerSeatIndex; }, [dealerSeatIndex]);

  return (
    <>
      {/* ═══ Stitch-Poker Elliptical Table ═══ */}
      <div className="absolute z-[5]" style={{
        left: "50%",
        top: "46%",
        transform: "translate(-50%, -50%)",
        width: "58%",
        paddingBottom: "34%",
      }}>
        <div className="absolute inset-0 rounded-[50%]" style={{
          background: "radial-gradient(ellipse at 50% 40%, #1a3a2a 0%, #0f2a1c 30%, #0a1f15 50%, #071a10 70%, #040e08 100%)",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.5), inset 0 -8px 30px rgba(0,0,0,0.3), 0 8px 40px rgba(0,0,0,0.7), 0 0 100px rgba(0,0,0,0.3)",
          border: "7px solid #18181e",
        }}>
          <div className="absolute inset-[5px] rounded-[50%]" style={{
            border: "2.5px solid #d4af37",
            boxShadow: "0 0 12px rgba(212,175,55,0.25), inset 0 0 12px rgba(212,175,55,0.08)",
          }} />
          <div className="absolute inset-[14px] rounded-[50%]" style={{
            border: "1px solid rgba(212,175,55,0.12)",
          }} />
          <div className="absolute inset-0 rounded-[50%]" style={{
            background: "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.03) 0%, transparent 50%)",
          }} />
          <div className="absolute" style={{ left: "50%", top: "55%", transform: "translate(-50%, -50%)" }}>
            <span className="text-[#d4af37]/[0.12] font-display font-black text-2xl tracking-[0.4em] uppercase select-none" style={{ textShadow: "0 0 15px rgba(212,175,55,0.05)" }}>
              HIGH ROLLERS
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Game elements overlay ═══ */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

        {/* Empty seat slots */}
        {Array.from({ length: maxSeats }).map((_, i) => {
          const seat = TABLE_SEATS[i];
          if (!seat) return null;
          if (i < occupiedCount) return null;
          return (
            <div
              key={`empty-${i}`}
              className="absolute pointer-events-auto cursor-pointer group"
              style={{ left: `${seat.x}%`, top: `${seat.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div
                className="w-[72px] h-[72px] rounded-[22px] border-2 border-dashed flex flex-col items-center justify-center transition-all group-hover:scale-110"
                style={{
                  borderColor: "rgba(0,243,255,0.4)",
                  background: "rgba(0,243,255,0.06)",
                }}
              >
                <span style={{ color: "rgba(0,243,255,0.5)", fontSize: "0.625rem", fontFamily: "monospace", fontWeight: 700 }}>#{i + 1}</span>
                <span style={{ color: "rgba(0,243,255,0.3)", fontSize: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }} className="group-hover:!text-cyan-400/70 transition-colors">SIT</span>
              </div>
            </div>
          );
        })}

        {/* Community cards */}
        <AnimatePresence>
          {(() => {
            const count = visibleCommunityCards !== undefined
              ? Math.min(visibleCommunityCards, communityCards.length)
              : communityCards.length;
            if (count <= 0) return null;
            const cardsToShow = communityCards.slice(0, count);
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute flex items-center gap-2"
                style={{
                  left: "50%",
                  top: "46%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                }}
              >
                {cardsToShow.map((card, i) => (
                  <Card
                    key={`cc-${i}-${card.suit}-${card.rank}`}
                    card={card}
                    size={compactMode ? "lg" : "2xl"}
                    delay={compactMode ? 0 : i * 0.12}
                    dealFrom={compactMode ? undefined : { x: 200, y: -100 }}
                    faceDown={!communityFlipped && !compactMode}
                    flipDelay={compactMode ? 0 : 0.15 * i}
                  />
                ))}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Pot display — stitch-poker gold pill style */}
        <AnimatePresence>
          {pot > 0 && (
            <motion.div
              ref={potRef}
              initial={compactMode ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={compactMode ? { duration: 0 } : undefined}
              className="absolute z-20 flex flex-col items-center gap-1"
              style={{ left: "50%", top: "30%", transform: "translateX(-50%)" }}
            >
              {dealPhase && (
                <span className="text-[#00f3ff] text-[11px] font-mono font-bold tracking-wider uppercase"
                  style={{ textShadow: "0 0 8px rgba(0,243,255,0.4)" }}>
                  {dealPhase === "pre-flop" ? "Pre-Flop" : dealPhase === "flop" ? "Flop" : dealPhase === "turn" ? "Turn" : dealPhase === "river" ? "River" : ""}
                </span>
              )}
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full" style={{
                background: "rgba(15,15,20,0.85)",
                border: "1px solid rgba(212,175,55,0.3)",
                boxShadow: "0 0 15px rgba(212,175,55,0.15)",
              }}>
                <DollarSign className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#d4af37] font-display font-black text-sm tracking-wide">
                  {formatChips(animatedPot)}
                </span>
              </div>

              <AnimatePresence>
                {potAnimating && potDelta > 0 && !compactMode && (
                  <motion.span
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -20 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute -top-4 right-0 text-[0.75rem] font-mono font-bold text-green-400"
                    style={{ textShadow: "0 0 8px rgba(92,255,125,0.5)" }}
                  >
                    +${potDelta.toLocaleString()}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dealer button */}
        <AnimatePresence>
          {dealerPos && (
            <motion.div
              key="dealer-btn"
              initial={false}
              animate={{
                left: `${dealerPos.x}%`, top: `${dealerPos.y}%`,
                opacity: 1, scale: [1, 1.18, 1],
                rotate: dealerChanged && !compactMode ? [0, 360] : 0,
              }}
              transition={compactMode ? { duration: 0 } : {
                type: "spring", stiffness: 200, damping: 25,
                scale: { duration: 0.4 }, rotate: { duration: 0.6 },
              }}
              className="absolute"
              style={{ transform: "translate(-50%, -50%)", zIndex: 15 }}
            >
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg"
                style={{ border: "2.5px solid #d4af37", boxShadow: "0 0 10px rgba(212,175,55,0.4)" }}>
                <span className="text-[11px] font-black text-gray-900">D</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase flash */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(212,175,55,0.10) 0%, transparent 60%)", zIndex: 20 }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
