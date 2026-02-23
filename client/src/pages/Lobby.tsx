import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { CreateTableModal } from "@/components/lobby/CreateTable";
import { AmbientParticles } from "@/components/AmbientParticles";
import {
  Plus, Users, Trophy, Coins, LogOut, User, ChevronRight,
  Wifi, WifiOff, Clock, Bot, Lock
} from "lucide-react";

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
  createdAt: string;
}

function TableCard({ table, onClick }: { table: TableInfo; onClick: () => void }) {
  const isFull = table.playerCount >= table.maxPlayers;
  const isPlaying = table.status === "playing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className={`relative glass rounded-xl p-5 cursor-pointer transition-all border border-white/5 hover:border-cyan-500/30 ${
        isFull ? "opacity-60" : ""
      }`}
    >
      {table.isPrivate && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3.5 h-3.5 text-amber-400/60" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-sm text-white tracking-wide">{table.name}</h3>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
            {table.smallBlind}/{table.bigBlind} NLH
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          isPlaying
            ? "bg-green-500/20 text-green-400"
            : "bg-amber-500/20 text-amber-400"
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
            {table.minBuyIn}-{table.maxBuyIn}
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
  const { user, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTable, setShowCreateTable] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await fetch("/api/tables");
      if (res.ok) {
        setTables(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTableClick = (table: TableInfo) => {
    navigate(`/game/${table.id}`);
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
      }
    } catch {
      // ignore
    }
  };

  const handleClaimDaily = async () => {
    try {
      const res = await fetch("/api/wallet/claim-daily", { method: "POST" });
      if (res.ok) {
        await refreshUser();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#030508] text-white overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,30,40,0.5)_0%,rgba(0,0,0,0.95)_70%)]" />
        <AmbientParticles />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-[0_0_20px_rgba(201,168,76,0.3)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-widest gold-text">HIGH ROLLERS</h1>
              <p className="text-[10px] text-gray-500 tracking-[0.2em] font-mono">MULTIPLAYER POKER</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Balance */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClaimDaily}
              className="glass rounded-lg px-4 py-2 flex items-center gap-2 border border-white/5 hover:border-amber-500/30 transition-all"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">
                {user?.chipBalance?.toLocaleString() ?? 0}
              </span>
            </motion.button>

            {/* User info */}
            <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 border border-white/5">
              <User className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-300">{user?.displayName || user?.username}</span>
              {user?.role === "guest" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 uppercase tracking-wider">Guest</span>
              )}
            </div>

            <button
              onClick={logout}
              className="glass rounded-lg p-2 hover:bg-white/5 transition-colors border border-white/5"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </motion.div>

        {/* Actions row */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between mb-6"
        >
          <h2 className="text-sm font-bold tracking-wider text-gray-400 uppercase">
            Open Tables
            <span className="ml-2 text-cyan-500">{tables.length}</span>
          </h2>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/game")}
              className="glass rounded-lg px-4 py-2 text-xs font-bold tracking-wider text-gray-400 hover:text-white border border-white/5 hover:border-white/20 transition-all flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5" />
              PLAY OFFLINE
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateTable(true)}
              className="gold-gradient rounded-lg px-5 py-2 text-xs font-bold tracking-wider text-black flex items-center gap-2 shadow-[0_0_20px_rgba(201,168,76,0.3)]"
            >
              <Plus className="w-4 h-4" />
              CREATE TABLE
            </motion.button>
          </div>
        </motion.div>

        {/* Table grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading tables...</p>
          </div>
        ) : tables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 mb-2">No tables yet</p>
            <p className="text-xs text-gray-600 mb-6">Create the first table to start playing</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateTable(true)}
              className="gold-gradient rounded-lg px-6 py-2.5 text-xs font-bold tracking-wider text-black inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              CREATE TABLE
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {tables.map((table, i) => (
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
            onClose={() => setShowCreateTable(false)}
            onCreate={handleCreateTable}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
