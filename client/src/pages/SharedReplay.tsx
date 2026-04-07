import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShareReplayButton } from "@/components/poker/ShareReplayButton";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Play,
  Trophy,
  Coins,
  Users,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  XCircle,
  ExternalLink,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CardType {
  suit: string;
  rank: string;
}

interface HandAction {
  playerId: string;
  action: string;
  amount?: number;
  phase: string;
  sequenceNum: number;
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

// ─── Constants ──────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "#ef4444",
  diamonds: "#60a5fa",
  clubs: "#4ade80",
  spades: "#e5e7eb",
};

const PHASE_LABELS: Record<string, string> = {
  "pre-flop": "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

const PHASE_ORDER = ["pre-flop", "flop", "turn", "river", "showdown"];

const ACTION_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  fold: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#f87171" },
  check: { bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)", text: "#9ca3af" },
  call: { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.2)", text: "#d4af37" },
  raise: { bg: "rgba(212,175,55,0.1)", border: "rgba(212,175,55,0.25)", text: "#d4af37" },
  bet: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", text: "#4ade80" },
  "all-in": { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.25)", text: "#a855f7" },
  "post-sb": { bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)", text: "#6b7280" },
  "post-bb": { bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)", text: "#6b7280" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    "post-sb": "posted small blind",
    "post-bb": "posted big blind",
    fold: "folded",
    check: "checked",
    call: "called",
    raise: "raised to",
    bet: "bet",
    "all-in": "went all-in",
  };
  return labels[action] ?? action;
}

function getPhaseCards(phase: string, communityCards: CardType[]): CardType[] {
  if (phase === "flop") return communityCards.slice(0, 3);
  if (phase === "turn") return communityCards.slice(0, 4);
  if (phase === "river") return communityCards.slice(0, 5);
  return [];
}

function getNewCardsForPhase(phase: string, communityCards: CardType[]): CardType[] {
  if (phase === "flop") return communityCards.slice(0, 3);
  if (phase === "turn") return communityCards.slice(3, 4);
  if (phase === "river") return communityCards.slice(4, 5);
  return [];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CardDisplay({ card, delay = 0 }: { card: CardType; delay?: number }) {
  const color = SUIT_COLORS[card.suit] ?? "#e5e7eb";
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className="inline-flex flex-col items-center justify-center rounded-lg font-mono font-bold select-none"
      style={{
        width: 44,
        height: 62,
        background: "linear-gradient(145deg, #1a2332 0%, #0f171e 100%)",
        border: `1.5px solid rgba(212,175,55,0.2)`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        color,
      }}
    >
      <span className="text-sm leading-none">{card.rank}</span>
      <span className="text-lg leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </motion.div>
  );
}

