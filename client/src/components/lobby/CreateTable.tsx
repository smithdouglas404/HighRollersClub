import { useState } from "react";
import { motion } from "framer-motion";
import { X, Users, Coins, Clock, Lock, Bot, Zap, Trophy, Bomb, Swords } from "lucide-react";

type GameFormat = "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot";

interface CreateTableModalProps {
  onClose: () => void;
  onCreate: (config: any) => void;
  defaultPrivate?: boolean;
}

const FORMAT_OPTIONS: { key: GameFormat; label: string; icon: any; desc: string; color: string }[] = [
  { key: "cash", label: "Cash Game", icon: Coins, desc: "Standard ring game", color: "cyan" },
  { key: "sng", label: "Sit & Go", icon: Clock, desc: "Fixed buy-in, rising blinds", color: "amber" },
  { key: "heads_up", label: "Heads Up", icon: Swords, desc: "1v1 match", color: "purple" },
  { key: "bomb_pot", label: "Bomb Pot", icon: Bomb, desc: "Cash + periodic bomb pots", color: "red" },
];

export function CreateTableModal({ onClose, onCreate, defaultPrivate }: CreateTableModalProps) {
  const [gameFormat, setGameFormat] = useState<GameFormat>("cash");
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
  // SNG-specific
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [startingChips, setStartingChips] = useState(1500);
  const [blindPreset, setBlindPreset] = useState("standard");
  // Bomb pot
  const [bombPotFrequency, setBombPotFrequency] = useState(5);
  const [bombPotAnte, setBombPotAnte] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const config: any = {
      name: name.trim(),
      maxPlayers: gameFormat === "heads_up" ? 2 : maxPlayers,
      smallBlind,
      bigBlind,
      ante,
      timeBankSeconds,
      isPrivate,
      allowBots,
      gameFormat,
    };

    if (gameFormat === "sng") {
      config.buyInAmount = buyInAmount;
      config.startingChips = startingChips;
      config.minBuyIn = buyInAmount;
      config.maxBuyIn = buyInAmount;
      // Blind schedule will be applied server-side based on preset
    } else {
      config.minBuyIn = minBuyIn;
      config.maxBuyIn = maxBuyIn;
    }

    if (gameFormat === "bomb_pot") {
      config.bombPotFrequency = bombPotFrequency;
      config.bombPotAnte = bombPotAnte || bigBlind;
      config.minBuyIn = minBuyIn;
      config.maxBuyIn = maxBuyIn;
    }

    if (gameFormat === "heads_up") {
      config.minBuyIn = minBuyIn;
      config.maxBuyIn = maxBuyIn;
    }

    onCreate(config);
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
        className="glass rounded-2xl p-6 w-full max-w-lg border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg tracking-wider gold-text">CREATE TABLE</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Format Selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
              Game Format
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = gameFormat === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setGameFormat(opt.key);
                      if (opt.key === "heads_up") setMaxPlayers(2);
                      else if (maxPlayers === 2 && opt.key !== "heads_up") setMaxPlayers(6);
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isSelected
                        ? `bg-${opt.color}-500/15 border-${opt.color}-500/30 text-${opt.color}-400`
                        : "bg-white/5 border-white/10 text-gray-500 hover:border-white/20"
                    }`}
                    style={isSelected ? {
                      backgroundColor: `rgba(${opt.color === "cyan" ? "34,211,238" : opt.color === "amber" ? "245,158,11" : opt.color === "purple" ? "168,85,247" : "239,68,68"},0.1)`,
                      borderColor: `rgba(${opt.color === "cyan" ? "34,211,238" : opt.color === "amber" ? "245,158,11" : opt.color === "purple" ? "168,85,247" : "239,68,68"},0.3)`,
                    } : {}}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-[9px] font-bold uppercase tracking-wider">{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Name */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
              Table Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gameFormat === "sng" ? "Turbo SNG" : "High Stakes Showdown"}
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
                value={gameFormat === "heads_up" ? 2 : maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                disabled={gameFormat === "heads_up"}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
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

          {/* SNG-specific fields */}
          {gameFormat === "sng" && (
            <div className="p-3 rounded-lg border border-amber-500/15 bg-amber-500/5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-3">SNG Settings</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Buy-In</label>
                  <input
                    type="number"
                    value={buyInAmount}
                    onChange={(e) => setBuyInAmount(parseInt(e.target.value) || 100)}
                    min={100}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Starting Chips</label>
                  <input
                    type="number"
                    value={startingChips}
                    onChange={(e) => setStartingChips(parseInt(e.target.value) || 1500)}
                    min={100}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Blind Speed</label>
                  <select
                    value={blindPreset}
                    onChange={(e) => setBlindPreset(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="standard" className="bg-gray-900">Standard (5min)</option>
                    <option value="turbo" className="bg-gray-900">Turbo (3min)</option>
                    <option value="mtt" className="bg-gray-900">Slow (10min)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bomb Pot fields */}
          {gameFormat === "bomb_pot" && (
            <div className="p-3 rounded-lg border border-red-500/15 bg-red-500/5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-3">Bomb Pot Settings</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Every N Hands</label>
                  <select
                    value={bombPotFrequency}
                    onChange={(e) => setBombPotFrequency(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                  >
                    {[3, 5, 7, 10].map(n => (
                      <option key={n} value={n} className="bg-gray-900">Every {n} hands</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Bomb Ante</label>
                  <input
                    type="number"
                    value={bombPotAnte}
                    onChange={(e) => setBombPotAnte(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder={`${bigBlind}`}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 placeholder-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buy-in Range (cash / heads_up / bomb_pot) */}
          {gameFormat !== "sng" && (
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
          )}

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
            {gameFormat === "sng" ? "CREATE SIT & GO" : gameFormat === "bomb_pot" ? "CREATE BOMB POT TABLE" : "CREATE TABLE"}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
