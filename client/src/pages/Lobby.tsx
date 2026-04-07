import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { soundEngine } from "@/lib/sound-engine";
import { useToast } from "@/hooks/use-toast";
import { CreateTableModal } from "@/components/lobby/CreateTable";
import {
  Plus, Users, Coins, ChevronRight,
  Bot, Lock, Zap, Clock, Trophy, Bomb, Swords, LayoutGrid, Search,
  Brain, Key, CheckCircle, XCircle, Flame, Diamond,
  Spade, Heart, Club, Trash2, Megaphone, CircleDot, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NeonButton } from "@/components/ui/neon";

type GameFormat = "all" | "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot" | "fast_fold" | "lottery_sng";
type StakeLevel = "all" | "micro" | "low" | "mid" | "high";
type PokerVariant = "all" | "nlhe" | "plo" | "plo5" | "short_deck";

interface TableInfo {
  id: string;
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  status: string;
  playerCount: number;
  isPrivate: boolean;
  allowBots: boolean;
  gameFormat: string;
  pokerVariant?: string;
  buyInAmount: number;
  startingChips: number;
  createdById?: string;
  createdAt: string;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  recurringSchedule?: { days: string[]; startTime: string; endTime: string } | null;
}

const FORMAT_TABS: { key: GameFormat; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "cash", label: "Cash", icon: Coins },
  { key: "sng", label: "Sit & Go", icon: Clock },
  { key: "heads_up", label: "Heads Up", icon: Swords },
  { key: "tournament", label: "Tournament", icon: Trophy },
  { key: "bomb_pot", label: "Bomb Pot", icon: Bomb },
  { key: "fast_fold", label: "Rush", icon: Zap },
  { key: "lottery_sng", label: "Spin & Go", icon: CircleDot },
];

const STAKE_TABS: { key: StakeLevel; label: string; description: string }[] = [
  { key: "all", label: "All Stakes", description: "Any blind level" },
  { key: "micro", label: "Micro", description: "BB \u2264 10" },
  { key: "low", label: "Low", description: "BB 11-50" },
  { key: "mid", label: "Mid", description: "BB 51-200" },
  { key: "high", label: "High", description: "BB > 200" },
];

const VARIANT_CARDS: { key: PokerVariant; name: string; shortName: string; description: string; players: string; difficulty: string; icon: any }[] = [
  { key: "nlhe", name: "Texas Hold'em", shortName: "NLHE", description: "The classic. Two hole cards, five community cards. Master position, reads, and calculated aggression.", players: "2-9", difficulty: "All Levels", icon: Spade },
  { key: "plo", name: "Omaha", shortName: "PLO", description: "Four hole cards, bigger hands, bigger pots. Must use exactly two from your hand.", players: "2-9", difficulty: "Intermediate", icon: Diamond },
  { key: "short_deck", name: "Short Deck", shortName: "6+", description: "36-card deck, no cards below 6. Flush beats a full house. Fast and volatile.", players: "2-6", difficulty: "Advanced", icon: Heart },
  { key: "plo5", name: "PLO-5", shortName: "PLO5", description: "Five hole cards, pot-limit betting. Maximum complexity, maximum action.", players: "2-6", difficulty: "Expert", icon: Club },
];

function FormatBadge({ format }: { format: string }) {
  const labels: Record<string, string> = {
    cash: "CASH", sng: "SNG", heads_up: "H/U", tournament: "MTT", bomb_pot: "BOMB",
  };
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
      {labels[format] || format.replace("_", " ").toUpperCase()}
    </span>
  );
}


