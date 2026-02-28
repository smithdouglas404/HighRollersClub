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
  Brain, Key, CheckCircle, XCircle, Flame, ImageOff
} from "lucide-react";
import feltBg from "@assets/generated_images/poker_felt_top_down.webp";

type GameFormat = "all" | "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot";

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

function FormatBadge({ format }: { format: string }) {
  const colors: Record<string, string> = {
    cash: "bg-emerald-600/20 text-emerald-400 border-emerald-500/20",
    sng: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
    heads_up: "bg-violet-500/20 text-violet-400 border-violet-500/20",
    tournament: "bg-cyan-600/20 text-cyan-300 border-cyan-500/20",
    bomb_pot: "bg-red-500/20 text-red-400 border-red-500/20",
  };
  const labels: Record<string, string> = {
    cash: "CASH", sng: "SNG", heads_up: "H/U", tournament: "MTT", bomb_pot: "BOMB",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider border ${colors[format] || colors.cash}`}>
      {labels[format] || "CASH"}
    </span>
  );
}

function SeatDots({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i < current
              ? "bg-cyan-400 shadow-[0_0_6px_rgba(0,212,255,0.5)]"
              : "bg-white/10 border border-white/5"
          }`}
        />
      ))}
    </div>
  );
}

const FORMAT_GRADIENT: Record<string, string> = {
  cash: "from-emerald-500/8 via-transparent to-emerald-500/3",
  sng: "from-cyan-500/8 via-transparent to-cyan-500/3",
  heads_up: "from-violet-500/8 via-transparent to-violet-500/3",
  tournament: "from-amber-500/8 via-transparent to-amber-500/3",
  bomb_pot: "from-red-500/8 via-transparent to-red-500/3",
};

const FORMAT_ACCENT: Record<string, string> = {
  cash: "border-emerald-500/15",
  sng: "border-cyan-500/15",
  heads_up: "border-violet-500/15",
  tournament: "border-amber-500/15",
  bomb_pot: "border-red-500/15",
};