function ActionEntry({
  action,
  playerName,
  index,
}: {
  action: HandAction;
  playerName: string;
  index: number;
}) {
  const style = ACTION_STYLES[action.action] ?? ACTION_STYLES.check;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors hover:brightness-110"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {/* Timeline dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: style.text }}
      />

      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-300 font-medium">{playerName}</span>
        <span className="text-sm" style={{ color: style.text }}>
          {" "}{formatAction(action.action)}
        </span>
        {action.amount != null && action.amount > 0 && (
          <span className="text-sm font-bold font-mono text-white ml-1">
            ${action.amount.toLocaleString()}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function PhaseBlock({
  phase,
  actions,
  playerMap,
  communityCards,
  defaultOpen,
}: {
  phase: string;
  actions: HandAction[];
  playerMap: Map<string, HandPlayer>;
  communityCards: CardType[];
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const newCards = getNewCardsForPhase(phase, communityCards);

  return (
    <GoldCard padding="p-0" className="overflow-hidden">
      {/* Phase header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "#d4af37" }}
          >
            {PHASE_LABELS[phase] ?? phase}
          </span>
          {newCards.length > 0 && (
            <div className="flex items-center gap-1.5">
              {newCards.map((card, i) => (
                <CardDisplay key={i} card={card} delay={i * 0.1} />
              ))}
            </div>
          )}
          <span className="text-[0.625rem] text-gray-600 ml-1">
            {actions.length} action{actions.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-1.5">
              {actions.map((action, i) => {
                const player = playerMap.get(action.playerId);
                return (
                  <ActionEntry
                    key={i}
                    action={action}
                    playerName={player?.displayName ?? "Unknown"}
                    index={i}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GoldCard>
  );
}

function WinnerBanner({
  results,
  playerMap,
  pot,
}: {
  results: ShowdownResult[];
  playerMap: Map<string, HandPlayer>;
  pot: number;
}) {
  const winners = results.filter((r) => r.isWinner);
  if (winners.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl p-6 text-center"
      style={{
        background: "linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(15,23,30,0.8) 100%)",
        border: "1px solid rgba(212,175,55,0.25)",
        boxShadow: "0 0 40px rgba(212,175,55,0.08)",
      }}
    >
      <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: "#d4af37" }} />
      {winners.map((w, i) => {
        const player = playerMap.get(w.playerId);
        return (
          <div key={i} className="mb-2 last:mb-0">
            <h3 className="text-xl font-bold text-white">
              {player?.displayName ?? "Unknown"}{" "}
              <span style={{ color: "#d4af37" }}>wins</span>
            </h3>
            {w.winAmount != null && (
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: "#d4af37" }}>
                ${w.winAmount.toLocaleString()}
              </p>
            )}
            {w.handName && (
              <p className="text-sm text-gray-400 mt-1">with {w.handName}</p>
            )}
            {w.cards && w.cards.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {w.cards.map((card, ci) => (
                  <CardDisplay key={ci} card={card} delay={ci * 0.1} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-center gap-1.5 mt-4 text-sm text-gray-500">
        <Coins className="w-3.5 h-3.5" />
        Total pot: ${pot.toLocaleString()}
      </div>
    </motion.div>
  );
}

// ─── OG Meta Tags ───────────────────────────────────────────────────────────

function useOgMeta(hand: HandData | null | undefined) {
  useEffect(() => {
    if (!hand?.summary) return;

    const { summary } = hand;
    const winners = summary.showdownResults?.filter((r) => r.isWinner) ?? [];
    const winnerPlayer = winners[0]
      ? summary.players.find((p) => p.id === winners[0].playerId)
      : null;
    const winnerName = winnerPlayer?.displayName ?? "Unknown";
    const handName = winners[0]?.handName ?? "a strong hand";
    const pot = summary.pot;

    const title = `Hand Replay \u2014 ${winnerName} wins $${pot.toLocaleString()} with ${handName}`;
    const description = `${summary.players.length} players, ${summary.actions.length} actions. Watch the full replay of hand #${summary.handNumber}.`;

    document.title = title;

    function setMeta(property: string, content: string) {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:type", "website");
    setMeta("og:url", window.location.href);

    return () => {
      document.title = "Poker App";
    };
  }, [hand]);
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SharedReplay() {
  const params = useParams<{ handId: string }>();
  const handId = params.handId ?? "";
  const [, navigate] = useLocation();

  // Parse commentary from query param
  const commentary = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("commentary") ?? "";
    } catch {
      return "";
    }
  }, []);

  // Fetch hand data
  const {
    data: hand,
    isLoading: handLoading,
    error: handError,
  } = useQuery<HandData>({
    queryKey: [`/api/hands/${handId}`],
    enabled: !!handId,
  });

  // Fetch actions separately (as backup / additional detail)
  const { data: actions } = useQuery<HandAction[]>({
    queryKey: [`/api/hands/${handId}/actions`],
    enabled: !!handId,
  });

  // Set OG meta
  useOgMeta(hand);

  // Derive display data from summary (preferred) or raw actions
  const summary = hand?.summary;
  const players = summary?.players ?? [];
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const displayActions = summary?.actions ?? actions ?? [];
  const communityCards = summary?.communityCards ?? hand?.communityCards ?? [];
  const pot = summary?.pot ?? hand?.potTotal ?? 0;
  const showdownResults = summary?.showdownResults ?? [];

  // Group actions by phase
  const phaseGroups = useMemo(() => {
    const groups: { phase: string; actions: HandAction[] }[] = [];
    const phaseMap = new Map<string, HandAction[]>();
    const orderedPhases: string[] = [];

    for (const action of displayActions) {
      const phase = action.phase ?? "pre-flop";
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, []);
        orderedPhases.push(phase);
      }
      phaseMap.get(phase)!.push(action);
    }

    // Sort phases by canonical order
    orderedPhases.sort(
      (a, b) => (PHASE_ORDER.indexOf(a) ?? 99) - (PHASE_ORDER.indexOf(b) ?? 99),
    );

    for (const phase of orderedPhases) {
      groups.push({ phase, actions: phaseMap.get(phase)! });
    }

    return groups;
  }, [displayActions]);

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (handLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1018" }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#d4af37" }} />
          <p className="text-gray-500 text-sm">Loading hand replay...</p>
        </div>
      </div>
    );
  }

  if (handError || !hand) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1018" }}>
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <XCircle className="w-10 h-10 text-red-500" />
          <h2 className="text-xl font-bold text-white">Hand Not Found</h2>
          <p className="text-gray-500 text-sm max-w-sm">
            This hand replay may have been removed or the link is invalid.
          </p>
          <button
            onClick={() => navigate("/lobby")}
            className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm text-black"
            style={{
              background: "linear-gradient(135deg, #d4af37, #b8962e)",
            }}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #0a1018 0%, #0d1520 50%, #0a1018 100%)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: "rgba(10,16,24,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(212,175,55,0.08)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4" style={{ color: "#d4af37" }} />
              Hand #{summary?.handNumber ?? hand.handNumber}
            </h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {players.length} players
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Coins className="w-3 h-3" />
                ${pot.toLocaleString()} pot
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(hand.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <ShareReplayButton handId={handId} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        {/* Commentary */}
        {commentary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-5"
            style={{
              background: "rgba(212,175,55,0.04)",
              border: "1px solid rgba(212,175,55,0.25)",
            }}
          >
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#d4af37" }} />
              <p className="text-sm text-gray-300 leading-relaxed italic">
                &ldquo;{commentary}&rdquo;
              </p>
            </div>
          </motion.div>
        )}

        {/* Community Cards (full board) */}
        {communityCards.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-4">
            {communityCards.map((card, i) => (
              <CardDisplay key={i} card={card} delay={i * 0.08} />
            ))}
          </div>
        )}

        {/* Phase-by-phase action timeline */}
        {phaseGroups.map((group, i) => (
          <PhaseBlock
            key={group.phase}
            phase={group.phase}
            actions={group.actions}
            playerMap={playerMap}
            communityCards={communityCards}
            defaultOpen={i === phaseGroups.length - 1}
          />
        ))}

        {/* Winner banner */}
        {showdownResults.length > 0 && (
          <WinnerBanner
            results={showdownResults}
            playerMap={playerMap}
            pot={pot}
          />
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-8">
          <GoldButton onClick={() => navigate(`/hand-replay/${handId}`)} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Watch Full Replay
          </GoldButton>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/lobby")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all text-white"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Play className="w-4 h-4" />
            Play Now
          </motion.button>
        </div>
      </main>
    </div>
  );
}
