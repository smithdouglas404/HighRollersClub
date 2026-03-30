import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useGetTable, useGetGameState, usePerformAction, useGetCurrentUser, GameActionAction } from "@workspace/api-client-react";
import { useGamePolling } from "@/hooks/use-polling";
import { PlayingCard } from "@/components/poker/playing-card";
import { cn, formatChips } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Pause, Play, UserPlus, X, DollarSign, LogOut, Send, ExternalLink, CheckCircle, Lock } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const AVATARS = [
  "avatar-neon-fox.jpg", "avatar-neon-viper.jpg", "avatar-oracle-seer.jpg",
  "avatar-punk-duchess.jpg", "avatar-red-wolf.jpg", "avatar-shadow-king.jpg",
  "avatar-steel-ghost.jpg", "avatar-street-racer.jpg", "avatar-tech-monk.jpg",
  "avatar-void-witch.jpg",
];

const RING_COLORS = [
  "#00f3ff", "#ff003c", "#d4af37", "#a855f7", "#ff003c",
  "#00f3ff", "#22c55e", "#ff003c", "#00f3ff", "#a855f7",
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

const PLAYER_NAMES = ["AceHunter", "BluffMast", "ChipQueen", "DealerDan", "PocketRkt", "RiverRat", "Jaitey5", "Kumathr23", "Meorin34", "Movs503"];

type SimCard = { rank: string; suit: string };
type SimPhase = "preflop" | "flop" | "turn" | "river" | "showdown" | "winner";
type PlayerStatus = "active" | "folded" | "allin";

interface SimPlayer {
  name: string;
  chips: number;
  avatar: string;
  status: PlayerStatus;
  holeCards: SimCard[];
  currentBet: number;
  isDealer: boolean;
  seatNum: number;
}

const FULL_DECK: SimCard[] = [];
for (const suit of ["hearts", "diamonds", "clubs", "spades"]) {
  for (const rank of ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]) {
    FULL_DECK.push({ rank, suit });
  }
}

