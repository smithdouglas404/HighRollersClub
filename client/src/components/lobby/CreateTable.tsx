import { useState } from "react";
import { motion } from "framer-motion";
import { X, Users, Coins, Clock, Lock, Bot, Zap } from "lucide-react";

interface CreateTableModalProps {
  onClose: () => void;
  onCreate: (config: any) => void;
  defaultPrivate?: boolean;
}

export function CreateTableModal({ onClose, onCreate, defaultPrivate }: CreateTableModalProps) {
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [ante, setAnte] = useState(0);
  const [minBuyIn, setMinBuyIn] = useState(200);
  const [maxBuyIn, setMaxBuyIn] = useState(2000);
  const [timeBankSeconds, setTimeBankSeconds] = useState(30);
  const [isPrivate, setIsPrivate] = useState(defaultPrivate ?? false);
  const [allowBots, setAllowBots] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      maxPlayers,
      smallBlind,
      bigBlind,
      ante,
      minBuyIn,
      maxBuyIn,
      timeBankSeconds,
      isPrivate,
      allowBots,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg tracking-wider gold-text">CREATE TABLE</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Table Name */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
              Table Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High Stakes Showdown"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              maxLength={50}
              required
            />
          </div>

          {/* Players + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1.5">
                <Users className="w-3 h-3" /> Max Players
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n} className="bg-gray-900">{n} Players</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1.5">
                <Clock className="w-3 h-3" /> Time Bank
              </label>
              <select
                value={timeBankSeconds}
                onChange={(e) => setTimeBankSeconds(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {[10, 15, 20, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n} className="bg-gray-900">{n}s</option>
                ))}
              </select>
            </div>
          </div>

          {/* Blinds + Ante */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1.5">
                <Coins className="w-3 h-3" /> Small Blind
              </label>
              <input
                type="number"
                value={smallBlind}
                onChange={(e) => {
                  const sb = parseInt(e.target.value) || 1;
                  setSmallBlind(sb);
                  setBigBlind(sb * 2);
                }}
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1.5">
                <Coins className="w-3 h-3" /> Big Blind
              </label>
              <input
                type="number"
                value={bigBlind}
                onChange={(e) => setBigBlind(parseInt(e.target.value) || 2)}
                min={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1 mb-1.5">
                <Zap className="w-3 h-3" /> Ante
              </label>
              <input
                type="number"
                value={ante}
                onChange={(e) => setAnte(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Buy-in Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                Min Buy-In
              </label>
              <input
                type="number"
                value={minBuyIn}
                onChange={(e) => setMinBuyIn(parseInt(e.target.value) || 100)}
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">
                Max Buy-In
              </label>
              <input
                type="number"
                value={maxBuyIn}
                onChange={(e) => setMaxBuyIn(parseInt(e.target.value) || 1000)}
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/30"
              />
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowBots}
                onChange={(e) => setAllowBots(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/30"
              />
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Allow Bots
              </span>
            </label>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full gold-gradient rounded-lg py-3 text-sm font-bold tracking-wider text-black shadow-[0_0_20px_rgba(201,168,76,0.3)] mt-2"
          >
            CREATE TABLE
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
