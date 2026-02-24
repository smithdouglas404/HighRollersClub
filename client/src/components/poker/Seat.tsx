import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/poker-types";
import { EmoteBubble } from "./EmoteSystem";
import { useSoundEngine } from "@/lib/sound-context";
import { useEffect, useRef } from "react";
import { triggerChipFlight } from "./ChipAnimation";

interface SeatProps {
  player: Player;
  position: { x: number; y: number };
  isHero?: boolean;
}

export function Seat({ player, position, isHero = false }: SeatProps) {
  const isTurn = player.status === "thinking";
  const isFolded = player.status === "folded";
  const sound = useSoundEngine();
  const prevBetRef = useRef(player.currentBet);
  const timerTickRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const seatRef = useRef<HTMLDivElement>(null);

  const statusLabel: Record<string, string> = {
    folded: "FOLD",
    checked: "CHECK",
    called: "CALL",
    raised: "RAISE",
    "all-in": "ALL IN",
  };

  // Play chip sound and trigger chip flight when bet increases
  useEffect(() => {
    if (player.currentBet > prevBetRef.current && player.currentBet > 0) {
      sound.playChipClink();
      if (seatRef.current) {
        const rect = seatRef.current.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;
        const toX = window.innerWidth / 2;
        const toY = window.innerHeight * 0.38;
        triggerChipFlight(fromX, fromY, toX, toY, player.currentBet - prevBetRef.current);
      }
    }
    prevBetRef.current = player.currentBet;
  }, [player.currentBet, sound]);

  // Timer tick sound when it's this player's turn (hero only)
  useEffect(() => {
    if (isTurn && isHero) {
      timerTickRef.current = setInterval(() => {
        const urgency = 1 - (player.timeLeft || 100) / 100;
        sound.playTimerTick(urgency);
      }, 2000);
    }
    return () => {
      if (timerTickRef.current) clearInterval(timerTickRef.current);
    };
  }, [isTurn, isHero, player.timeLeft, sound]);

  return (
    <div
      ref={seatRef}
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        zIndex: isHero ? 40 : position.y < 50 ? 10 : 30,
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Emote bubble */}
        <EmoteBubble playerId={player.id} />

        {/* Active turn pulse */}
        {isTurn && (
          <div className="absolute -inset-4 z-0">
            <div
              className="w-full h-full rounded-full"
              style={{
                background: isHero
                  ? "radial-gradient(circle, rgba(0,240,255,0.2) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)",
                animation: "neonPulse 2s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {/* Compact name + chips HUD */}
        <div
          className={cn(
            "relative z-10 px-2 py-1.5 rounded-lg flex flex-col items-center min-w-[72px] backdrop-blur-md",
            "bg-black/40 border",
            isFolded && "opacity-40 grayscale",
            isTurn
              ? isHero
                ? "border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                : "border-amber-500/30 shadow-[0_0_10px_rgba(255,215,0,0.15)]"
              : "border-white/[0.04]"
          )}
        >
          {/* Dealer badge */}
          {player.isDealer && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-2 -top-2 z-30 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-black gold-gradient shadow-[0_0_8px_rgba(201,168,76,0.5)]"
            >
              D
            </motion.div>
          )}

          {/* Timer arc */}
          {isTurn && (
            <svg className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)]" viewBox="0 0 100 40">
              <rect
                x="1" y="1" width="98" height="38" rx="8"
                fill="none"
                stroke={isHero ? "#00f0ff" : "#ffd700"}
                strokeWidth="1.5"
                strokeDasharray="280"
                strokeDashoffset={280 - (280 * (player.timeLeft || 100)) / 100}
                className="transition-all duration-1000 ease-linear"
                style={{ filter: `drop-shadow(0 0 3px ${isHero ? "rgba(0,240,255,0.5)" : "rgba(255,215,0,0.5)"})` }}
              />
            </svg>
          )}

          {/* Player name */}
          <span
            className={cn(
              "text-[8px] uppercase tracking-[0.15em] font-semibold",
              isTurn ? (isHero ? "text-cyan-300" : "text-yellow-300") : "text-gray-400"
            )}
          >
            {player.name}
          </span>

          {/* Chip count */}
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-yellow-500/80">$</span>
            <span
              className={cn(
                "text-[11px] font-mono font-bold leading-none tracking-tight",
                isHero ? "text-amber-400" : "text-yellow-400/90"
              )}
            >
              {player.chips.toLocaleString()}
            </span>
          </div>

          {/* Current bet (if any) */}
          {player.currentBet > 0 && (
            <div className="text-[8px] font-mono font-bold text-green-400/80">
              Bet: {player.currentBet.toLocaleString()}
            </div>
          )}
        </div>

        {/* Action status label */}
        <AnimatePresence>
          {statusLabel[player.status] && !isFolded && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.8 }}
              className={cn(
                "absolute -bottom-5 backdrop-blur-md bg-black/70 px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider z-30 border",
                player.status === "raised" && "text-cyan-400 border-cyan-500/30",
                player.status === "called" && "text-green-400 border-green-500/30",
                player.status === "checked" && "text-gray-300 border-gray-600/30",
                player.status === "all-in" && "text-red-400 border-red-500/30",
              )}
            >
              {statusLabel[player.status]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cards and chips are now rendered in 3D scene — not here */}
    </div>
  );
}
