import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { soundEngine } from "@/lib/sound-engine";
import { useToast } from "@/hooks/use-toast";
import { CreateTableModal } from "@/components/lobby/CreateTable";
import {
  Plus, Users, Coins, ChevronRight,
  Bot, Lock, Zap, Clock, Trophy, Bomb, Swords, LayoutGrid, Search,
  Brain, Key, CheckCircle, XCircle, Flame, Diamond,
  Spade, Heart, Club
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NeonButton } from "@/components/ui/neon";

type GameFormat = "all" | "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot";
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


function TableCard({ table, onClick, featured }: { table: TableInfo; onClick: () => void; featured?: boolean }) {
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
        "group cursor-pointer rounded-md p-5 transition-all duration-300 relative overflow-hidden",
        "bg-surface-high/50 backdrop-blur-2xl border border-white/[0.06]",
        "hover:border-primary/30 hover:shadow-[0_0_25px_rgba(129,236,255,0.12)]",
        isPlaying && "border-l-2 border-l-secondary",
        isFull && "opacity-60"
      )}
    >
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
  "/attached_assets/generated_images/banners/banner_welcome.webp",
  "/attached_assets/generated_images/banners/banner_tournament.webp",
  "/attached_assets/generated_images/banners/banner_seasonal.webp",
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
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState("");
  const tablesRef = useRef<HTMLDivElement>(null);

  // Kill any lingering game audio when returning to lobby
  useEffect(() => {
    soundEngine.stopBgm();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await fetch("/api/tables");
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
  }, []);

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

  const handleTableClick = (table: TableInfo) => {
    if (table.isPrivate) {
      setPasswordModal({ tableId: table.id, tableName: table.name });
      setPasswordInput("");
      return;
    }
    navigate(`/game/${table.id}`);
  };

  const handlePasswordSubmit = () => {
    if (!passwordModal) return;
    // Store password temporarily for the join attempt — cleared on failed join
    sessionStorage.setItem(`table-password-${passwordModal.tableId}`, passwordInput);
    setPasswordInput("");
    setPasswordModal(null);
    navigate(`/game/${passwordModal.tableId}`);
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

  return (
    <DashboardLayout title="Games & Tournaments">
      <div className="px-6 md:px-8 pb-8 relative">
        {/* Hero Section — Stitch style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 relative pt-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 backdrop-blur-md border border-primary/20">
            <Flame className="w-3.5 h-3.5 text-destructive animate-pulse" />
            <span>High Stakes. Zero Limits.</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3 leading-none tracking-tighter">
            SELECT YOUR <br />
            <span className="text-transparent bg-clip-text gradient-primary neon-text-glow">GAME MODE</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-lg font-body">
            Choose your variant. Find your table. Enter the vault.
          </p>
        </motion.div>

        {/* Banner Carousel */}
        <LobbyBannerCarousel />

        {/* Game Mode Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon: Lock,
              title: "Private Game",
              description: "Create a private table with invite code",
              onClick: () => { setDefaultPrivate(true); setShowCreateTable(true); },
              accent: "primary",
            },
            {
              icon: Users,
              title: "Public Game",
              description: "Join open tables",
              onClick: () => tablesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
              accent: "secondary",
            },
            {
              icon: Trophy,
              title: "Tournament",
              description: "Compete in scheduled events",
              onClick: () => navigate("/tournaments"),
              accent: "tertiary",
            },
          ].map((mode, i) => {
            const Icon = mode.icon;
            return (
              <motion.div
                key={mode.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.45 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={mode.onClick}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mode.onClick(); } }}
                role="button"
                tabIndex={0}
                data-testid={`card-mode-${mode.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "group cursor-pointer relative overflow-hidden rounded-md p-5 transition-all duration-300",
                  "bg-surface-high/50 backdrop-blur-xl border border-white/[0.06]",
                  "hover:border-primary/30 hover:shadow-[0_0_25px_rgba(129,236,255,0.15)]"
                )}
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative flex items-start gap-4">
                  <div className={cn(
                    "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300",
                    "bg-primary/10 border border-primary/20",
                    "group-hover:bg-primary/15 group-hover:border-primary/30 group-hover:shadow-[0_0_12px_rgba(129,236,255,0.2)]"
                  )}>
                    <Icon className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider group-hover:text-primary transition-colors duration-200">
                      {mode.title}
                    </h3>
                    <p className="text-[0.6875rem] text-muted-foreground mt-0.5 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Active Tables header + actions */}
        <div ref={tablesRef} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              <Zap className="w-7 h-7 text-primary" />
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
                      onChange={(e) => setAiKeyInput(e.target.value)}
                      placeholder={aiHasKey ? "Key is set (enter new to replace)" : "sk-ant-..."}
                      className="w-full pl-9 pr-4 py-2 rounded-md text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-purple-500/30 bg-surface-highest/50 border border-white/[0.06]"
                    />
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
                    disabled={aiSaving || !aiKeyInput.trim()}
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
                    "group cursor-pointer relative overflow-hidden rounded-md transition-all duration-300",
                    "bg-surface-high/60 backdrop-blur-2xl",
                    isActive
                      ? "ring-1 ring-primary shadow-[0_0_30px_rgba(129,236,255,0.25)]"
                      : "border border-white/[0.06] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(129,236,255,0.1)]"
                  )}
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
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all"
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
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all"
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
            className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] hover:border-primary/20 cursor-pointer transition-all"
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
                    <TableCard table={table} onClick={() => handleTableClick(table)} featured />
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
                  <TableCard table={table} onClick={() => handleTableClick(table)} />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
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
                <NeonButton variant="ghost" onClick={() => setPasswordModal(null)} className="flex-1">
                  Cancel
                </NeonButton>
                <NeonButton onClick={handlePasswordSubmit} className="flex-1">
                  Join Table
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
                {joinCodeError && (
                  <p className="text-[0.625rem] text-destructive">{joinCodeError}</p>
                )}
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