function TableCard({ table, onClick, featured, currentUserId, onDelete }: { table: TableInfo; onClick: () => void; featured?: boolean; currentUserId?: string; onDelete?: (tableId: string) => void }) {
  const isFull = table.playerCount >= table.maxPlayers;
  const isPlaying = table.status === "playing";
  const blindsLabel = `${table.smallBlind}/${table.bigBlind}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      data-testid={`card-table-${table.id}`}
      className={cn(
        "group cursor-pointer rounded-md p-5 transition-all duration-300 relative overflow-hidden card-hover",
        "hover:shadow-[0_0_25px_rgba(212,175,55,0.12)]",
        isPlaying && "border-l-2 border-l-secondary",
        isFull && "opacity-60"
      )}
      style={{
        background: "rgba(15,15,20,0.7)",
        backdropFilter: "blur(12px)",
        border: isPlaying ? undefined : "1px solid rgba(212,175,55,0.12)",
      }}
    >
      {/* Subtle felt texture background */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `url(${featured ? '/felts/felt_emerald_luxury.webp' : '/felts/felt_carbon_fiber.webp'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {featured && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-black flex items-center gap-1 shadow-lg">
          <Flame className="w-2.5 h-2.5" />
          HOT TABLE
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <span className="px-2 py-0.5 rounded-full bg-surface-lowest/80 text-[10px] font-bold uppercase tracking-widest text-primary">
          <FormatBadge format={table.gameFormat} />
        </span>
        <div className="flex items-center gap-2">
          {currentUserId && table.createdById === currentUserId && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
              className="p-1 rounded hover:bg-destructive/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete table"
              aria-label="Delete table"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          )}
          {table.isPrivate && <Lock className="w-3.5 h-3.5 text-destructive" />}
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
            isPlaying
              ? "bg-secondary/10 text-secondary"
              : "bg-surface-lowest/60 text-muted-foreground"
          )}>
            {isPlaying ? "LIVE" : "OPEN"}
          </span>
        </div>
      </div>

      <h3 className="text-xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors" data-testid={`text-table-name-${table.id}`}>
        {table.name}
      </h3>

      <div className="flex items-center gap-4 text-sm mb-4">
        <span className="text-muted-foreground">
          Stakes: <span className="text-foreground font-bold" data-testid={`text-blinds-${table.id}`}>{blindsLabel}</span>
        </span>
        <span className="text-muted-foreground">
          Buy-in: <span className="text-foreground font-bold" data-testid={`text-buyin-${table.id}`}>
            {table.gameFormat === "sng" ? table.buyInAmount : `${table.minBuyIn}-${table.maxBuyIn}`}
          </span>
        </span>
        {table.allowBots && (
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <Bot className="w-3 h-3" /> Bots
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold",
            isPlaying
              ? "bg-secondary/10 border border-secondary/20"
              : "bg-primary/10 border border-primary/20"
          )}>
            <Users className={cn("w-4 h-4", isPlaying ? "text-secondary" : "text-primary")} />
            <span data-testid={`text-players-${table.id}`}>
              <span className={cn("font-bold", isPlaying ? "text-secondary" : "text-white")}>{table.playerCount}</span>
              <span className="text-muted-foreground">/{table.maxPlayers}</span>
            </span>
          </div>
          {isFull && <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Full</span>}
        </div>
        <span className="text-primary text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Join <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

const LOBBY_BANNERS = [
  "/banners/banner_welcome.webp",
  "/banners/banner_tournament.webp",
  "/banners/banner_seasonal.webp",
];

function LobbyBannerCarousel() {
  const [current, setCurrent] = useState(0);
  const [validBanners, setValidBanners] = useState<string[]>(LOBBY_BANNERS);

  useEffect(() => {
    if (validBanners.length === 0) return;
    const timer = setInterval(() => setCurrent(prev => (prev + 1) % validBanners.length), 5000);
    return () => clearInterval(timer);
  }, [validBanners.length]);

  const handleImageError = (src: string) => {
    setValidBanners(prev => prev.filter(b => b !== src));
  };

  if (validBanners.length === 0) {
    return (
      <div className="relative w-full h-[80px] mb-6 rounded-md overflow-hidden bg-surface-high/40 border border-white/[0.06]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Flame className="w-5 h-5 text-primary/40 mx-auto mb-1" />
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-primary/50">Games & Tournaments</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[80px] mb-6 rounded-md overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={validBanners[current]}
          alt="lobby banner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
          draggable={false}
          onError={() => handleImageError(validBanners[current])}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 rounded-xl" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {validBanners.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            data-testid={`button-banner-dot-${i}`}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-primary w-4' : 'bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Club Activity Feed ─────────────────────────────────────────────────────

interface ClubFeedItem {
  type: "big_pot" | "tournament_win" | "member_join" | "announcement" | "table_started";
  clubId: string;
  clubName: string;
  playerName: string;
  description: string;
  timestamp: string;
  amount?: number;
}

interface ActiveClub {
  id: string;
  name: string;
  memberCount: number;
  onlineCount: number;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const FEED_ICONS: Record<ClubFeedItem["type"], { icon: any; gold: boolean }> = {
  tournament_win: { icon: Trophy, gold: true },
  big_pot: { icon: Coins, gold: true },
  member_join: { icon: Users, gold: false },
  announcement: { icon: Megaphone, gold: false },
  table_started: { icon: Zap, gold: false },
};

function ClubActivityFeed() {
  const [feed, setFeed] = useState<ClubFeedItem[]>([]);
  const [activeClubs, setActiveClubs] = useState<ActiveClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasClubs, setHasClubs] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [feedRes, activeRes] = await Promise.all([
          fetch("/api/clubs/my-feed"),
          fetch("/api/clubs/my-active"),
        ]);
        if (cancelled) return;
        if (feedRes.ok && activeRes.ok) {
          const feedData = await feedRes.json();
          const activeData = await activeRes.json();
          setFeed(feedData);
          setActiveClubs(activeData);
          setHasClubs(activeData.length > 0 || feedData.length > 0);
        } else if (feedRes.status === 401) {
          setHasClubs(false);
        }
      } catch {
        // Silently fail — this is supplementary content
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mt-8 rounded-md p-4 bg-surface-high/30 backdrop-blur-xl border border-white/[0.06] animate-pulse h-32" />
    );
  }

  if (!hasClubs) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-md p-5 bg-surface-high/30 backdrop-blur-xl border border-white/[0.06]"
      >
        <div className="flex items-center gap-2 mb-3">
          <Club className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Club Activity</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Join a club to see activity here.</p>
        <button
          onClick={() => navigate("/clubs")}
          className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          Browse Clubs <ChevronRight className="w-3 h-3" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-md bg-surface-high/30 backdrop-blur-xl border border-white/[0.06] overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Club className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Club Activity</span>
          {feed.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {feed.length}
            </span>
          )}
        </div>
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !collapsed && "rotate-90")} />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Online members row */}
            {activeClubs.length > 0 && (
              <div className="px-5 pb-3 flex flex-wrap gap-2">
                {activeClubs.map(club => (
                  <button
                    key={club.id}
                    onClick={() => navigate(`/clubs/${club.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-lowest/60 border border-white/[0.06] hover:border-primary/20 transition-all text-[11px]"
                  >
                    <span className="font-bold text-white truncate max-w-[100px]">{club.name}</span>
                    <span className="flex items-center gap-0.5 text-muted-foreground">
                      <CircleDot className={cn("w-2.5 h-2.5", club.onlineCount > 0 ? "text-green-400" : "text-muted-foreground/40")} />
                      {club.onlineCount}/{club.memberCount}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Feed items */}
            <div className="max-h-64 overflow-y-auto px-5 pb-4 space-y-1.5 scrollbar-thin">
              {feed.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No recent activity in your clubs.</p>
              ) : (
                feed.map((item, i) => {
                  const config = FEED_ICONS[item.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={`${item.clubId}-${item.type}-${i}`}
                      className="flex items-start gap-3 py-2 group"
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                        config.gold
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-white/[0.04] border border-white/[0.06]"
                      )}>
                        <Icon className={cn("w-3.5 h-3.5", config.gold ? "text-amber-400" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 truncate max-w-[120px]">
                            {item.clubName}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0">
                            {relativeTime(item.timestamp)}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs leading-relaxed truncate",
                          config.gold ? "text-amber-200/90" : "text-foreground/80"
                        )}>
                          {item.description}
                          {item.amount != null && (
                            <span className="text-amber-400 font-bold ml-1">
                              {item.amount.toLocaleString()} chips
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Daily Challenges ────────────────────────────────────────────────────────

interface ChallengeItem {
  id: string;
  label: string;
  description: string;
  target: number;
  reward: number;
  periodType: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const CHALLENGE_EMOJIS: Record<string, string> = {
  hands_played: "\u{1F3B0}",
  pots_won: "\u{1F3C6}",
  bluff_wins: "\u{1F3AD}",
  preflop_folds: "\u{1F9D8}",
  big_pot_wins: "\u{1F4B0}",
  vpip: "\u{26A1}",
  plo_hands: "\u{1F0CF}",
  tournament_hands: "\u{2694}",
  sng_win: "\u{1F451}",
};

function DailyChallenges() {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchChallenges = async () => {
    try {
      const res = await fetch("/api/missions/active", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
        // If no challenges, generate them
        if (data.length === 0) {
          const genRes = await fetch("/api/missions/generate-daily", {
            method: "POST",
            credentials: "include",
          });
          if (genRes.ok) {
            // Re-fetch
            const res2 = await fetch("/api/missions/active", { credentials: "include" });
            if (res2.ok) setChallenges(await res2.json());
          }
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
    const interval = setInterval(fetchChallenges, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (id: string) => {
    try {
      const res = await fetch(`/api/missions/${id}/claim`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Reward claimed!", description: `+${data.reward} chips added to your balance.` });
        setChallenges(prev => prev.filter(c => c.id !== id));
      }
    } catch {
      toast({ title: "Error", description: "Failed to claim reward", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="mb-6 rounded-md p-4 bg-surface-high/30 backdrop-blur-xl border border-white/[0.06] animate-pulse h-20" />
    );
  }

  if (challenges.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Daily Challenges</span>
        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary">
          {challenges.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {challenges.map(c => {
          const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
          const emoji = CHALLENGE_EMOJIS[c.label.toLowerCase().replace(/\s+/g, "_")] ||
                        Object.values(CHALLENGE_EMOJIS)[Math.abs(c.label.charCodeAt(0)) % Object.keys(CHALLENGE_EMOJIS).length];
          return (
            <motion.div
              key={c.id}
              layout
              className="shrink-0 w-56 rounded-lg bg-surface-high/40 backdrop-blur-xl border border-white/[0.06] p-3 hover:border-primary/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{emoji}</span>
                <span className="text-xs font-bold text-white truncate">{c.label}</span>
                <span className={cn(
                  "ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                  c.periodType === "weekly" ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                )}>
                  {c.periodType}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2 truncate">{c.description}</p>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] mb-2 overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", c.completed ? "bg-green-500" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {c.progress}/{c.target}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                    <Coins className="w-3 h-3" />
                    {c.reward.toLocaleString()}
                  </span>
                  {c.completed && !c.claimed && (
                    <button
                      onClick={() => handleClaim(c.id)}
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
                    >
                      Claim
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Fast-Fold Pool Browser ─────────────────────────────────────────────────
function FastFoldPoolBrowser() {
  const [pools, setPools] = useState<any[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/fast-fold/pools").then(r => r.ok ? r.json() : []).then(setPools).catch(() => {});
  }, []);

  const joinPool = async (poolId: string, minBuyIn: number) => {
    setJoining(poolId);
    try {
      const res = await fetch(`/api/fast-fold/pools/${poolId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyIn: minBuyIn }),
      });
      const data = await res.json();
      if (res.ok && data.tableId) {
        navigate(`/game/${data.tableId}`);
      }
    } catch {} finally { setJoining(null); }
  };

  if (pools.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
        <Zap className="w-6 h-6 text-amber-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white">Rush Poker Pools</h3>
        <p className="text-xs text-gray-500 mt-1">No fast-fold pools are currently active. An admin can create one from the admin dashboard.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Rush Poker Pools — Instant Action</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pools.map((pool: any) => (
          <div key={pool.poolId} className="rounded-xl border border-amber-500/15 p-4" style={{ background: "rgba(212,175,55,0.03)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">{pool.name || "Rush Pool"}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">RUSH</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 mb-3">
              <div>Blinds: <span className="text-white">{pool.smallBlind}/{pool.bigBlind}</span></div>
              <div>Players: <span className="text-cyan-400">{pool.totalPlayers || 0}</span></div>
              <div>Tables: <span className="text-white">{pool.activeTables || 0}</span></div>
            </div>
            <div className="text-[10px] text-gray-500 mb-3">Buy-in: {pool.minBuyIn}–{pool.maxBuyIn}</div>
            <button
              onClick={() => joinPool(pool.poolId, pool.minBuyIn)}
              disabled={joining === pool.poolId}
              className="w-full py-2 rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs border border-amber-500/25 hover:bg-amber-500/25 transition-all disabled:opacity-50"
            >
              {joining === pool.poolId ? "Joining..." : "Join Pool — Instant Seat"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Lobby() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [defaultPrivate, setDefaultPrivate] = useState(false);
  const [activeFormat, setActiveFormat] = useState<GameFormat>("all");
  const [activeStakeLevel, setActiveStakeLevel] = useState<StakeLevel>("all");
  const [activeVariant, setActiveVariant] = useState<PokerVariant>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [passwordModal, setPasswordModal] = useState<{ tableId: string; tableName: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [aiKeyError, setAiKeyError] = useState("");
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState("");
  const [showModeSelection, setShowModeSelection] = useState(true);
  const tablesRef = useRef<HTMLDivElement>(null);

  // Kill any lingering game audio when returning to lobby
  useEffect(() => {
    soundEngine.stopBgm();
  }, []);

  const fetchTables = async () => {
    try {
      const params = new URLSearchParams();
      if (activeFormat !== "all") params.set("format", activeFormat);
      if (activeVariant !== "all") params.set("variant", activeVariant);
      const qs = params.toString();
      const res = await fetch(`/api/tables${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        setTables(await res.json());
      }
    } catch {
      toast({ title: "Connection error", description: "Failed to load tables.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000);
    // Fetch AI settings
    fetch("/api/ai-settings").then(r => r.ok ? r.json() : null).then(data => {
      if (data) { setAiEnabled(data.aiEnabled); setAiHasKey(data.hasKey); }
    }).catch(() => {});
    return () => clearInterval(interval);
  }, [activeFormat, activeVariant]);

  // Search debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTables = tables.filter(t => {
    const matchesFormat = activeFormat === "all" || (t.gameFormat || "cash") === activeFormat;
    const matchesSearch = !debouncedSearch || t.name.toLowerCase().includes(debouncedSearch.toLowerCase());

    // Stake level filter based on big blind
    let matchesStake = true;
    if (activeStakeLevel !== "all") {
      const bb = t.bigBlind;
      switch (activeStakeLevel) {
        case "micro": matchesStake = bb <= 10; break;
        case "low": matchesStake = bb >= 11 && bb <= 50; break;
        case "mid": matchesStake = bb >= 51 && bb <= 200; break;
        case "high": matchesStake = bb > 200; break;
      }
    }

    // Variant filter based on pokerVariant field
    let matchesVariant = true;
    if (activeVariant !== "all") {
      const variant = (t.pokerVariant || "nlhe").toLowerCase();
      matchesVariant = variant === activeVariant;
    }

    return matchesFormat && matchesSearch && matchesStake && matchesVariant;
  });

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return;
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setTables((prev) => prev.filter((t) => t.id !== tableId));
        toast({ title: "Table deleted", description: "The table has been removed." });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Error", description: data.message || "Failed to delete table", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete table", variant: "destructive" });
    }
  };

  const handleTableClick = (table: TableInfo) => {
    if (table.isPrivate) {
      setPasswordModal({ tableId: table.id, tableName: table.name });
      setPasswordInput("");
      return;
    }
    navigate(`/game/${table.id}`);
  };

  const handlePasswordSubmit = () => {
    if (!passwordModal || submittingPassword) return;
    setSubmittingPassword(true);
    const pw = passwordInput;
    setPasswordInput("");
    // Pass password via navigation state — never stored in sessionStorage
    navigate(`/game/${passwordModal.tableId}?tp=${encodeURIComponent(pw)}`);
    // Reset after navigation in case user comes back
    setTimeout(() => { setSubmittingPassword(false); setPasswordModal(null); }, 500);
  };

  const handleCreateTable = async (config: any) => {
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const table = await res.json();
        setShowCreateTable(false);
        navigate(`/game/${table.id}`);
      } else {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        toast({ title: "Table creation failed", description: err.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not create table.", variant: "destructive" });
    }
  };

  const handleJoinByCode = async () => {
    if (joinCode.length < 6) return;
    setJoinCodeLoading(true);
    setJoinCodeError("");
    try {
      const res = await fetch(`/api/tables/invite/${encodeURIComponent(joinCode)}`);
      if (res.ok) {
        const data = await res.json();
        setJoinCodeOpen(false);
        setJoinCode("");
        navigate(`/game/${data.tableId}`);
      } else {
        const err = await res.json().catch(() => ({ message: "Invalid code" }));
        setJoinCodeError(err.message || "Invalid invite code");
      }
    } catch {
      setJoinCodeError("Network error. Please try again.");
    } finally {
      setJoinCodeLoading(false);
    }
  };

  if (showModeSelection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "linear-gradient(180deg, #0d0b08 0%, #1a1510 100%)" }}>
        {/* Back button */}
        <button onClick={() => navigate("/profile")} className="self-start mb-6 px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm" style={{ border: "1px solid rgba(212,175,55,0.3)" }}>
          &larr; Back to Dashboard
        </button>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-wider mb-8" style={{ background: "linear-gradient(135deg, #d4af37, #f5e6a3, #b8960c, #d4af37)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          High Rollers Club &mdash; Game Mode Selection
        </h1>

        {/* 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {/* Private Table Card */}
          <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "rgba(15,15,20,0.85)", border: "1px solid rgba(212,175,55,0.3)" }}>
            <div className="h-40 bg-gradient-to-br from-amber-900/30 to-black flex items-center justify-center">
              <img src="/images/generated/private-table.webp" alt="" className="w-full h-full object-cover opacity-60" />
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ background: "linear-gradient(135deg, #f5e6a3, #d4af37, #c9a84c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Private Table</h3>
              <p className="text-xs text-gray-400 mt-2 flex-1">Exclusive access. Custom blinds, invite-only for elite play. Set your stakes and play with invited guests.</p>
              <button
                onClick={() => { setShowModeSelection(false); setActiveFormat("cash"); }}
                className="w-full py-3 mt-4 uppercase tracking-wider text-sm font-bold rounded-lg transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                style={{ background: "linear-gradient(135deg, rgba(154,123,44,0.4), rgba(212,175,55,0.2))", border: "1px solid rgba(212,175,55,0.5)", color: "#d4af37" }}
              >
                Create Private Table
              </button>
            </div>
          </div>

          {/* Public Game Card (locked) */}
          <div className="rounded-xl overflow-hidden flex flex-col opacity-60" style={{ background: "rgba(15,15,20,0.85)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <div className="h-40 bg-gradient-to-br from-amber-900/20 to-black flex items-center justify-center">
              <Lock className="w-16 h-16 text-amber-600/50" />
            </div>
            <div className="p-5 flex-1 flex flex-col text-center">
              <p className="text-[0.625rem] text-amber-500/60 uppercase tracking-widest">Club Owner Sponsored</p>
              <h3 className="text-lg font-black uppercase tracking-wider mt-1" style={{ background: "linear-gradient(135deg, #f5e6a3, #d4af37, #c9a84c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Public Game</h3>
              <p className="text-xs text-gray-500 mt-2 flex-1">Join sponsored open games. Community play with exciting stakes.</p>
              <button
                disabled
                className="w-full py-3 mt-4 uppercase tracking-wider text-sm font-bold rounded-lg opacity-50 cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, rgba(154,123,44,0.3), rgba(212,175,55,0.1))", border: "1px solid rgba(212,175,55,0.3)", color: "#d4af37" }}
              >
                Create Public Game (Locked)
              </button>
            </div>
          </div>

          {/* Tournament Card */}
          <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "rgba(15,15,20,0.85)", border: "1px solid rgba(212,175,55,0.3)" }}>
            <div className="h-40 bg-gradient-to-br from-amber-900/30 to-black flex items-center justify-center">
              <Trophy className="w-16 h-16 text-amber-500/40" />
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ background: "linear-gradient(135deg, #f5e6a3, #d4af37, #c9a84c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Tournament</h3>
              <p className="text-xs text-gray-400 mt-2 flex-1">Compete against the best. Multi-table events, big prize pools. Climb the leaderboard to become a legend.</p>
              <button
                onClick={() => navigate("/tournaments")}
                className="w-full py-3 mt-4 uppercase tracking-wider text-sm font-bold rounded-lg transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                style={{ background: "linear-gradient(135deg, rgba(154,123,44,0.4), rgba(212,175,55,0.2))", border: "1px solid rgba(212,175,55,0.5)", color: "#d4af37" }}
              >
                Join Tournament
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 flex gap-6 text-xs text-gray-600">
          <a href="/terms" className="hover:text-gray-400">Terms</a>
          <a href="/privacy" className="hover:text-gray-400">Privacy</a>
          <a href="/support" className="hover:text-gray-400">Support</a>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Games & Tournaments">
      <PageBackground image="/images/generated/lobby-bg.png" />
      <div className="px-6 md:px-8 pb-8 relative z-10">
        {/* Back to Game Mode Selection */}
        <button
          onClick={() => setShowModeSelection(true)}
          className="mb-4 px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm transition-colors"
          style={{ border: "1px solid rgba(212,175,55,0.2)" }}
        >
          &larr; Game Modes
        </button>

        {/* Hero Banner with welcome image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-xl overflow-hidden mb-6"
        >
          <img src="/banners/banner_welcome.webp" alt="" className="w-full h-40 sm:h-52 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-lowest via-surface-lowest/80 to-transparent flex items-center px-6 sm:px-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3 backdrop-blur-md border border-primary/20">
                <Flame className="w-3.5 h-3.5 text-destructive animate-pulse" />
                <span>High Stakes. Zero Limits.</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-2 leading-none tracking-tighter" style={{ background: "linear-gradient(135deg, #d4af37, #f5e6a3, #b8960c, #d4af37)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                SELECT YOUR <br />
                <span className="text-transparent bg-clip-text" style={{ background: "linear-gradient(135deg, #f5e6a3, #d4af37, #b8960c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 12px rgba(212,175,55,0.4))" }}>GAME MODE</span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-lg font-body">
                Choose your variant. Find your table. Enter the vault.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Banner Carousel */}
        <LobbyBannerCarousel />

        {/* Daily Challenges */}
        <DailyChallenges />

        {/* Premium Game Mode Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {[
            {
              icon: Diamond,
              title: "Private Table",
              description: "Set your stakes and play with invited guests",
              cta: "CREATE PRIVATE TABLE",
              href: "/table/new",
              bgImage: "/images/generated/card-private-table.png",
            },
            {
              icon: Users,
              title: "Public Game",
              description: "Open community play with exciting stakes",
              cta: "CREATE PUBLIC GAME",
              href: "/clubs/browse",
              bgImage: "/images/generated/card-public-game.png",
            },
            {
              icon: Trophy,
              title: "Tournament",
              description: "Climb the leaderboard to become a legend",
              cta: "JOIN TOURNAMENT",
              href: "/tournaments",
              bgImage: "/images/generated/card-tournament.png",
            },
          ].map((mode, i) => {
            const Icon = mode.icon;
            return (
              <motion.div
                key={mode.title}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(mode.href)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(mode.href); } }}
                role="button"
                tabIndex={0}
                data-testid={`card-mode-${mode.title.toLowerCase().replace(/\s+/g, "-")}`}
                className="group cursor-pointer relative overflow-hidden rounded-xl transition-all duration-300"
                style={{
                  background: "linear-gradient(145deg, rgba(15,15,20,0.85) 0%, rgba(22,22,30,0.75) 100%)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(212,175,55,0.15)",
                  boxShadow: "0 4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(212,175,55,0.08)",
                }}
              >
                {/* Subtle background image */}
                <div
                  className="absolute inset-0 opacity-[0.12] pointer-events-none"
                  style={{
                    backgroundImage: `url(${mode.bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                {/* Glow effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at center bottom, rgba(212,175,55,0.12) 0%, transparent 70%)",
                  }}
                />
                {/* Top gold accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
                  }}
                />

                <div className="relative p-6 flex flex-col items-center text-center">
                  {/* Icon container with glow */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(212,175,55,0.3)]"
                    style={{
                      background: "linear-gradient(135deg, rgba(154,123,44,0.2) 0%, rgba(212,175,55,0.1) 100%)",
                      border: "1px solid rgba(212,175,55,0.3)",
                    }}
                  >
                    <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" style={{ color: "#d4af37", filter: "drop-shadow(0 0 6px rgba(212,175,55,0.4))" }} />
                  </div>

                  <h3
                    className="text-base font-display font-bold uppercase tracking-wider mb-2"
                    style={{
                      background: "linear-gradient(135deg, #f5e6a3 0%, #d4af37 60%, #c9a84c 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {mode.title}
                  </h3>
                  <p className="text-[0.75rem] text-gray-400 leading-relaxed mb-5 max-w-[200px]">
                    {mode.description}
                  </p>

                  {/* CTA Button */}
                  <div
                    className="w-full py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-[0.15em] text-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                    style={{
                      background: "linear-gradient(135deg, rgba(154,123,44,0.3) 0%, rgba(212,175,55,0.15) 100%)",
                      border: "1px solid rgba(212,175,55,0.35)",
                      color: "#d4af37",
                    }}
                  >
                    {mode.cta}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Club Rankings Link Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          onClick={() => navigate("/club-rankings")}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/club-rankings"); } }}
          className="group cursor-pointer rounded-md p-4 mb-8 flex items-center gap-4 transition-all duration-300 backdrop-blur-xl border border-white/[0.06] hover:border-[rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.12)]"
          style={{ background: "rgba(15,15,20,0.5)" }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
            <Trophy className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-bold uppercase tracking-wider" style={{ color: "#f5e6a3" }}>
              Club Rankings
            </h3>
            <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
              See how clubs compete -- hands played, win rates, and tournament victories.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
        </motion.div>

        {/* Active Tables header + actions */}
        <div ref={tablesRef} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-display font-bold flex items-center gap-3" style={{ background: "linear-gradient(135deg, #d4af37, #f5e6a3, #b8960c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              <Zap className="w-7 h-7" style={{ color: "#d4af37" }} />
              Active Tables
            </h2>
            <p className="text-muted-foreground mt-1">Jump right into the action.</p>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <NeonButton
                variant={aiEnabled ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowAISettings(!showAISettings)}
                className="gap-1.5"
              >
                <Brain className="w-3.5 h-3.5" />
                AI BOTS
                {aiEnabled && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
              </NeonButton>
            )}
            <NeonButton
              variant="secondary"
              size="sm"
              onClick={() => navigate("/game")}
              className="gap-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              PLAY OFFLINE
            </NeonButton>

            <NeonButton
              variant="ghost"
              size="sm"
              onClick={() => { setJoinCodeOpen(true); setJoinCode(""); setJoinCodeError(""); }}
              className="gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              JOIN BY CODE
            </NeonButton>

            <NeonButton
              size="sm"
              onClick={() => { setDefaultPrivate(false); setShowCreateTable(true); }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              CREATE TABLE
            </NeonButton>
          </div>
        </div>

        {/* AI Settings Panel (admin only) */}
        <AnimatePresence>
          {showAISettings && user?.role === "admin" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-md p-4 bg-surface-high/50 backdrop-blur-xl border border-purple-500/15">

                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">AI Bot Configuration</span>
                  <span className={`ml-2 flex items-center gap-1 text-[0.5625rem] font-bold uppercase ${aiEnabled ? "text-green-400" : "text-gray-500"}`}>
                    {aiEnabled ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                  </span>
                </div>
                <p className="text-[0.625rem] text-gray-500 mb-3">
                  Provide your Anthropic API key to enable Claude-powered AI bots with unique personalities.
                  Bots will use Claude Haiku for fast, intelligent decisions and in-character chat.
                  {!aiHasKey && " Without a key, bots use built-in heuristic logic."}
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="password"
                      value={aiKeyInput}
                      onChange={(e) => {
                        setAiKeyInput(e.target.value);
                        const v = e.target.value.trim();
                        if (v && !v.startsWith("sk-ant-")) {
                          setAiKeyError("Key must start with \"sk-ant-\"");
                        } else if (v && v.length < 20) {
                          setAiKeyError("Key is too short");
                        } else {
                          setAiKeyError("");
                        }
                      }}
                      placeholder={aiHasKey ? "Key is set (enter new to replace)" : "sk-ant-..."}
                      className={`w-full pl-9 pr-4 py-2 rounded-md text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-purple-500/30 bg-surface-highest/50 border ${aiKeyError ? "border-red-500/50" : "border-white/[0.06]"}`}
                    />
                    {aiKeyError && (
                      <p className="absolute -bottom-4 left-0 text-[0.5625rem] text-red-400">{aiKeyError}</p>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (!aiKeyInput.trim()) return;
                      setAiSaving(true);
                      try {
                        const res = await fetch("/api/ai-settings", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ apiKey: aiKeyInput.trim() }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setAiEnabled(data.aiEnabled);
                          setAiHasKey(true);
                          setAiKeyInput("");
                          toast({ title: "AI bots enabled", description: "Claude-powered bots are now active." });
                        } else {
                          toast({ title: "Error", description: data.error || "Failed to save", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", description: "Network error", variant: "destructive" });
                      } finally {
                        setAiSaving(false);
                      }
                    }}
                    disabled={aiSaving || !aiKeyInput.trim() || !!aiKeyError}
                    className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-white bg-purple-600/60 border border-purple-500/30 hover:bg-purple-600/80 transition-all disabled:opacity-40"
                  >
                    {aiSaving ? "Saving..." : "Save Key"}
                  </button>
                  {aiHasKey && (
                    <button
                      onClick={async () => {
                        setAiSaving(true);
                        try {
                          await fetch("/api/ai-settings", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ apiKey: null }),
                          });
                          setAiEnabled(false);
                          setAiHasKey(false);
                          toast({ title: "AI bots disabled", description: "Bots will use heuristic logic." });
                        } catch {} finally { setAiSaving(false); }
                      }}
                      className="px-3 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables..."
            className="w-full bg-surface-high/50 border border-white/[0.06] rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/30 transition-all"
          />
        </div>

        {/* Game Variant Cards — Stitch glassmorphic style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {VARIANT_CARDS.map((variant, i) => {
            const Icon = variant.icon;
            const isActive = activeVariant === variant.key;
            const variantCount = tables.filter(t => (t.pokerVariant || "nlhe").toLowerCase() === variant.key).length;
            return (
              <motion.div
                key={variant.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div
                  onClick={() => setActiveVariant(activeVariant === variant.key ? "all" : variant.key)}
                  className={cn(
                    "group cursor-pointer relative overflow-hidden rounded-md transition-all duration-300 card-hover",
                    isActive
                      ? "shadow-[0_0_30px_rgba(212,175,55,0.25)]"
                      : "hover:shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                  )}
                  style={{
                    background: "rgba(15,15,20,0.7)",
                    backdropFilter: "blur(12px)",
                    border: isActive ? "1px solid rgba(212,175,55,0.5)" : "1px solid rgba(212,175,55,0.12)",
                  }}
                >
                  <div className="relative h-28 overflow-hidden bg-gradient-to-b from-surface-highest/80 to-surface-high/40 flex items-center justify-center">
                    <Icon className="w-16 h-16 text-primary/20 group-hover:text-primary/30 transition-colors duration-500 group-hover:scale-110" />
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-full bg-surface-lowest/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                        {variant.difficulty}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 pt-2">
                    <h3 className="text-lg font-display font-bold text-white group-hover:text-primary transition-colors mb-1">
                      {variant.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {variant.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Users className="w-3 h-3" /> {variant.players} Players
                      </span>
                      <span className="text-primary text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                        {variantCount > 0 && <span className="text-secondary text-[10px]">{variantCount} live</span>}
                        Play <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Filter pills — Stitch style */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Search className="w-4 h-4 text-muted-foreground mr-1" />
          {FORMAT_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeFormat === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFormat(tab.key)}
                data-testid={`button-format-${tab.key}`}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_rgba(129,236,255,0.15)]"
                    : "bg-surface-high/60 text-muted-foreground border border-white/[0.06] hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
          <div className="w-px h-5 bg-white/10 mx-1" />
          {STAKE_TABS.map(stake => {
            const isActive = activeStakeLevel === stake.key;
            return (
              <button
                key={stake.key}
                onClick={() => setActiveStakeLevel(stake.key)}
                data-testid={`button-stake-${stake.key}`}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200",
                  isActive
                    ? "bg-secondary/15 text-secondary border border-secondary/30 shadow-[0_0_12px_rgba(74,222,128,0.15)]"
                    : "bg-surface-high/60 text-muted-foreground border border-white/[0.06] hover:text-foreground hover:bg-white/5"
                )}
              >
                {stake.label}
              </button>
            );
          })}
        </div>

        {/* Quick play cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => {
              const openTable = tables.find(t => t.playerCount < t.maxPlayers);
              if (openTable) {
                navigate(`/game/${openTable.id}`);
              } else {
                navigate("/game");
              }
            }}
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-display font-bold text-white uppercase tracking-wider">Quick Match</div>
                <div className="text-[0.5625rem] text-muted-foreground">{tables.some(t => t.playerCount < t.maxPlayers) ? "Join an open table" : "Play offline vs bots"}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => {
              handleCreateTable({
                name: "Sit & Go",
                maxPlayers: 6,
                smallBlind: 10,
                bigBlind: 20,
                ante: 0,
                minBuyIn: 500,
                maxBuyIn: 500,
                timeBankSeconds: 20,
                isPrivate: false,
                allowBots: true,
                gameFormat: "sng",
                buyInAmount: 500,
                startingChips: 1500,
              });
            }}
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-display font-bold text-white uppercase tracking-wider">Sit & Go</div>
                <div className="text-[0.5625rem] text-muted-foreground">Quick 6-max, 500 buy-in</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => { setDefaultPrivate(true); setShowCreateTable(true); }}
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-display font-bold text-white uppercase tracking-wider">Private Game</div>
                <div className="text-[0.5625rem] text-muted-foreground">Create a friends-only table</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hot Tables Section */}
        {!loading && (() => {
          const hotTables = filteredTables
            .filter(t => t.playerCount > 0)
            .sort((a, b) => b.playerCount - a.playerCount)
            .slice(0, 3);
          if (hotTables.length === 0) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400" data-testid="text-hot-tables-title">Hot Tables</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hotTables.map((table) => (
                  <div key={table.id} className="pt-2">
                    <TableCard table={table} onClick={() => handleTableClick(table)} featured currentUserId={user?.id} onDelete={handleDeleteTable} />
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* Table grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-surface-high/40 backdrop-blur-xl rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img src="/empty/empty_no_tables.webp" alt="" className="w-48 h-32 object-cover rounded-xl opacity-60 mb-4" />
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
              <Search className="w-7 h-7 text-primary/40" />
            </div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1" data-testid="text-empty-state">
              {activeFormat === "all" ? "No Tables Found" : `No ${activeFormat.replace("_", " ")} Tables`}
            </h3>
            <p className="text-xs text-muted-foreground/60 max-w-xs">Try adjusting your filters or create a new table to get started.</p>
            <div className="flex items-center gap-3 mt-6">
              <NeonButton variant="secondary" onClick={() => navigate("/game")} data-testid="button-play-bots-empty" className="gap-2">
                <Bot className="w-4 h-4" />
                Play vs Bots
              </NeonButton>
              <NeonButton onClick={() => setShowCreateTable(true)} data-testid="button-create-table-empty" className="gap-2">
                <Plus className="w-4 h-4" />
                Create Table
              </NeonButton>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
              {/* Fast-Fold Pool Browser */}
              {activeFormat === "fast_fold" && <FastFoldPoolBrowser />}

              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">All Tables</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredTables.map((table, i) => (
                <motion.div key={table.id} transition={{ delay: i * 0.05 }}>
                  <TableCard table={table} onClick={() => handleTableClick(table)} currentUserId={user?.id} onDelete={handleDeleteTable} />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* My Clubs Social Feed */}
        <ClubActivityFeed />
      </div>

      {/* Create table modal */}
      <AnimatePresence>
        {showCreateTable && (
          <CreateTableModal
            onClose={() => { setShowCreateTable(false); setDefaultPrivate(false); }}
            onCreate={handleCreateTable}
            defaultPrivate={defaultPrivate}
          />
        )}
      </AnimatePresence>

      {/* Private table password modal */}
      <AnimatePresence>
        {passwordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPasswordModal(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-display font-bold text-white">Private Table</h3>
                  <p className="text-[0.625rem] text-muted-foreground">{passwordModal.tableName}</p>
                </div>
              </div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Enter table password..."
                autoFocus
                className="w-full bg-surface-highest/50 border border-white/[0.06] rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all mb-4"
              />
              <div className="flex gap-2">
                <NeonButton variant="ghost" onClick={() => setPasswordModal(null)} className="flex-1" disabled={submittingPassword}>
                  Cancel
                </NeonButton>
                <NeonButton onClick={handlePasswordSubmit} className="flex-1" disabled={submittingPassword}>
                  {submittingPassword ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Joining...</> : "Join Table"}
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join by Code modal */}
      <AnimatePresence>
        {joinCodeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setJoinCodeOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm p-6 rounded-md bg-surface-high/50 backdrop-blur-xl border border-white/[0.06]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-display font-bold text-white">Join Table by Code</h3>
                  <p className="text-[0.625rem] text-muted-foreground">Enter a 6-8 character invite code</p>
                </div>
              </div>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
                  setJoinCode(val);
                  setJoinCodeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && joinCode.length >= 6) handleJoinByCode();
                }}
                placeholder="e.g. ABC123"
                autoFocus
                maxLength={8}
                className="w-full bg-surface-highest/50 border border-white/[0.06] rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 transition-all mb-1 uppercase tracking-widest font-mono"
              />
              <div className="h-5 mb-3">
                {joinCodeError ? (
                  <p className="text-[0.625rem] text-destructive">{joinCodeError}</p>
                ) : joinCode.length > 0 && joinCode.length < 6 ? (
                  <p className="text-[0.625rem] text-muted-foreground">Minimum 6 characters ({6 - joinCode.length} more needed)</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <NeonButton variant="ghost" onClick={() => setJoinCodeOpen(false)} className="flex-1" disabled={joinCodeLoading}>
                  Cancel
                </NeonButton>
                <NeonButton
                  onClick={handleJoinByCode}
                  className="flex-1"
                  disabled={joinCode.length < 6 || joinCodeLoading}
                >
                  {joinCodeLoading ? "Joining..." : "Join Table"}
                </NeonButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
