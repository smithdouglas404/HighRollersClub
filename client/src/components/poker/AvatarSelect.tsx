import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Zap, Shield, Crown, Skull, Ghost, Bot } from "lucide-react";

import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";
import avatar1 from "@assets/generated_images/player_seated_cyberpunk_1.png";
import avatar2 from "@assets/generated_images/player_seated_cyberpunk_2.png";
import avatar3 from "@assets/generated_images/player_seated_cyberpunk_3.png";
import avatar4 from "@assets/generated_images/player_seated_cyberpunk_4.png";

export interface AvatarOption {
  id: string;
  name: string;
  image?: string;        // real image
  gradient?: string;     // CSS gradient for generated avatars
  icon?: React.ReactNode;
  tier: "legendary" | "epic" | "rare" | "common";
  borderColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "av1", name: "Neon Viper", image: avatar1, tier: "legendary", borderColor: "#00f0ff" },
  { id: "av2", name: "Chrome Siren", image: avatar2, tier: "legendary", borderColor: "#b44dff" },
  { id: "av3", name: "Gold Protocol", image: avatar3, tier: "epic", borderColor: "#ffd700" },
  { id: "av4", name: "Ghost Wire", image: avatar4, tier: "epic", borderColor: "#ff3366" },
  { id: "av5", name: "Phantom", gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", icon: <Ghost className="w-8 h-8" />, tier: "rare", borderColor: "#00ff9d" },
  { id: "av6", name: "Overlord", gradient: "linear-gradient(135deg, #2d1b00 0%, #4a2c00 50%, #1a0f00 100%)", icon: <Crown className="w-8 h-8" />, tier: "rare", borderColor: "#c9a84c" },
  { id: "av7", name: "Skull Jack", gradient: "linear-gradient(135deg, #1a0000 0%, #330000 50%, #1a0000 100%)", icon: <Skull className="w-8 h-8" />, tier: "common", borderColor: "#ef4444" },
  { id: "av8", name: "Synth Bot", gradient: "linear-gradient(135deg, #001a1a 0%, #003333 50%, #001a1a 100%)", icon: <Bot className="w-8 h-8" />, tier: "common", borderColor: "#06b6d4" },
];

const tierColors: Record<string, { bg: string; text: string; label: string }> = {
  legendary: { bg: "rgba(255,215,0,0.1)", text: "text-yellow-400", label: "LEGENDARY" },
  epic: { bg: "rgba(180,77,255,0.1)", text: "text-purple-400", label: "EPIC" },
  rare: { bg: "rgba(0,255,157,0.1)", text: "text-green-400", label: "RARE" },
  common: { bg: "rgba(150,150,150,0.1)", text: "text-gray-400", label: "COMMON" },
};

interface AvatarSelectProps {
  onSelect: (avatar: AvatarOption, playerName: string) => void;
}

export function AvatarSelect({ onSelect }: AvatarSelectProps) {
  const [selected, setSelected] = useState<AvatarOption>(AVATAR_OPTIONS[0]);
  const [playerName, setPlayerName] = useState("");
  const [isReady, setIsReady] = useState(false);

  const handleJoin = () => {
    if (!playerName.trim()) return;
    setIsReady(true);
    setTimeout(() => onSelect(selected, playerName.trim()), 800);
  };

  return (
    <AnimatePresence>
      {!isReady ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-[#030508] text-white flex flex-col items-center justify-center relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
              style={{ background: `radial-gradient(circle, ${selected.borderColor}33 0%, transparent 70%)` }}
            />
          </div>

          <div className="relative z-10 w-full max-w-3xl px-6 space-y-8">

            {/* Header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center space-y-3"
            >
              <div className="w-16 h-16 mx-auto relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
                <img src={lionLogo} alt="" className="w-full h-full object-contain relative z-10" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-widest gold-text">CHOOSE YOUR IDENTITY</h1>
              <p className="text-sm text-gray-500">Select an avatar to represent you at the table</p>
            </motion.div>

            {/* Avatar grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-4 gap-3"
            >
              {AVATAR_OPTIONS.map((av, i) => {
                const isSelected = selected.id === av.id;
                const tier = tierColors[av.tier];
                return (
                  <motion.button
                    key={av.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => setSelected(av)}
                    className={`
                      relative rounded-xl p-1 transition-all duration-300
                      ${isSelected ? "scale-105" : "hover:scale-[1.02] opacity-70 hover:opacity-100"}
                    `}
                    style={{
                      background: isSelected ? `linear-gradient(135deg, ${av.borderColor}40, transparent, ${av.borderColor}40)` : "rgba(255,255,255,0.03)",
                      border: isSelected ? `2px solid ${av.borderColor}` : "2px solid rgba(255,255,255,0.05)",
                      boxShadow: isSelected ? `0 0 30px ${av.borderColor}30` : "none",
                    }}
                  >
                    {/* Avatar display */}
                    <div className="aspect-square rounded-lg overflow-hidden relative mb-2">
                      {av.image ? (
                        <img src={av.image} alt={av.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: av.gradient }}>
                          <div style={{ color: av.borderColor, opacity: 0.8 }}>{av.icon}</div>
                        </div>
                      )}
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                      {/* Selected check */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: av.borderColor }}
                        >
                          <Zap className="w-3 h-3 text-black" />
                        </motion.div>
                      )}
                    </div>

                    {/* Name & tier */}
                    <div className="px-1 pb-1">
                      <div className="text-[11px] font-bold text-white truncate">{av.name}</div>
                      <div className={`text-[8px] font-bold uppercase tracking-wider ${tier.text}`}>
                        {tier.label}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Name input & join */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3 max-w-md mx-auto"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Enter your name..."
                  maxLength={16}
                  className="w-full glass rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-all focus:neon-border-cyan bg-transparent"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
                  {playerName.length}/16
                </div>
              </div>

              <button
                onClick={handleJoin}
                disabled={!playerName.trim()}
                className={`
                  rounded-xl px-6 py-3 font-bold text-sm uppercase tracking-wider flex items-center gap-2
                  transition-all duration-300
                  ${playerName.trim()
                    ? "text-black hover:scale-105"
                    : "text-gray-600 bg-gray-800/50 cursor-not-allowed"
                  }
                `}
                style={playerName.trim() ? {
                  background: `linear-gradient(135deg, ${selected.borderColor}, ${selected.borderColor}cc)`,
                  boxShadow: `0 0 20px ${selected.borderColor}40`,
                } : undefined}
              >
                <Shield className="w-4 h-4" />
                Join Table
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Selected avatar preview info */}
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-center"
            >
              <span className="text-[10px] text-gray-600 font-mono">
                Selected: <span style={{ color: selected.borderColor }}>{selected.name}</span>
                {" | "}
                <span className={tierColors[selected.tier].text}>{tierColors[selected.tier].label}</span>
              </span>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen bg-[#030508] flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="font-display text-xl tracking-widest neon-text-cyan">ENTERING TABLE...</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
