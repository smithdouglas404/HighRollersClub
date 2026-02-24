import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  ArrowLeft, ShieldCheck, Download, Copy, Check,
  ChevronDown, ChevronUp, Clock, Coins, Trophy, User, Users
} from "lucide-react";

interface CardType {
  suit: string;
  rank: string;
}

interface HandAction {
  playerId: string;
  action: string;
  amount?: number;
  phase: string;
}

interface HandPlayer {
  id: string;
  displayName: string;
  startChips: number;
  seatIndex: number;
}

interface ShowdownResult {
  playerId: string;
  handName: string;
  cards?: CardType[];
  isWinner: boolean;
  winAmount?: number;
}

interface HandData {
  id: string;
  tableId: string;
  handNumber: number;
  communityCards: CardType[] | null;
  potTotal: number;
  winnerIds: string[] | null;
  summary: {
    handNumber: number;
    players: HandPlayer[];
    actions: HandAction[];
    communityCards: CardType[];
    pot: number;
    winners: { playerId: string; amount: number }[];
    showdownResults?: ShowdownResult[];
  } | null;
  serverSeed: string | null;
  commitmentHash: string | null;
  deckOrder: string | null;
  createdAt: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500",
  diamonds: "text-blue-400",
  clubs: "text-green-400",
  spades: "text-white",
};

const PHASE_LABELS: Record<string, string> = {
  "pre-flop": "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

const PHASE_ORDER = ["pre-flop", "flop", "turn", "river", "showdown"];

function MiniCard({ card }: { card: CardType }) {
  const color = SUIT_COLORS[card.suit] || "text-white";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-xs font-mono font-bold ${color}`}>
      {card.rank}
      <span className="text-[10px]">{SUIT_SYMBOLS[card.suit]}</span>
    </span>
  );
}

function ActionBadge({ action, amount }: { action: string; amount?: number }) {
  const configs: Record<string, { bg: string; text: string }> = {
    fold: { bg: "bg-red-500/15 border-red-500/20", text: "text-red-400" },
    check: { bg: "bg-gray-500/15 border-gray-500/20", text: "text-gray-400" },
    call: { bg: "bg-cyan-500/15 border-cyan-500/20", text: "text-cyan-400" },
    raise: { bg: "bg-amber-500/15 border-amber-500/20", text: "text-amber-400" },
    "all-in": { bg: "bg-purple-500/15 border-purple-500/20", text: "text-purple-400" },
    bet: { bg: "bg-green-500/15 border-green-500/20", text: "text-green-400" },
    "post-sb": { bg: "bg-gray-500/10 border-gray-500/15", text: "text-gray-500" },
    "post-bb": { bg: "bg-gray-500/10 border-gray-500/15", text: "text-gray-500" },
  };
  const c = configs[action] || configs.check;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.text} ${c.bg} border`}>
      {action}
      {amount !== undefined && amount > 0 && <span>{amount.toLocaleString()}</span>}
    </span>
  );
}