function shuffleDeck(): SimCard[] {
  const deck = [...FULL_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handRankName(cards: SimCard[]): string {
  const ranks = cards.map(c => "23456789TJQKA".indexOf(c.rank === "10" ? "T" : c.rank));
  const suits = cards.map(c => c.suit);
  const rankCounts: Record<number, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = suits.filter(s => s === suits[0]).length >= 5 || new Set(suits).size <= 2;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  const isStraight = uniqueRanks.length >= 5 && uniqueRanks.some((_, i) => {
    if (i + 4 >= uniqueRanks.length) return false;
    return uniqueRanks[i + 4] - uniqueRanks[i] === 4;
  });

  if (counts[0] === 4) return "Four of a Kind";
  if (counts[0] === 3 && counts[1] >= 2) return "Full House";
  if (isFlush && isStraight) return "Straight Flush";
  if (isFlush) return "Flush";
  if (isStraight) return "Straight";
  if (counts[0] === 3) return "Three of a Kind";
  if (counts[0] === 2 && counts[1] === 2) return "Two Pair";
  if (counts[0] === 2) return "Pair";
  return "High Card";
}

const ACTION_STYLES: Record<string, { text: string; bg: string; border: string; color: string }> = {
  fold: { text: "FOLD", bg: "rgba(100,100,100,0.6)", border: "rgba(100,100,100,0.5)", color: "#ccc" },
  call: { text: "CALL", bg: "rgba(0,243,255,0.25)", border: "rgba(0,243,255,0.5)", color: "#00f3ff" },
  raise: { text: "RAISE", bg: "rgba(212,175,55,0.25)", border: "rgba(212,175,55,0.5)", color: "#d4af37" },
  check: { text: "CHECK", bg: "rgba(34,197,94,0.25)", border: "rgba(34,197,94,0.5)", color: "#22c55e" },
  allin: { text: "ALL-IN", bg: "rgba(255,0,60,0.35)", border: "rgba(255,0,60,0.6)", color: "#ff003c" },
};

const MOCK_CHAT = [
  { user: "MannetorusInofis", msg: "🤘" },
  { user: "Live_ailor", msg: "this hmes" },
  { user: "ManvetoushI058", msg: "😅" },
  { user: "Sangeoisans", msg: "We recenly know stagatioed" },
  { user: "Live_elenus", msg: "No vesoy 🥴" },
  { user: "Mathaeckowse", msg: "😅😅😅" },
  { user: "Live_krieort", msg: "👍👍👍" },
];

function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-[#0a0a0c]/70 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl", className)}>
      {children}
    </div>
  );
}

export function PokerTable() {
  const { id } = useParams();
  const tableId = parseInt(id || "0", 10);
  const { data: user } = useGetCurrentUser();
  const { data: table, isLoading: tableLoading } = useGetTable(tableId);
  const performAction = usePerformAction();

  const dealtCountRef = useRef(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [showWaitingList, setShowWaitingList] = useState(false);
  const [showApprovePlayer, setShowApprovePlayer] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [chatMsg, setChatMsg] = useState("");

  const [simPhase, setSimPhase] = useState<SimPhase>("preflop");
  const [simPlayers, setSimPlayers] = useState<SimPlayer[]>([]);
  const [communityCards, setCommunityCards] = useState<SimCard[]>([]);
  const [pot, setPot] = useState(0);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [heroCards, setHeroCards] = useState<SimCard[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [winnerHand, setWinnerHand] = useState("");
  const [handNum, setHandNum] = useState(1);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const deckRef = useRef<SimCard[]>([]);
  const dealerRef = useRef(0);
  const handNumRef = useRef(1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const HERO_SEAT = 5;
  const SB = 500;
  const BB = 1000;
  const FOLD_SEATS = [2, 5, 8];

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const runSimulation = useCallback(() => {
    clearTimers();
    const deck = shuffleDeck();
    let cardIdx = 0;
    const di = dealerRef.current;

    const players: SimPlayer[] = Array.from({ length: 10 }, (_, i) => ({
      name: PLAYER_NAMES[i],
      chips: 15000 + Math.floor(Math.random() * 20000),
      avatar: `${BASE}images/${AVATARS[i % AVATARS.length]}`,
      status: "active" as PlayerStatus,
      holeCards: [deck[cardIdx++]!, deck[cardIdx++]!],
      currentBet: 0,
      isDealer: i === di,
      seatNum: i + 1,
    }));

    const sbIdx = (di + 1) % 10;
    const bbIdx = (di + 2) % 10;
    players[sbIdx].chips -= SB;
    players[sbIdx].currentBet = SB;
    players[bbIdx].chips -= BB;
    players[bbIdx].currentBet = BB;

    const remainingDeck = deck.slice(cardIdx);
    let deckPos = 0;
    let currentPot = SB + BB;
    let currentPlayers = [...players];
    const hn = handNumRef.current;

    setSimPlayers([...players]);
    setHeroCards(players[HERO_SEAT].holeCards);
    setCommunityCards([]);
    setPot(currentPot);
    setSimPhase("preflop");
    setWinnerIndex(null);
    setWinnerHand("");
    setHandNum(hn);
    setDealerIndex(di);
    setActionLog([
      `Hand #${hn} — Dealer: ${players[di].name}`,
      `${players[sbIdx].name} posts SB $${formatChips(SB)}`,
      `${players[bbIdx].name} posts BB $${formatChips(BB)}`,
    ]);
    dealtCountRef.current = 0;

    let t = 1500;

    for (let step = 0; step < 10; step++) {
      const pIdx = (di + 3 + step) % 10;
      const capturedT = t;
      schedule(() => {
        currentPlayers = currentPlayers.map((p, i) => {
          if (i !== pIdx) return p;
          if (FOLD_SEATS.includes(i)) {
            return { ...p, status: "folded" as PlayerStatus };
          }
          const callAmt = BB - p.currentBet;
          currentPot += callAmt;
          return { ...p, chips: p.chips - callAmt, currentBet: BB };
        });
        setSimPlayers([...currentPlayers]);
        setPot(currentPot);
        if (FOLD_SEATS.includes(pIdx)) {
          setActionLog(al => [...al, `${currentPlayers[pIdx].name} folds`]);
        } else {
          setActionLog(al => [...al, `${currentPlayers[pIdx].name} calls $${formatChips(BB)}`]);
        }
      }, capturedT);
      t += 800;
    }

    t += 500;
    schedule(() => {
      currentPlayers = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
      const flop = remainingDeck.slice(deckPos, deckPos + 3);
      deckPos += 3;
      setSimPlayers([...currentPlayers]);
      setCommunityCards(flop);
      setSimPhase("flop");
      setActionLog(al => [...al, `--- FLOP: ${flop.map(c => `${c.rank}${c.suit[0]}`).join(" ")} ---`]);
    }, t);

    t += 2000;
    schedule(() => {
      const active = currentPlayers.filter(p => p.status !== "folded");
      let betTotal = 0;
      currentPlayers = currentPlayers.map(p => {
        if (p.status === "folded") return p;
        betTotal += 1000;
        return { ...p, chips: p.chips - 1000, currentBet: 1000 };
      });
      currentPot += betTotal;
      setSimPlayers([...currentPlayers]);
      setPot(currentPot);
      setActionLog(al => [...al, ...active.map(p => `${p.name} bets $${formatChips(1000)}`)]);
    }, t);

    t += 2000;
    schedule(() => {
      currentPlayers = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
      const turn = [remainingDeck[deckPos]!];
      deckPos += 1;
      setSimPlayers([...currentPlayers]);
      setCommunityCards(prev => [...prev, ...turn]);
      setSimPhase("turn");
      setActionLog(al => [...al, `--- TURN: ${turn[0].rank}${turn[0].suit[0]} ---`]);
    }, t);

    t += 2000;
    schedule(() => {
      const active = currentPlayers.filter(p => p.status !== "folded");
      let betTotal = 0;
      currentPlayers = currentPlayers.map(p => {
        if (p.status === "folded") return p;
        betTotal += 2000;
        return { ...p, chips: p.chips - 2000, currentBet: 2000 };
      });
      currentPot += betTotal;
      setSimPlayers([...currentPlayers]);
      setPot(currentPot);
      setActionLog(al => [...al, ...active.map(p => `${p.name} bets $${formatChips(2000)}`)]);
    }, t);

    t += 2000;
    schedule(() => {
      currentPlayers = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
      const river = [remainingDeck[deckPos]!];
      deckPos += 1;
      setSimPlayers([...currentPlayers]);
      setCommunityCards(prev => [...prev, ...river]);
      setSimPhase("river");
      setActionLog(al => [...al, `--- RIVER: ${river[0].rank}${river[0].suit[0]} ---`]);
    }, t);

    t += 2000;
    schedule(() => {
      const active = currentPlayers.filter(p => p.status !== "folded");
      let betTotal = 0;
      currentPlayers = currentPlayers.map(p => {
        if (p.status === "folded") return p;
        betTotal += 3000;
        return { ...p, chips: p.chips - 3000, currentBet: 3000 };
      });
      currentPot += betTotal;
      setSimPlayers([...currentPlayers]);
      setPot(currentPot);
      setActionLog(al => [...al, ...active.map(p => `${p.name} bets $${formatChips(3000)}`)]);
    }, t);

    t += 2500;
    schedule(() => {
      currentPlayers = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
      setSimPlayers([...currentPlayers]);
      setSimPhase("showdown");
    }, t);

    t += 1500;
    schedule(() => {
      const activePlrs = currentPlayers.filter(p => p.status !== "folded");
      const allComm = remainingDeck.slice(0, deckPos);
      const flopCards = allComm.slice(0, 3);
      const turnCard = allComm[3];
      const riverCard = allComm[4];
      const commCards = [flopCards[0], flopCards[1], flopCards[2], turnCard, riverCard].filter(Boolean) as SimCard[];

      let bestIdx = -1;
      let bestRank = -1;
      const rankOrder = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];

      activePlrs.forEach(p => {
        const allCards = [...p.holeCards, ...commCards];
        const hand = handRankName(allCards);
        const rank = rankOrder.indexOf(hand);
        const pIdx = currentPlayers.findIndex(sp => sp.name === p.name);
        if (rank > bestRank || (rank === bestRank && bestIdx === -1)) {
          bestRank = rank;
          bestIdx = pIdx;
        }
      });

      if (bestIdx >= 0) {
        const winner = currentPlayers[bestIdx];
        const allCards = [...winner.holeCards, ...commCards];
        const hand = handRankName(allCards);
        currentPlayers[bestIdx] = { ...currentPlayers[bestIdx], chips: currentPlayers[bestIdx].chips + currentPot };
        setSimPlayers([...currentPlayers]);
        setWinnerIndex(bestIdx);
        setWinnerHand(hand);
        setActionLog(al => [...al, `🏆 ${winner.name} wins $${formatChips(currentPot)} with ${hand}!`]);
      }
      setSimPhase("winner");
    }, t);

    t += 6000;
    schedule(() => {
      dealerRef.current = (dealerRef.current + 1) % 10;
      handNumRef.current += 1;
      dealtCountRef.current = 0;
      runSimulation();
    }, t);
  }, []);

  useEffect(() => {
    runSimulation();
    return () => clearTimers();
  }, []);

  if (tableLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-14 h-14 border-4 border-[#00f3ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] text-white font-display">
        Table not found
      </div>
    );
  }

  const mockWaitingList = [
    { name: "User_A", avatar: "avatar-void-witch.jpg", bankroll: 500000, walletBalance: 2500000 },
    { name: "User_B", avatar: "avatar-street-racer.jpg", bankroll: 750000, walletBalance: 1000000 },
    { name: "User_C", avatar: "avatar-tech-monk.jpg", bankroll: 400000, walletBalance: 3250000 },
  ];

  const phaseLabel = simPhase === "preflop" ? "Pre-Flop" : simPhase === "flop" ? "Flop" : simPhase === "turn" ? "Turn" : simPhase === "river" ? "River" : simPhase === "showdown" ? "Showdown" : "Winner";

  return (
    <div className="w-full h-screen relative overflow-hidden bg-[#0a0a0c]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-[#00f3ff]/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-purple-600/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-3 left-4 z-50">
        <GlassPanel className="px-5 py-3">
          <h2 className="text-white font-display font-black text-base tracking-tight">High Rollers Main</h2>
          <p className="text-[#00f3ff] text-[11px] font-mono tracking-wider">$5/$10 NLH</p>
          <p className="text-white/50 text-[11px]">Round: <span className="text-[#00f3ff] font-bold">{phaseLabel}</span></p>
          <p className="text-white/30 text-[11px] font-mono">Hand #{handNum}</p>
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

        {pot > 0 && (
          <div className="absolute z-20 flex flex-col items-center" style={{ left: "42%", top: "24%", transform: "translateX(-50%)" }}>
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full" style={{ background: "rgba(15,15,20,0.85)", border: "1px solid rgba(212,175,55,0.3)", boxShadow: "0 0 15px rgba(212,175,55,0.15)" }}>
              <DollarSign className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-[#d4af37] font-display font-black text-sm tracking-wide">{formatChips(pot)}</span>
            </div>
          </div>
        )}

        {simPlayers.map((p, i) => {
          const seat = SEAT_POSITIONS[i];
          if (!seat) return null;
          const isShowdown = simPhase === "showdown" || simPhase === "winner";
          const showCards = isShowdown && p.status !== "folded";
          const isWinner = winnerIndex === i;
          return (
            <div key={i} className="absolute z-30" style={{ left: seat.left, top: seat.top, transform: "translate(-50%, -50%)" }}>
              <div className={cn("relative w-[150px]", isWinner && "ring-2 ring-[#d4af37] rounded-xl")} style={isWinner ? { boxShadow: "0 0 25px rgba(212,175,55,0.5)" } : {}}>
                {p.isDealer && (
                  <div className="absolute -top-2 -right-2 z-40 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg" style={{ border: "2px solid #d4af37" }}>
                    <span className="text-[10px] font-black text-gray-900">D</span>
                  </div>
                )}

                <div className="relative w-full h-[140px] overflow-visible">
                  <img src={p.avatar} alt="" className={cn("absolute inset-0 w-full h-full object-cover object-top rounded-t-xl", p.status === "folded" && "opacity-40 grayscale")} />
                  <div className="absolute inset-0 rounded-t-xl" style={{ background: "linear-gradient(180deg, transparent 30%, rgba(10,10,12,0.8) 100%)" }} />

                  {p.status !== "folded" && !showCards && (
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

                  {showCards && p.holeCards.length === 2 && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex z-20" style={{ bottom: "-4px" }}>
                      {p.holeCards.map((card, ci) => {
                        const isRed = card.suit === "hearts" || card.suit === "diamonds";
                        const suitChar = card.suit === "spades" ? "♠" : card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : "♣";
                        return (
                          <div key={ci} className="w-[46px] h-[64px] rounded-md bg-white flex flex-col items-center justify-between py-1 px-1" style={{ transform: ci === 0 ? "rotate(-10deg) translateX(6px)" : "rotate(10deg) translateX(-6px)", boxShadow: "0 4px 20px rgba(0,0,0,0.8)", border: "1px solid rgba(220,220,220,0.5)" }}>
                            <span className={cn("text-[14px] font-black leading-none self-start", isRed ? "text-red-600" : "text-gray-900")}>{card.rank}</span>
                            <span className={cn("text-[22px] leading-none", isRed ? "text-red-600" : "text-gray-900")}>{suitChar}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative z-30 w-full rounded-xl px-3 py-2 mt-1" style={{ background: "rgba(15,15,20,0.92)", backdropFilter: "blur(12px)" }}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white/60 text-[12px] whitespace-nowrap" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>Player {p.seatNum}:</span>
                    <span className="text-white font-extrabold text-[12px] uppercase truncate" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>{p.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/80 text-[12px]" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                      STACK: <span className="text-white font-bold">${formatChips(p.chips)}</span>
                    </span>
                    {p.currentBet > 0 && (
                      <span className="text-[#d4af37] text-[12px] font-bold" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                        ${formatChips(p.currentBet)}
                      </span>
                    )}
                    {p.status === "folded" && (
                      <span className="text-red-400 text-[10px] font-bold uppercase">Fold</span>
                    )}
                  </div>
                  {isWinner && (
                    <div className="mt-1 text-center">
                      <span className="text-[#d4af37] text-[10px] font-black uppercase tracking-wider animate-pulse">WINNER - {winnerHand}</span>
                    </div>
                  )}
                </div>

                {p.currentBet > 0 && (
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
          {communityCards.map((card, i) => {
            const isNew = i >= dealtCountRef.current;
            const flopDelay = i < 3 ? i * 0.15 : 0;
            return (
              <div key={`cc-${i}`}>
                <PlayingCard card={card} className="w-[72px] h-[100px] shadow-[0_4px_20px_rgba(0,0,0,0.9)] text-sm" animate={isNew} delay={flopDelay} />
              </div>
            );
          })}
          {(() => { dealtCountRef.current = communityCards.length; return null; })()}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-40" style={{ right: "200px" }}>
        <div className="flex items-end justify-center px-4 pb-3">
          <div className="flex flex-col items-center gap-2 max-w-[550px] pb-1">
            {heroCards.length > 0 && (
              <div className="flex items-end gap-2 mb-1">
                {heroCards.map((c, idx) => (
                  <div key={idx} style={{ transform: `rotate(${idx === 0 ? -3 : 3}deg)`, transformOrigin: "bottom center" }}>
                    <PlayingCard card={c} className="w-[80px] h-[112px] shadow-[0_0_20px_rgba(0,0,0,0.6)] text-base" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-stretch rounded-lg overflow-hidden" style={{ boxShadow: "0 0 20px rgba(0,0,0,0.4)" }}>
              <button className={cn("px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all", "bg-[#ff003c] text-white", "hover:bg-[#ff003c]/80")}>
                Fold
              </button>
              <button className={cn("px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all", "bg-[#1a2030] text-white border-x border-white/10", "hover:bg-[#252d40]")}>
                Check/Call $1.0k
              </button>
              <button className={cn("px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all", "bg-[#1a2030] text-white border-r border-white/10", "hover:bg-[#252d40]")}>
                Raise
              </button>
              <button className={cn("px-5 py-3 font-display font-black text-xs uppercase tracking-widest transition-all", "bg-[#1a2030] text-white", "hover:bg-[#252d40]")}>
                All-In
              </button>
            </div>
          </div>
        </div>
      </div>

      {simPhase === "winner" && winnerIndex !== null && (
        <div className="absolute z-50 flex items-center justify-center" style={{ left: "42%", top: "18%", transform: "translateX(-50%)" }}>
          <div className="px-6 py-3 rounded-xl animate-pulse" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))", border: "2px solid #d4af37", boxShadow: "0 0 30px rgba(212,175,55,0.3)" }}>
            <span className="text-[#d4af37] font-display font-black text-lg tracking-wider">
              🏆 {simPlayers[winnerIndex]?.name} wins ${formatChips(pot)} with {winnerHand}!
            </span>
          </div>
        </div>
      )}

      <div className="absolute top-0 right-0 bottom-0 w-[200px] z-30 flex flex-col border-l border-[#00f3ff]/10 bg-[#0a0a0c]/70 backdrop-blur-md">
        <div className="p-3 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-xs font-bold">Chat</span>
            <button className="text-white/30 hover:text-white/60 text-xs">▽</button>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
            {MOCK_CHAT.map((c, i) => (
              <div key={i} className="text-[10px] leading-relaxed">
                <span className="text-[#00f3ff]/80 font-bold">{c.user}:</span>{" "}
                <span className="text-white/60">{c.msg}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Type a message..." className="flex-1 px-2 py-1.5 bg-[#0a0a0c]/80 border border-white/[0.08] rounded-lg text-white text-[10px] placeholder:text-white/20 focus:border-[#00f3ff]/30 focus:outline-none" />
            <button className="p-1.5 text-[#00f3ff]/60 hover:text-[#00f3ff] transition-colors">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="mb-3">
            <span className="text-[#00f3ff]/60 text-[9px] font-black uppercase tracking-[0.15em]">Hand History</span>
            <div className="mt-2 space-y-0.5 max-h-[300px] overflow-y-auto">
              {actionLog.map((log, i) => (
                <div key={i} className={cn("text-[9px] leading-relaxed", log.startsWith("🏆") ? "text-[#d4af37] font-bold" : log.startsWith("---") ? "text-[#00f3ff]/60 font-bold" : "text-white/40")}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-[210px] z-50 flex items-start gap-2">
        <Link href="/">
          <button className="px-2.5 py-1.5 bg-[#0a0a0c]/60 backdrop-blur-md border border-white/10 rounded-lg text-white/50 text-[10px] hover:text-white transition-all">
            <LogOut className="w-3 h-3 inline mr-1" /> Leave
          </button>
        </Link>
        <button onClick={() => setShowAdminPanel(!showAdminPanel)} className="px-2.5 py-1.5 bg-[#0a0a0c]/60 backdrop-blur-md border border-[#00f3ff]/20 rounded-lg text-[#00f3ff] text-[10px] font-bold hover:bg-[#00f3ff]/10 transition-all">
          <Settings className="w-3 h-3 inline mr-1" /> Admin
        </button>
      </div>

      <AnimatePresence>
        {showWaitingList && (
          <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="absolute top-14 right-[200px] bottom-16 w-[220px] z-[55] bg-[#0a0a0c]/80 backdrop-blur-md border-l border-white/10 p-3 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-[#00f3ff] uppercase tracking-wider text-xs">Waiting List</h3>
              <button onClick={() => setShowWaitingList(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {mockWaitingList.map((w, i) => (
                <div key={i} className="bg-[#0a0a0c]/60 border border-white/10 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#00f3ff]/30">
                      <img src={`${BASE}images/${w.avatar}`} alt={w.name} className="w-full h-full object-cover object-top" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 font-medium">{w.name}</p>
                      <p className="text-[10px] font-display font-black text-[#00f3ff]">${formatChips(w.bankroll)}</p>
                    </div>
                  </div>
                  <button className="w-full py-1.5 bg-[#00f3ff]/15 border border-[#00f3ff]/25 text-[#00f3ff] font-display font-bold uppercase tracking-wider text-[9px] rounded-lg hover:bg-[#00f3ff]/25 transition-all">Approve</button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminPanel && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-14 right-[210px] z-50">
            <GlassPanel className="overflow-hidden min-w-[180px]">
              {[
                { label: "Pause Game", icon: gamePaused ? <Play className="w-4 h-4 text-[#00f3ff]" /> : <Pause className="w-4 h-4" />, action: () => setGamePaused(!gamePaused) },
                { label: "Manage Table", icon: <Settings className="w-4 h-4" />, action: () => { setShowTableSettings(true); setShowAdminPanel(false); } },
                { label: "Approve Players", icon: <UserPlus className="w-4 h-4 text-[#ff003c]" />, action: () => { setShowWaitingList(!showWaitingList); setShowAdminPanel(false); } },
              ].map((item) => (
                <button key={item.label} onClick={item.action} className="flex items-center justify-between w-full gap-4 px-3 py-2.5 text-white/80 text-[11px] font-medium hover:bg-[#00f3ff]/10 transition-all">
                  <span>{item.label}</span>
                  {item.icon}
                </button>
              ))}
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gamePaused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-[400px] bg-[#0a0a0c]/90 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
              <h2 className="text-3xl font-display font-black text-[#00f3ff] uppercase tracking-wider mb-3">Game Paused</h2>
              <p className="text-white/50 text-sm mb-8">Waiting for admin to resume...</p>
              <button onClick={() => setGamePaused(false)} className="w-full py-4 rounded-xl font-display font-black uppercase tracking-[0.2em] text-base transition-all mb-3" style={{ background: "linear-gradient(135deg, #00f3ff, #00b4cc)", color: "#0a0a0c", boxShadow: "0 0 25px rgba(0,243,255,0.3)" }}>Resume Game</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTableSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-[480px] max-h-[80vh] overflow-y-auto bg-[#0a0a0c]/90 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-display font-bold text-[#00f3ff] uppercase tracking-wider">Table Settings</h2>
                <button onClick={() => setShowTableSettings(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#00f3ff]" /> Wallet & Limits</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Wallet Limit</span>
                    <input className="w-28 px-2 py-1 input-gold-border rounded-lg text-xs text-right font-mono" defaultValue="$5,000,000" />
                  </div>
                </div>
                <div className="border-t border-white/[0.06] pt-3">
                  <h3 className="text-sm font-bold text-white/80 mb-2">Blinds</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-luxury">Small Blind</label>
                      <input className="w-full px-2 py-1 input-gold-border rounded-lg text-xs font-mono" defaultValue={`$${formatChips(table.smallBlind)}`} />
                    </div>
                    <div>
                      <label className="label-luxury">Big Blind</label>
                      <input className="w-full px-2 py-1 input-gold-border rounded-lg text-xs font-mono" defaultValue={`$${formatChips(table.bigBlind)}`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5 pt-3 border-t border-white/[0.06]">
                <button onClick={() => setShowTableSettings(false)} className="flex-1 py-2.5 rounded-xl font-display font-bold uppercase tracking-wider text-sm" style={{ background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)", color: "#0a0a0c" }}>Save & Resume</button>
                <button onClick={() => setShowTableSettings(false)} className="flex-1 py-2.5 bg-transparent border border-white/15 text-white/60 font-display font-bold uppercase tracking-wider text-sm rounded-xl hover:bg-white/5 transition-all">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
