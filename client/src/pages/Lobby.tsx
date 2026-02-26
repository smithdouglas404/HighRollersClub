import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { CreateTableModal } from "@/components/lobby/CreateTable";
import {
  Plus, Users, Coins, ChevronRight,
  Bot, Lock, Zap, Clock, Trophy, Bomb, Swords, LayoutGrid, Search
} from "lucide-react";

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
    cash: "bg-green-500/20 text-green-400 border-green-500/20",
    sng: "bg-amber-500/20 text-amber-400 border-amber-500/20",
    heads_up: "bg-purple-500/20 text-purple-400 border-purple-500/20",
    tournament: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
    bomb_pot: "bg-red-500/20 text-red-400 border-red-500/20",
  };
  const labels: Record<string, string> = {
    cash: "CASH", sng: "SNG", heads_up: "H/U", tournament: "MTT", bomb_pot: "BOMB",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${colors[format] || colors.cash}`}>
      {labels[format] || "CASH"}
    </span>
  );
}

function TableCard({ table, onClick }: { table: TableInfo; onClick: () => void }) {
  const isFull = table.playerCount >= table.maxPlayers;
  const isPlaying = table.status === "playing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2, boxShadow: "0 0 20px rgba(0,240,255,0.08), 0 4px 20px rgba(0,0,0,0.2)" }}
      onClick={onClick}
      className={`relative glass rounded-xl p-5 cursor-pointer transition-all border border-white/5 hover:border-cyan-500/20 ${
        isFull ? "opacity-60" : ""
      }`}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
    >
      {table.isPrivate && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-amber-400/60" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm text-cyan-400 tracking-wide" style={{ textShadow: "0 0 8px rgba(0,240,255,0.3)" }}>{table.name}</h3>
            <FormatBadge format={table.gameFormat} />
          </div>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
            {table.smallBlind}/{table.bigBlind}
            {table.gameFormat === "sng" && ` | Buy-in: ${table.buyInAmount}`}
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          isPlaying
            ? "bg-green-500/20 text-green-400 border border-green-500/20"
            : "bg-amber-500/20 text-amber-400 border border-amber-500/20"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-green-500" : "bg-amber-500"}`} />
          {isPlaying ? "Playing" : "Waiting"}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {table.playerCount}/{table.maxPlayers}
          </span>
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {table.gameFormat === "sng" ? table.buyInAmount : `${table.minBuyIn}-${table.maxBuyIn}`}
          </span>
          {table.allowBots && (
            <span className="flex items-center gap-1 text-gray-500">
              <Bot className="w-3 h-3" />
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </div>
    </motion.div>
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
  const [passwordModal, setPasswordModal] = useState<{ tableId: string; tableName: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");

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
    return () => clearInterval(interval);
  }, []);

  const filteredTables = tables.filter(t => {
    const matchesFormat = activeFormat === "all" || (t.gameFormat || "cash") === activeFormat;
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
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
    sessionStorage.setItem(`table-password-${passwordModal.tableId}`, passwordInput);
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
      <div className="px-8 pb-8">
        {/* Actions row */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold tracking-wider text-gray-400 uppercase">
              Open Tables
              <span className="ml-2 text-cyan-500">{filteredTables.length}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/game")}
              className="glass rounded-lg px-4 py-2 text-[10px] font-bold tracking-wider text-gray-400 hover:text-white border border-white/5 hover:border-white/15 transition-all flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5" />
              PLAY OFFLINE
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setDefaultPrivate(false); setShowCreateTable(true); }}
              className="rounded-lg px-5 py-2 text-[10px] font-bold tracking-wider text-black flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, #c9a84c, #e8c566)",
                boxShadow: "0 0 20px rgba(201,168,76,0.3)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              CREATE TABLE
            </motion.button>
          </div>
        </motion.div>

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
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
                    : "text-gray-500 hover:text-gray-300 border border-transparent"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
                {count > 0 && <span className={`ml-0.5 ${isActive ? "text-cyan-300" : "text-gray-600"}`}>({count})</span>}
              </button>
            );
          })}
        </motion.div>

        {/* Quick play cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
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
            className="glass rounded-xl p-4 border border-cyan-500/10 hover:border-cyan-500/25 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Quick Match</div>
                <div className="text-[9px] text-gray-500">{tables.some(t => t.playerCount < t.maxPlayers) ? "Join an open table" : "Play offline vs bots"}</div>
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
            className="glass rounded-xl p-4 border border-amber-500/10 hover:border-amber-500/25 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Sit & Go</div>
                <div className="text-[9px] text-gray-500">Quick 6-max, 500 buy-in</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => { setDefaultPrivate(true); setShowCreateTable(true); }}
            className="glass rounded-xl p-4 border border-purple-500/10 hover:border-purple-500/25 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">Private Game</div>
                <div className="text-[9px] text-gray-500">Create a friends-only table</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Table grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading tables...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-12"
          >
            <div className="glass rounded-2xl border border-white/5 px-12 py-10 text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-cyan-500/5 flex items-center justify-center mx-auto mb-4 border border-cyan-500/10 shadow-[0_0_20px_rgba(0,240,255,0.05)]">
                <Users className="w-8 h-8 text-cyan-500/40" />
              </div>
              <p className="text-sm text-gray-300 mb-1 font-medium">
                {activeFormat === "all" ? "No tables yet" : `No ${activeFormat.replace("_", " ")} tables`}
              </p>
              <p className="text-xs text-gray-600 mb-6">Create the first table or play offline vs bots</p>
              <div className="flex items-center gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/game")}
                  className="glass rounded-lg px-5 py-2.5 text-xs font-bold tracking-wider text-gray-300 border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  PLAY VS BOTS
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateTable(true)}
                  className="rounded-lg px-5 py-2.5 text-xs font-bold tracking-wider text-black flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #c9a84c, #e8c566)",
                    boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  CREATE TABLE
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
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
                background: "linear-gradient(135deg, rgba(12,20,40,0.98), rgba(10,16,34,0.99))",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Private Table</h3>
                  <p className="text-[10px] text-gray-500">{passwordModal.tableName}</p>
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
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setPasswordModal(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-400 border border-white/10 hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-black"
                  style={{ background: "linear-gradient(135deg, #c9a84c, #e8c566)" }}
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