function PhaseSection({
  phase,
  actions,
  players,
  communityCards,
  isLast,
}: {
  phase: string;
  actions: HandAction[];
  players: HandPlayer[];
  communityCards: CardType[];
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const playerMap = new Map(players.map(p => [p.id, p]));

  // Show community cards revealed in this phase
  let phaseCards: CardType[] = [];
  if (phase === "flop") phaseCards = communityCards.slice(0, 3);
  else if (phase === "turn") phaseCards = communityCards.slice(3, 4);
  else if (phase === "river") phaseCards = communityCards.slice(4, 5);

  return (
    <div className={`${!isLast ? "border-b border-white/5" : ""}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            {PHASE_LABELS[phase] || phase}
          </span>
          {phaseCards.length > 0 && (
            <div className="flex items-center gap-1">
              {phaseCards.map((card, i) => (
                <MiniCard key={i} card={card} />
              ))}
            </div>
          )}
          <span className="text-[9px] text-gray-600">{actions.length} actions</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {actions.map((action, i) => {
                const player = playerMap.get(action.playerId);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 font-medium w-24 truncate">
                      {player?.displayName || action.playerId.slice(0, 8)}
                    </span>
                    <ActionBadge action={action.action} amount={action.amount} />
                  </div>
                );
              })}
              {actions.length === 0 && (
                <p className="text-[10px] text-gray-600 italic">No actions</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HandReplay({ handId }: { handId: string }) {
  const [, navigate] = useLocation();
  const [hand, setHand] = useState<HandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showProof, setShowProof] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hands/${handId}/verify`);
        if (!res.ok) {
          setError("Hand not found");
          setLoading(false);
          return;
        }
        const proofData = await res.json();

        // Also fetch the full hand record
        // The verify endpoint returns proof data; we need the hand record too
        const handRes = await fetch(`/api/hands/${handId}`);
        if (handRes.ok) {
          const handData = await handRes.json();
          setHand({ ...handData, ...proofData });
        } else {
          // If we only have proof data, use what we have
          setHand(proofData);
        }
      } catch {
        setError("Failed to load hand");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handId]);

  const copyHash = () => {
    if (hand?.commitmentHash) {
      navigator.clipboard.writeText(hand.commitmentHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const exportHand = () => {
    if (!hand) return;
    const blob = new Blob([JSON.stringify(hand, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hand-${hand.handNumber || handId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = hand?.summary;
  const players = summary?.players || [];
  const actions = summary?.actions || [];
  const communityCards = summary?.communityCards || hand?.communityCards || [];
  const winners = summary?.winners || [];
  const showdownResults = summary?.showdownResults;

  // Group actions by phase
  const actionsByPhase = new Map<string, HandAction[]>();
  for (const phase of PHASE_ORDER) {
    actionsByPhase.set(phase, []);
  }
  for (const action of actions) {
    const phase = action.phase || "pre-flop";
    if (!actionsByPhase.has(phase)) actionsByPhase.set(phase, []);
    actionsByPhase.get(phase)!.push(action);
  }
  // Remove empty phases (except pre-flop)
  const phases = PHASE_ORDER.filter(
    p => (actionsByPhase.get(p)?.length || 0) > 0 || p === "pre-flop"
  );

  const playerMap = new Map(players.map(p => [p.id, p]));
  const winnerPlayerIds = new Set(winners.map(w => w.playerId));

  return (
    <DashboardLayout title="Hand Replay">
      <div className="px-8 pb-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-bold uppercase tracking-wider">Back</span>
        </motion.button>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading hand...</p>
          </div>
        ) : error || !hand ? (
          <div className="text-center py-20">
            <p className="text-sm text-red-400">{error || "Hand not found"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main panel - Action Log */}
            <div className="lg:col-span-2 space-y-4">
              {/* Hand header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-5 border border-white/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Hand #{hand.handNumber || "?"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {hand.createdAt ? new Date(hand.createdAt).toLocaleString() : "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {players.length} players
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hand.commitmentHash && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                        <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
                          Verified
                        </span>
                      </div>
                    )}
                    <button
                      onClick={exportHand}
                      className="glass rounded-lg p-2 hover:bg-white/5 transition-colors"
                      title="Export hand"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Pot + Winners */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">
                      {(summary?.pot || hand.potTotal || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-amber-400/60 uppercase">pot</span>
                  </div>
                  {winners.map((w) => (
                    <div key={w.playerId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Trophy className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-bold text-green-400">
                        {playerMap.get(w.playerId)?.displayName || w.playerId.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-green-400/60">+{w.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Community Cards */}
                {communityCards && communityCards.length > 0 && (
                  <div className="mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                      Board
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(communityCards as CardType[]).map((card, i) => (
                        <MiniCard key={i} card={card} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Action Log by Street */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-xl border border-white/5 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Action Log
                  </h3>
                </div>
                {phases.length > 0 ? (
                  phases.map((phase, i) => (
                    <PhaseSection
                      key={phase}
                      phase={phase}
                      actions={actionsByPhase.get(phase) || []}
                      players={players}
                      communityCards={communityCards as CardType[]}
                      isLast={i === phases.length - 1}
                    />
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-gray-600">
                    No action data available for this hand
                  </div>
                )}
              </motion.div>

              {/* Showdown Results */}
              {showdownResults && showdownResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass rounded-xl border border-white/5 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-white/5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Showdown
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {showdownResults.map((result, i) => {
                      const player = playerMap.get(result.playerId);
                      const winner = winners.find(w => w.playerId === result.playerId);
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            result.isWinner
                              ? "bg-green-500/10 border border-green-500/20"
                              : "bg-white/[0.02] border border-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              result.isWinner ? "bg-green-500/20" : "bg-white/5"
                            }`}>
                              {result.isWinner ? (
                                <Trophy className="w-4 h-4 text-green-400" />
                              ) : (
                                <User className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">
                                {player?.displayName || result.playerId.slice(0, 8)}
                              </div>
                              <div className="text-[10px] text-gray-500">{result.handName}</div>
                            </div>
                            {result.cards && (
                              <div className="flex items-center gap-1 ml-2">
                                {result.cards.map((card, j) => (
                                  <MiniCard key={j} card={card} />
                                ))}
                              </div>
                            )}
                          </div>
                          {winner && (
                            <span className="text-sm font-bold text-green-400">
                              +{winner.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right panel - Players + Provably Fair */}
            <div className="space-y-4">
              {/* Players */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Players
                </h3>
                <div className="space-y-2">
                  {players.map((player) => {
                    const isWinner = winnerPlayerIds.has(player.id);
                    const winAmount = winners.find(w => w.playerId === player.id)?.amount;
                    return (
                      <div key={player.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isWinner
                              ? "bg-green-500/20 text-green-400 border border-green-500/20"
                              : "bg-white/5 text-gray-400 border border-white/5"
                          }`}>
                            {player.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-white">{player.displayName}</div>
                            <div className="text-[9px] text-gray-600">
                              Seat {player.seatIndex + 1} &middot; {player.startChips.toLocaleString()} chips
                            </div>
                          </div>
                        </div>
                        {isWinner && winAmount && (
                          <span className="text-[10px] font-bold text-green-400">
                            +{winAmount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Provably Fair Proof */}
              {hand.commitmentHash && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="glass rounded-xl p-4 border border-green-500/10"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-green-400">
                      Provably Fair
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">
                        Commitment Hash
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] text-cyan-400 font-mono break-all flex-1 bg-black/30 rounded px-2 py-1">
                          {hand.commitmentHash.slice(0, 32)}...
                        </code>
                        <button
                          onClick={copyHash}
                          className="glass rounded p-1 hover:bg-white/5 transition-colors shrink-0"
                        >
                          {copiedHash ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowProof(!showProof)}
                      className="text-[10px] font-bold text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                    >
                      {showProof ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showProof ? "Hide Details" : "Show Proof Details"}
                    </button>

                    <AnimatePresence>
                      {showProof && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-2"
                        >
                          {hand.serverSeed && (
                            <div>
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">
                                Server Seed
                              </span>
                              <code className="text-[9px] text-amber-400/80 font-mono break-all block bg-black/30 rounded px-2 py-1">
                                {hand.serverSeed.slice(0, 48)}...
                              </code>
                            </div>
                          )}
                          {hand.deckOrder && (
                            <div>
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">
                                Deck Order
                              </span>
                              <code className="text-[9px] text-purple-400/80 font-mono break-all block bg-black/30 rounded px-2 py-1 max-h-20 overflow-y-auto">
                                {hand.deckOrder}
                              </code>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5">
                    <span className="text-[8px] text-gray-600 uppercase tracking-wider">
                      HMAC-SHA256 Fisher-Yates + SHA-512 Entropy
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

