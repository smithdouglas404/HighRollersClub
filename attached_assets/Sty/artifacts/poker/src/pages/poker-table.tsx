import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useTableWebSocket, type GamePlayer } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PlayingCard } from "@/components/poker/playing-card";
import { cn, formatChips } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, LogOut, Send } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const AVATARS = [
  "avatar-neon-fox.jpg", "avatar-neon-viper.jpg", "avatar-oracle-seer.jpg",
  "avatar-punk-duchess.jpg", "avatar-red-wolf.jpg", "avatar-shadow-king.jpg",
  "avatar-steel-ghost.jpg", "avatar-street-racer.jpg", "avatar-tech-monk.jpg",
  "avatar-void-witch.jpg",
];

const SEAT_POSITIONS = (() => {
  const cx = 40;
  const cy = 40;
  const rx = 30;
  const ry = 32;
  const count = 10;
  const startAngle = -Math.PI / 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / count;
    return {
      left: `${cx + rx * Math.cos(angle)}%`,
      top: `${cy + ry * Math.sin(angle)}%`,
    };
  });
})();

const ACTION_STYLES: Record<string, { text: string; color: string }> = {
  fold: { text: "FOLD", color: "#888" },
  call: { text: "CALL", color: "#00f3ff" },
  raise: { text: "RAISE", color: "#d4af37" },
  check: { text: "CHECK", color: "#22c55e" },
  all_in: { text: "ALL-IN", color: "#ff003c" },
};

function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-[#0a0a0c]/70 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl", className)}>
      {children}
    </div>
  );
}

function getAvatarForSeat(seatIndex: number): string {
  return `${BASE}images/${AVATARS[seatIndex % AVATARS.length]}`;
}