function TableCard({ table, onClick, featured }: { table: TableInfo; onClick: () => void; featured?: boolean }) {
  const isFull = table.playerCount >= table.maxPlayers;
  const isPlaying = table.status === "playing";
  const isHot = table.playerCount > 0 && table.playerCount >= table.maxPlayers * 0.7;
  const blindsLabel = `${table.smallBlind}/${table.bigBlind}`;
  const gradient = FORMAT_GRADIENT[table.gameFormat] || FORMAT_GRADIENT.cash;
  const accent = FORMAT_ACCENT[table.gameFormat] || FORMAT_ACCENT.cash;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -3, boxShadow: "0 0 24px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.4)" }}
      onClick={onClick}
      data-testid={`card-table-${table.id}`}
      className={`relative rounded-xl p-5 cursor-pointer transition-all border bg-gradient-to-br ${gradient} ${
        featured ? "border-cyan-500/25 ring-1 ring-cyan-500/10" : `${accent} hover:border-cyan-500/25`
      } ${isFull ? "opacity-60" : ""}`}
      style={{
        background: featured
          ? "linear-gradient(135deg, rgba(0,212,255,0.04), rgba(20,31,40,0.9), rgba(0,212,255,0.02))"
          : "linear-gradient(135deg, rgba(20,31,40,0.7), rgba(16,24,36,0.9))",
        boxShadow: featured
          ? "0 0 30px rgba(0,212,255,0.06), 0 4px 24px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {featured && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-black flex items-center gap-1 shadow-lg">
          <Flame className="w-2.5 h-2.5" />
          HOT TABLE
        </div>
      )}

      {table.isPrivate && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-cyan-400/60" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-sm text-cyan-400 tracking-wide truncate" data-testid={`text-table-name-${table.id}`}>{table.name}</h3>
            <FormatBadge format={table.gameFormat} />
            {isHot && !featured && (
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/20 animate-pulse">
                HOT
              </span>
            )}
            {isFull && (
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                FULL
              </span>
            )}
            {table.scheduledStartTime && new Date(table.scheduledStartTime) > new Date() && (
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/20">
                Starts {new Date(table.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {table.recurringSchedule && table.recurringSchedule.days?.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                {table.recurringSchedule.days.map(d => d.charAt(0).toUpperCase()).join("")} {table.recurringSchedule.startTime}–{table.recurringSchedule.endTime}
              </span>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider shrink-0 ${
          isPlaying
            ? "bg-green-500/20 text-green-400 border border-green-500/20"
            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-green-500 animate-pulse" : "bg-cyan-500"}`} />
          {isPlaying ? "Live" : "Open"}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[0.5rem] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Blinds</div>
          <div className="text-sm font-bold text-white" data-testid={`text-blinds-${table.id}`}>{blindsLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[0.5rem] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Buy-in</div>
          <div className="text-sm font-bold text-white" data-testid={`text-buyin-${table.id}`}>
            {table.gameFormat === "sng" ? table.buyInAmount : `${table.minBuyIn}-${table.maxBuyIn}`}
          </div>
        </div>
        {table.allowBots && (
          <div className="flex items-center gap-1 text-[0.5625rem] text-gray-500 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Bot className="w-3 h-3" />
            Bots
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SeatDots current={table.playerCount} max={table.maxPlayers} />
          <span className="text-xs font-bold text-gray-300" data-testid={`text-players-${table.id}`}>
            {table.playerCount}<span className="text-gray-600">/{table.maxPlayers}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-cyan-400/70 font-medium">
          Join <ChevronRight className="w-3.5 h-3.5" />
        </div>
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
      <div className="relative w-full h-[80px] mb-4 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(20,31,40,0.9), rgba(168,85,247,0.06))" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Flame className="w-5 h-5 text-cyan-400/40 mx-auto mb-1" />
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-cyan-400/50">Games & Tournaments</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[80px] mb-4 rounded-xl overflow-hidden">
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
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-cyan-400 w-4' : 'bg-white/30'}`}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [passwordModal, setPasswordModal] = useState<{ tableId: string; tableName: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

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
    return matchesFormat && matchesSearch;
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

  return (
    <DashboardLayout title="Games & Tournaments">
      <div className="px-8 pb-8 relative">
        {/* Felt texture background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={feltBg}
            alt=""
            loading="lazy"
            className="w-full h-48 object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#111b2a]/85 to-[#111b2a]" />
        </div>
        {/* Banner Carousel */}
        <LobbyBannerCarousel />

        {/* Actions row */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold tracking-wider text-gray-400 uppercase">
              Open Tables
              <span className="ml-2 text-cyan-400">{filteredTables.length}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAISettings(!showAISettings)}
                className={`glass rounded-lg px-4 py-2 text-[0.625rem] font-bold tracking-wider border transition-all flex items-center gap-2 ${
                  aiEnabled
                    ? "text-purple-400 border-purple-500/20 hover:border-purple-500/40"
                    : "text-gray-400 border-white/5 hover:border-white/15 hover:text-white"
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                AI BOTS
                {aiEnabled && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/game")}
              className="glass rounded-lg px-4 py-2 text-[0.625rem] font-bold tracking-wider text-gray-400 hover:text-white border border-white/5 hover:border-white/15 transition-all flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5" />
              PLAY OFFLINE
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setDefaultPrivate(false); setShowCreateTable(true); }}
              className="rounded-lg px-5 py-2 text-[0.625rem] font-bold tracking-wider text-black flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #66e5ff)",
                boxShadow: "0 0 20px rgba(0,212,255,0.3)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              CREATE TABLE
            </motion.button>
          </div>
        </motion.div>

        {/* AI Settings Panel (admin only) */}
        <AnimatePresence>
          {showAISettings && user?.role === "admin" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="rounded-xl p-4"
                style={{
                  background: "linear-gradient(135deg, rgba(88,28,135,0.1), rgba(20,31,40,0.8))",
                  border: "1px solid rgba(168,85,247,0.15)",
                }}
              >
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
                      className="w-full pl-9 pr-4 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-purple-500/30"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-xs mb-4"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs text-white placeholder-gray-500 outline-none transition-all focus:ring-1 focus:ring-amber-500/30"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}
          />
        </motion.div>

        {/* Format tab bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 mb-5 p-1 glass rounded-xl border border-white/5 w-fit"
        >
          {FORMAT_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeFormat === tab.key;
            const count = tab.key === "all" ? tables.length : tables.filter(t => (t.gameFormat || "cash") === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFormat(tab.key)}
                data-testid={`button-format-${tab.key}`}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,212,255,0.1)]"
                    : "text-gray-500 hover:text-gray-300 border border-transparent hover:bg-white/5"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
                {count > 0 && (
                  <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[0.5rem] font-bold ${
                    isActive
                      ? "bg-cyan-500/30 text-cyan-300"
                      : "bg-white/10 text-gray-400"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

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
            className="glass rounded-xl p-4 border border-cyan-500/10 hover:border-cyan-500/20 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Quick Match</div>
                <div className="text-[0.5625rem] text-gray-500">{tables.some(t => t.playerCount < t.maxPlayers) ? "Join an open table" : "Play offline vs bots"}</div>
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
            className="glass rounded-xl p-4 border border-cyan-500/10 hover:border-cyan-500/20 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Sit & Go</div>
                <div className="text-[0.5625rem] text-gray-500">Quick 6-max, 500 buy-in</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => { setDefaultPrivate(true); setShowCreateTable(true); }}
            className="glass rounded-xl p-4 border border-cyan-500/10 hover:border-cyan-500/20 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Private Game</div>
                <div className="text-[0.5625rem] text-gray-500">Create a friends-only table</div>
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
          <div className="text-center py-20">
            <div className="spinner spinner-lg mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading tables...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-12"
          >
            <div className="rounded-2xl px-12 py-10 text-center max-w-md" style={{ background: "linear-gradient(135deg, rgba(20,31,40,0.8), rgba(16,24,36,0.95))", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)" }}>
                <ImageOff className="w-8 h-8 text-cyan-400/30" />
              </div>
              <img
                src="/attached_assets/generated_images/empty/empty_no_tables.webp"
                alt=""
                className="w-40 h-28 object-cover rounded-xl mx-auto mb-4 opacity-60 hidden"
                onLoad={(e) => {
                  (e.target as HTMLImageElement).classList.remove('hidden');
                  const prev = (e.target as HTMLImageElement).previousElementSibling as HTMLElement;
                  if (prev) prev.style.display = 'none';
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <p className="text-sm text-gray-300 mb-1 font-medium" data-testid="text-empty-state">
                {activeFormat === "all" ? "No tables yet" : `No ${activeFormat.replace("_", " ")} tables`}
              </p>
              <p className="text-xs text-gray-600 mb-6">Create the first table or play offline vs bots</p>
              <div className="flex items-center gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/game")}
                  data-testid="button-play-bots-empty"
                  className="rounded-lg px-5 py-2.5 text-xs font-bold tracking-wider text-gray-300 border border-white/10 hover:border-white/15 transition-all flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Bot className="w-4 h-4" />
                  PLAY VS BOTS
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateTable(true)}
                  data-testid="button-create-table-empty"
                  className="rounded-lg px-5 py-2.5 text-xs font-bold tracking-wider text-black flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #66e5ff)",
                    boxShadow: "0 0 20px rgba(0,212,255,0.3)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  CREATE TABLE
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-3.5 h-3.5 text-gray-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">All Tables</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-white/5 to-transparent" />
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
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPasswordModal(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-xl p-6"
              style={{
                background: "linear-gradient(135deg, rgba(20,31,40,0.95), rgba(16,24,36,0.98))",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Private Table</h3>
                  <p className="text-[0.625rem] text-gray-500">{passwordModal.tableName}</p>
                </div>
              </div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Enter table password..."
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none mb-4"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setPasswordModal(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-400 border border-white/10 hover:border-white/15 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-black"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #66e5ff)" }}
                >
                  Join Table
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
