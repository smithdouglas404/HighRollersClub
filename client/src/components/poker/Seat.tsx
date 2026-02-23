import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/poker-types";
import { Card } from "./Card";
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
      // Trigger chip flight animation to pot center
      if (seatRef.current) {
        const rect = seatRef.current.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;
        // Pot center is roughly the center of the viewport
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

  // Deal-from position (top-center of table as "shoe")
  const dealFrom = { x: 0, y: -120 };

  return (
    <div
      ref={seatRef}
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%) rotateX(-30deg)",
        zIndex: isHero ? 40 : position.y < 50 ? 10 : 30,
      }}
    >
      {/* Player seat group */}
      <div className="relative group flex flex-col items-center">

        {/* Emote bubble */}
        <EmoteBubble playerId={player.id} />

        {/* Active turn outer glow ring */}
        {isTurn && (
          <div className="absolute -inset-6 z-0">
            <div className="w-full h-full rounded-full"
              style={{
                background: isHero
                  ? "radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)",
                animation: "neonPulse 2s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {/* Avatar container */}
        <div className={cn(
          "relative z-10 transition-transform duration-300",
          isTurn && "scale-110",
          isFolded && "opacity-40 grayscale"
        )}>

          {/* Dealer button */}
          {player.isDealer && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 z-30 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-black gold-gradient shadow-[0_0_10px_rgba(201,168,76,0.5)]"
            >
              D
            </motion.div>
          )}

          {/* Hexagonal avatar frame with SVG */}
          <div className={cn("relative", isHero ? "w-[88px] h-[88px]" : "w-[72px] h-[72px]")}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" style={{ filter: isTurn ? `drop-shadow(0 0 8px ${isHero ? "rgba(0,240,255,0.5)" : "rgba(255,215,0,0.4)"})` : "drop-shadow(0 0 4px rgba(0,0,0,0.5))" }}>
              <defs>
                <clipPath id={`hex-${player.id}`}>
                  <polygon points="50,2 93,25 93,75 50,98 7,75 7,25" />
                </clipPath>
                <linearGradient id={`frame-grad-${player.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  {isTurn ? (
                    <>
                      <stop offset="0%" stopColor={isHero ? "#00f0ff" : "#ffd700"} />
                      <stop offset="50%" stopColor={isHero ? "#00ff9d" : "#c9a84c"} />
                      <stop offset="100%" stopColor={isHero ? "#00f0ff" : "#ffd700"} />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#3a3a4a" />
                      <stop offset="100%" stopColor="#1a1a2a" />
                    </>
                  )}
                </linearGradient>
              </defs>

              {/* Outer hex frame */}
              <polygon
                points="50,0 95,24 95,76 50,100 5,76 5,24"
                fill="none"
                stroke={`url(#frame-grad-${player.id})`}
                strokeWidth="3"
              />

              {/* Inner hex frame */}
              <polygon
                points="50,4 91,26 91,74 50,96 9,74 9,26"
                fill="none"
                stroke={isTurn ? (isHero ? "rgba(0,240,255,0.3)" : "rgba(255,215,0,0.3)") : "rgba(255,255,255,0.05)"}
                strokeWidth="1"
              />

              {/* Avatar image */}
              <image
                href={player.avatar}
                x="6" y="6" width="88" height="88"
                clipPath={`url(#hex-${player.id})`}
                preserveAspectRatio="xMidYMid slice"
              />

              {/* Timer ring (animated) */}
              {isTurn && (
                <polygon
                  points="50,2 93,25 93,75 50,98 7,75 7,25"
                  fill="none"
                  stroke={isHero ? "#00f0ff" : "#ffd700"}
                  strokeWidth="2.5"
                  strokeDasharray="340"
                  strokeDashoffset={340 - (340 * (player.timeLeft || 100)) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                  style={{ filter: `drop-shadow(0 0 4px ${isHero ? "rgba(0,240,255,0.6)" : "rgba(255,215,0,0.6)"})` }}
                />
              )}
            </svg>

            {/* Folded overlay */}
            {isFolded && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  Fold
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Name plate */}
        <div className={cn(
          "mt-1 px-3 py-1.5 rounded-md flex flex-col items-center min-w-[90px] relative overflow-hidden",
          "glass",
          isTurn && (isHero ? "neon-border-cyan" : "neon-border-gold"),
        )}>
          {/* Shimmer on active */}
          {isTurn && (
            <div className="absolute inset-0 opacity-30"
              style={{
                background: `linear-gradient(90deg, transparent, ${isHero ? "rgba(0,240,255,0.15)" : "rgba(255,215,0,0.15)"}, transparent)`,
                backgroundSize: "200% 100%",
                animation: "shimmer 2s ease infinite",
              }}
            />
          )}
          <span className={cn(
            "text-[9px] uppercase tracking-[0.15em] font-semibold relative z-10",
            isTurn ? (isHero ? "text-cyan-300" : "text-yellow-300") : "text-gray-400"
          )}>
            {player.name}
          </span>
          <div className="flex items-center gap-0.5 relative z-10">
            <span className="text-[10px] text-yellow-500/80">$</span>
            <span className={cn(
              "text-xs font-mono font-bold leading-none tracking-tight",
              isHero ? "neon-text-gold" : "text-yellow-400"
            )}>
              {player.chips.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action status label */}
        <AnimatePresence>
          {statusLabel[player.status] && !isFolded && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.8 }}
              className={cn(
                "absolute -bottom-7 glass px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider z-30",
                player.status === "raised" && "text-cyan-400 neon-border-cyan",
                player.status === "called" && "text-green-400 neon-border-green",
                player.status === "checked" && "text-gray-300 border-gray-600",
                player.status === "all-in" && "text-red-400 border-red-500/40",
              )}
            >
              {statusLabel[player.status]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet chips */}
        <AnimatePresence>
          {player.currentBet > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -10 }}
              className="absolute z-30 flex flex-col items-center gap-0.5"
              style={{
                top: isHero ? "-40%" : "120%",
              }}
            >
              {/* Chip stack */}
              <div className="relative w-7 h-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute left-0 w-7 h-7 rounded-full"
                    style={{
                      bottom: `${i * 3}px`,
                      background: i === 2
                        ? "linear-gradient(135deg, #ffd700, #c9a84c)"
                        : i === 1
                        ? "linear-gradient(135deg, #e74c3c, #c0392b)"
                        : "linear-gradient(135deg, #2ecc71, #27ae60)",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                      border: "2px dashed rgba(255,255,255,0.25)",
                      transform: "rotateX(55deg)",
                    }}
                  />
                ))}
              </div>
              <div className="glass px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white neon-border-gold">
                {player.currentBet.toLocaleString()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hole cards */}
      {player.cards && !isFolded && (
        <div
          className={cn(
            "flex absolute transition-all duration-500",
            isHero
              ? "-top-[110px] gap-1.5 z-50"
              : "top-[80%] gap-0.5 z-0 opacity-80 scale-75"
          )}
          style={{
            transform: isHero ? "rotateX(5deg)" : undefined,
            perspective: "600px",
          }}
        >
          <Card
            card={player.cards[0]}
            size={isHero ? "lg" : "sm"}
            delay={0}
            isHero={isHero}
            dealFrom={dealFrom}
            onDealt={() => sound.playCardDeal()}
          />
          <Card
            card={player.cards[1]}
            size={isHero ? "lg" : "sm"}
            delay={0.1}
            isHero={isHero}
            dealFrom={dealFrom}
            onDealt={() => sound.playCardDeal()}
          />
        </div>
      )}
    </div>
  );
}