export function PokerTable() {
  const { id } = useParams();
  const tableId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { gameState, chatMessages, connected, sendChat } = useTableWebSocket(tableId);

  const [chatMsg, setChatMsg] = useState("");
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [actionError, setActionError] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinSeat, setJoinSeat] = useState<number | null>(null);
  const [joinBuyIn, setJoinBuyIn] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const prevPhaseRef = useRef<string>("");
  const prevPlayersRef = useRef<string>("");

  useEffect(() => {
    if (!gameState) return;

    const newLogs: string[] = [];
    const playersKey = gameState.players.map(p => `${p.seatIndex}:${p.lastAction}:${p.currentBet}:${p.status}`).join("|");

    if (prevPhaseRef.current !== gameState.phase) {
      if (gameState.phase === "preflop") {
        newLogs.push(`Hand #${gameState.handNumber} started`);
      } else if (gameState.phase !== "waiting" && gameState.phase !== "showdown") {
        newLogs.push(`--- ${gameState.phase.toUpperCase()} ---`);
      }
      if (gameState.phase === "showdown") {
        const winner = gameState.players.find(p => p.chips > 0 && p.status === "waiting");
        if (winner) {
          newLogs.push(`Showdown!`);
        }
      }
      prevPhaseRef.current = gameState.phase;
    }

    if (prevPlayersRef.current !== playersKey) {
      for (const p of gameState.players) {
        if (p.lastAction) {
          const style = ACTION_STYLES[p.lastAction];
          const amt = p.currentBet > 0 ? ` $${formatChips(p.currentBet)}` : "";
          newLogs.push(`${p.displayName} ${style?.text || p.lastAction}${amt}`);
        }
      }
      prevPlayersRef.current = playersKey;
    }

    if (newLogs.length > 0) {
      setActionLog(prev => [...prev.slice(-50), ...newLogs]);
    }
  }, [gameState]);

  const myPlayer = gameState?.players.find(p => p.userId === user?.id);
  const isSeated = !!myPlayer;
  const isMyTurn = myPlayer?.isTurn ?? false;
  const isActive = gameState?.phase !== "waiting" && gameState?.phase !== "showdown";

  const maxBet = Math.max(0, ...(gameState?.players.map(p => p.currentBet) || [0]));
  const toCall = isSeated ? maxBet - (myPlayer?.currentBet || 0) : 0;
  const canCheck = toCall === 0;
  const minRaise = maxBet + (gameState?.bigBlind || 0);

  const occupiedSeats = new Set(gameState?.players.map(p => p.seatIndex) || []);
  const maxSeats = 10;

  const doAction = async (action: string, amount?: number) => {
    if (!isMyTurn) return;
    setActionError("");
    try {
      await api.performAction(tableId, action, amount);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 3000);
    }
  };

  const handleJoin = async () => {
    if (joinSeat === null) return;
    setIsLoading(true);
    setActionError("");
    try {
      await api.joinTable(tableId, joinSeat, joinBuyIn);
      setShowJoinDialog(false);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveTable(tableId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleStartHand = async () => {
    try {
      await api.startHand(tableId);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 3000);
    }
  };

  const handleSendChat = () => {
    if (chatMsg.trim()) {
      sendChat(chatMsg.trim());
      setChatMsg("");
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-[#00f3ff] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">
            {connected ? "Loading table..." : "Connecting..."}
          </p>
        </div>
      </div>
    );
  }

  const phaseLabel = gameState.phase === "preflop" ? "Pre-Flop" : gameState.phase === "flop" ? "Flop" : gameState.phase === "turn" ? "Turn" : gameState.phase === "river" ? "River" : gameState.phase === "showdown" ? "Showdown" : gameState.phase === "waiting" ? "Waiting" : gameState.phase;

  return (
    <div className="w-full h-screen relative overflow-hidden bg-[#0a0a0c]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-[#00f3ff]/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-purple-600/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-3 left-4 z-50">
        <GlassPanel className="px-5 py-3">
          <h2 className="text-white font-display font-black text-base tracking-tight">{gameState.tableName}</h2>
          <p className="text-[#00f3ff] text-[11px] font-mono tracking-wider">${formatChips(gameState.smallBlind)}/${formatChips(gameState.bigBlind)} NLH</p>
          <p className="text-white/50 text-[11px]">Round: <span className="text-[#00f3ff] font-bold">{phaseLabel}</span></p>
          <p className="text-white/30 text-[11px] font-mono">Hand #{gameState.handNumber}</p>
          {!connected && <p className="text-[#ff003c] text-[10px] mt-1">Reconnecting...</p>}
        </GlassPanel>
      </div>

      <div className="absolute inset-0 z-10" style={{ right: "200px" }}>
        <div className="absolute z-[5]" style={{ left: "42%", top: "42%", transform: "translate(-50%, -50%)", width: "58%", paddingBottom: "34%" }}>
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
              <span className="text-[#d4af37]/[0.12] font-display font-black text-2xl tracking-[0.4em] uppercase select-none" style={{ textShadow: "0 0 15px rgba(212,175,55,0.05)" }}>STITCH</span>
            </div>
          </div>
        </div>

        {gameState.pot > 0 && (
          <div className="absolute z-20 flex flex-col items-center" style={{ left: "42%", top: "24%", transform: "translateX(-50%)" }}>
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full" style={{ background: "rgba(15,15,20,0.85)", border: "1px solid rgba(212,175,55,0.3)", boxShadow: "0 0 15px rgba(212,175,55,0.15)" }}>
              <DollarSign className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-[#d4af37] font-display font-black text-sm tracking-wide">{formatChips(gameState.pot)}</span>
            </div>
          </div>
        )}

        {Array.from({ length: maxSeats }, (_, i) => {
          const seat = SEAT_POSITIONS[i];
          if (!seat) return null;
          const player = gameState.players.find(p => p.seatIndex === i);

          if (!player) {
            const canJoin = !isSeated && !occupiedSeats.has(i);
            return (
              <div key={i} className="absolute z-30" style={{ left: seat.left, top: seat.top, transform: "translate(-50%, -50%)" }}>
                <div className="w-[150px]">
                  <div className="relative w-full h-[140px] rounded-t-xl bg-[#0a0a0c]/40 border border-dashed border-white/10 flex items-center justify-center">
                    {canJoin ? (
                      <button
                        onClick={() => { setJoinSeat(i); setShowJoinDialog(true); }}
                        className="px-3 py-2 bg-[#00f3ff]/10 border border-[#00f3ff]/30 rounded-lg text-[#00f3ff] text-[10px] font-bold uppercase tracking-wider hover:bg-[#00f3ff]/20 transition-all"
                      >
                        Sit Here
                      </button>
                    ) : (
                      <span className="text-white/15 text-[10px] font-mono">Empty</span>
                    )}
                  </div>
                  <div className="relative z-30 w-full rounded-xl px-3 py-2 mt-1" style={{ background: "rgba(15,15,20,0.6)" }}>
                    <span className="text-white/20 text-[11px]">Seat {i + 1}</span>
                  </div>
                </div>
              </div>
            );
          }

          const isShowdown = gameState.phase === "showdown";
          const showCards = isShowdown && player.status !== "folded";
          const isMe = player.userId === user?.id;
          const hasCards = player.holeCards && player.holeCards.length === 2;
          const isFolded = player.status === "folded";
          const lastActionStyle = player.lastAction ? ACTION_STYLES[player.lastAction] : null;

          return (
            <div key={i} className="absolute z-30" style={{ left: seat.left, top: seat.top, transform: "translate(-50%, -50%)" }}>
              <div className={cn("relative w-[150px]", player.isTurn && "ring-2 ring-[#00f3ff] rounded-xl")} style={player.isTurn ? { boxShadow: "0 0 25px rgba(0,243,255,0.4)" } : {}}>
                {player.isDealer && (
                  <div className="absolute -top-2 -right-2 z-40 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg" style={{ border: "2px solid #d4af37" }}>
                    <span className="text-[10px] font-black text-gray-900">D</span>
                  </div>
                )}

                {lastActionStyle && isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase" style={{ background: "rgba(10,10,12,0.9)", color: lastActionStyle.color, border: `1px solid ${lastActionStyle.color}40` }}>
                      {lastActionStyle.text}
                    </span>
                  </div>
                )}

                <div className="relative w-full h-[140px] overflow-visible">
                  <img
                    src={player.avatarUrl || getAvatarForSeat(i)}
                    alt=""
                    className={cn("absolute inset-0 w-full h-full object-cover object-top rounded-t-xl", isFolded && "opacity-40 grayscale")}
                  />
                  <div className="absolute inset-0 rounded-t-xl" style={{ background: "linear-gradient(180deg, transparent 30%, rgba(10,10,12,0.8) 100%)" }} />

                  {hasCards && !isFolded && !showCards && !isMe && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex z-20" style={{ bottom: "-4px" }}>
                      {[0, 1].map((ci) => (
                        <div key={ci} className="w-[46px] h-[64px] rounded-md" style={{ background: "linear-gradient(135deg, #1e3a5f, #0d1b2a)", border: "2px solid rgba(0,243,255,0.3)", transform: ci === 0 ? "rotate(-10deg) translateX(6px)" : "rotate(10deg) translateX(-6px)", boxShadow: "0 4px 20px rgba(0,0,0,0.8)" }}>
                          <div className="w-full h-full rounded-md flex items-center justify-center" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,243,255,0.08) 4px, rgba(0,243,255,0.08) 8px)" }}>
                            <div className="w-7 h-9 rounded border-2 border-[#00f3ff]/30 bg-[#00f3ff]/10 flex items-center justify-center">
                              <span className="text-[#00f3ff]/40 text-[14px] font-black">S</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(showCards || isMe) && hasCards && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex z-20" style={{ bottom: "-4px" }}>
                      {player.holeCards!.map((card, ci) => {
                        if (card.suit === "back") {
                          return (
                            <div key={ci} className="w-[46px] h-[64px] rounded-md" style={{ background: "linear-gradient(135deg, #1e3a5f, #0d1b2a)", border: "2px solid rgba(0,243,255,0.3)", transform: ci === 0 ? "rotate(-10deg) translateX(6px)" : "rotate(10deg) translateX(-6px)", boxShadow: "0 4px 20px rgba(0,0,0,0.8)" }}>
                              <div className="w-full h-full rounded-md flex items-center justify-center" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,243,255,0.08) 4px, rgba(0,243,255,0.08) 8px)" }}>
                                <div className="w-7 h-9 rounded border-2 border-[#00f3ff]/30 bg-[#00f3ff]/10 flex items-center justify-center">
                                  <span className="text-[#00f3ff]/40 text-[14px] font-black">S</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={ci} style={{ transform: ci === 0 ? "rotate(-10deg) translateX(6px)" : "rotate(10deg) translateX(-6px)" }}>
                            <PlayingCard card={card} className="w-[46px] h-[64px] shadow-[0_4px_20px_rgba(0,0,0,0.8)] text-[10px]" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative z-30 w-full rounded-xl px-3 py-2 mt-1" style={{ background: "rgba(15,15,20,0.92)", backdropFilter: "blur(12px)" }}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white/60 text-[12px] whitespace-nowrap" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>Seat {i + 1}:</span>
                    <span className={cn("font-extrabold text-[12px] uppercase truncate", isMe ? "text-[#00f3ff]" : "text-white")} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>{player.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/80 text-[12px]" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                      STACK: <span className="text-white font-bold">${formatChips(player.chips)}</span>
                    </span>
                    {player.currentBet > 0 && (
                      <span className="text-[#d4af37] text-[12px] font-bold" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                        ${formatChips(player.currentBet)}
                      </span>
                    )}
                    {isFolded && (
                      <span className="text-red-400 text-[10px] font-bold uppercase">Fold</span>
                    )}
                  </div>
                </div>

                {player.currentBet > 0 && (
                  <div className="absolute z-40" style={{ left: "50%", bottom: "-12px", transform: "translateX(-50%)" }}>
                    <div className="flex items-center gap-0.5">
                      <div className="w-4 h-4 rounded-full border-2 border-[#d4af37] bg-[#1a1a12]" style={{ boxShadow: "0 0 6px rgba(212,175,55,0.4)" }} />
                      <div className="w-4 h-4 rounded-full border-2 border-[#d4af37] bg-[#1a1a12] -ml-1.5" style={{ boxShadow: "0 0 6px rgba(212,175,55,0.4)" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="absolute z-20 flex items-center gap-2" style={{ left: "42%", top: "32%", transform: "translateX(-50%)" }}>
          {(gameState.communityCards || []).map((card, i) => (
            <div key={`cc-${i}`}>
              <PlayingCard card={card} className="w-[72px] h-[100px] shadow-[0_4px_20px_rgba(0,0,0,0.9)] text-sm" animate={true} delay={i < 3 ? i * 0.15 : 0} />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-40" style={{ right: "200px" }}>
        <div className="flex items-end justify-center px-4 pb-3">
          <div className="flex flex-col items-center gap-2 max-w-[600px] pb-1">
            {actionError && (
              <div className="px-3 py-1.5 bg-[#ff003c]/20 border border-[#ff003c]/40 rounded-lg text-[#ff003c] text-[11px] font-medium">
                {actionError}
              </div>
            )}

            {isSeated && myPlayer && myPlayer.userId === user?.id && myPlayer.holeCards && myPlayer.holeCards.length === 2 && myPlayer.holeCards[0].suit !== "back" && (
              <div className="flex items-end gap-2 mb-1">
                {myPlayer.holeCards.map((c, idx) => (
                  <div key={idx} style={{ transform: `rotate(${idx === 0 ? -3 : 3}deg)`, transformOrigin: "bottom center" }}>
                    <PlayingCard card={c} className="w-[80px] h-[112px] shadow-[0_0_20px_rgba(0,0,0,0.6)] text-base" />
                  </div>
                ))}
              </div>
            )}

            {isSeated && isMyTurn && isActive && (
              <div className="flex flex-col items-center gap-2">
                {showRaiseSlider && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c]/90 border border-[#d4af37]/30 rounded-lg">
                    <input
                      type="range"
                      min={minRaise}
                      max={myPlayer!.chips + myPlayer!.currentBet}
                      step={gameState.bigBlind}
                      value={raiseAmount || minRaise}
                      onChange={(e) => setRaiseAmount(Number(e.target.value))}
                      className="w-32 accent-[#d4af37]"
                    />
                    <span className="text-[#d4af37] text-xs font-mono w-16 text-right">${formatChips(raiseAmount || minRaise)}</span>
                    <button
                      onClick={() => { doAction("raise", raiseAmount || minRaise); setShowRaiseSlider(false); }}
                      className="px-3 py-1.5 bg-[#d4af37] text-[#0a0a0c] text-[10px] font-black uppercase rounded"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setShowRaiseSlider(false)} className="text-white/40 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-stretch rounded-lg overflow-hidden" style={{ boxShadow: "0 0 20px rgba(0,0,0,0.4)" }}>
                  <button onClick={() => doAction("fold")} className="px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all bg-[#ff003c] text-white hover:bg-[#ff003c]/80">
                    Fold
                  </button>
                  {canCheck ? (
                    <button onClick={() => doAction("check")} className="px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all bg-[#1a2030] text-white border-x border-white/10 hover:bg-[#252d40]">
                      Check
                    </button>
                  ) : (
                    <button onClick={() => doAction("call")} className="px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all bg-[#1a2030] text-white border-x border-white/10 hover:bg-[#252d40]">
                      Call ${formatChips(toCall)}
                    </button>
                  )}
                  <button onClick={() => { setRaiseAmount(minRaise); setShowRaiseSlider(!showRaiseSlider); }} className="px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all bg-[#1a2030] text-white border-r border-white/10 hover:bg-[#252d40]">
                    Raise
                  </button>
                  <button onClick={() => doAction("all_in")} className="px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all bg-[#1a2030] text-white hover:bg-[#252d40]">
                    All-In
                  </button>
                </div>
              </div>
            )}

            {isSeated && gameState.phase === "waiting" && gameState.players.length >= 2 && (
              <button
                onClick={handleStartHand}
                className="px-8 py-3 rounded-xl font-display font-black uppercase tracking-[0.2em] text-sm transition-all"
                style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", color: "#0a0a0c", boxShadow: "0 0 25px rgba(0,243,255,0.3)" }}
              >
                Deal Hand
              </button>
            )}

            {isSeated && gameState.phase === "showdown" && gameState.players.filter(p => p.chips > 0).length >= 2 && (
              <button
                onClick={handleStartHand}
                className="px-8 py-3 rounded-xl font-display font-black uppercase tracking-[0.2em] text-sm transition-all"
                style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", color: "#0a0a0c", boxShadow: "0 0 25px rgba(0,243,255,0.3)" }}
              >
                Next Hand
              </button>
            )}

            {isSeated && gameState.phase === "waiting" && gameState.players.length < 2 && (
              <div className="px-6 py-3 bg-[#0a0a0c]/80 border border-white/10 rounded-xl">
                <span className="text-white/50 text-sm font-display">Waiting for more players...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-[210px] z-50 flex items-start gap-2">
        {isSeated && (gameState.phase === "waiting" || gameState.phase === "showdown") && (
          <button onClick={handleLeave} className="px-2.5 py-1.5 bg-[#0a0a0c]/60 backdrop-blur-md border border-[#ff003c]/30 rounded-lg text-[#ff003c] text-[10px] font-bold hover:bg-[#ff003c]/10 transition-all">
            <LogOut className="w-3 h-3 inline mr-1" /> Cash Out
          </button>
        )}
        <Link href="/">
          <button className="px-2.5 py-1.5 bg-[#0a0a0c]/60 backdrop-blur-md border border-white/10 rounded-lg text-white/50 text-[10px] hover:text-white transition-all">
            <LogOut className="w-3 h-3 inline mr-1" /> Lobby
          </button>
        </Link>
      </div>

      <div className="absolute top-0 right-0 bottom-0 w-[200px] z-30 flex flex-col border-l border-[#00f3ff]/10 bg-[#0a0a0c]/70 backdrop-blur-md">
        <div className="p-3 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-xs font-bold">Chat</span>
            <span className={cn("w-2 h-2 rounded-full", connected ? "bg-green-500" : "bg-red-500")} />
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
            {chatMessages.map((c, i) => (
              <div key={i} className="text-[10px] leading-relaxed">
                <span className="text-[#00f3ff]/80 font-bold">{c.username}:</span>{" "}
                <span className="text-white/60">{c.message}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <p className="text-white/20 text-[10px]">No messages yet</p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <input
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Type a message..."
              className="flex-1 px-2 py-1.5 bg-[#0a0a0c]/80 border border-white/[0.08] rounded-lg text-white text-[10px] placeholder:text-white/20 focus:border-[#00f3ff]/30 focus:outline-none"
            />
            <button onClick={handleSendChat} className="p-1.5 text-[#00f3ff]/60 hover:text-[#00f3ff] transition-colors">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="mb-3">
            <span className="text-[#00f3ff]/60 text-[9px] font-black uppercase tracking-[0.15em]">Hand History</span>
            <div className="mt-2 space-y-0.5 max-h-[300px] overflow-y-auto">
              {actionLog.map((log, i) => (
                <div key={i} className={cn("text-[9px] leading-relaxed", log.startsWith("---") ? "text-[#00f3ff]/60 font-bold" : log.includes("wins") ? "text-[#d4af37] font-bold" : "text-white/40")}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-3">
            <span className="text-[#00f3ff]/60 text-[9px] font-black uppercase tracking-[0.15em]">Players ({gameState.players.length})</span>
            <div className="mt-2 space-y-1">
              {gameState.players.map(p => (
                <div key={p.seatIndex} className="flex items-center justify-between text-[10px]">
                  <span className={cn("truncate", p.userId === user?.id ? "text-[#00f3ff]" : "text-white/60")}>{p.displayName}</span>
                  <span className="text-white/40 font-mono">${formatChips(p.chips)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showJoinDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-[400px] bg-[#0a0a0c]/90 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-xl font-display font-black text-[#00f3ff] uppercase tracking-wider mb-1">Take a Seat</h2>
              <p className="text-white/50 text-sm mb-6">Seat {(joinSeat ?? 0) + 1} at {gameState.tableName}</p>

              <div className="mb-4">
                <label className="text-white/60 text-xs font-bold mb-1 block">Buy-In Amount</label>
                <input
                  type="number"
                  value={joinBuyIn}
                  onChange={(e) => setJoinBuyIn(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#0a0a0c] border border-white/10 rounded-xl text-white text-lg font-mono focus:border-[#00f3ff]/50 focus:outline-none"
                />
                <p className="text-white/30 text-[10px] mt-1">
                  Min: ${formatChips(gameState.smallBlind * 20)} — Max: ${formatChips(gameState.bigBlind * 100)}
                </p>
              </div>

              {actionError && (
                <div className="mb-4 px-3 py-2 bg-[#ff003c]/10 border border-[#ff003c]/30 rounded-lg text-[#ff003c] text-xs">
                  {actionError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleJoin}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-display font-black uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", color: "#0a0a0c", boxShadow: "0 0 25px rgba(0,243,255,0.3)" }}
                >
                  {isLoading ? "Joining..." : "Sit Down"}
                </button>
                <button
                  onClick={() => { setShowJoinDialog(false); setActionError(""); }}
                  className="flex-1 py-3 bg-transparent border border-white/15 text-white/60 font-display font-bold uppercase tracking-wider text-sm rounded-xl hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
