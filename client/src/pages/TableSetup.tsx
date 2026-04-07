import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Rocket,
  Spade,
  Diamond,
  Club,
  Heart,
  Users,
  Timer,
  Sparkles,
  Palette,
  ShieldCheck,
  ClipboardList,
  Layers,
  Settings2,
  CheckCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TableConfig {
  gameType: string;
  pokerVariant: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  turnTimer: number;
  timeBank: number;
  ante: number;
  straddle: boolean;
  runItTwice: boolean;
  bombPot: boolean;
  theme: string;
  isPrivate: boolean;
  password: string;
  requireAdminApproval: boolean;
  allowSpectators: boolean;
  clubMembersOnly: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Game Type", icon: Spade },
  { label: "Stakes", icon: Layers },
  { label: "Players", icon: Users },
  { label: "Timers", icon: Timer },
  { label: "Rules", icon: Settings2 },
  { label: "Theme", icon: Palette },
  { label: "Privacy", icon: ShieldCheck },
  { label: "Review", icon: ClipboardList },
];

const POKER_VARIANTS = [
  {
    id: "nlhe",
    name: "Texas Hold'em",
    tag: "NLHE",
    description: "The world's most popular poker variant. Two hole cards, five community cards.",
    players: "2-9",
    gradient: "from-blue-600/40 via-blue-500/20 to-amber-500/10",
    border: "border-blue-500/30",
    glow: "rgba(59,130,246,0.25)",
    icon: Spade,
  },
  {
    id: "plo",
    name: "Omaha",
    tag: "PLO",
    description: "Four hole cards, must use exactly two. Pot-limit betting, bigger action.",
    players: "2-9",
    gradient: "from-emerald-600/40 via-emerald-500/20 to-green-500/10",
    border: "border-emerald-500/30",
    glow: "rgba(16,185,129,0.25)",
    icon: Diamond,
  },
  {
    id: "short_deck",
    name: "Short Deck",
    tag: "6+",
    description: "Hold'em with 2-5 removed. Flush beats full house. Fast and aggressive.",
    players: "2-6",
    gradient: "from-red-600/40 via-red-500/20 to-orange-500/10",
    border: "border-red-500/30",
    glow: "rgba(239,68,68,0.25)",
    icon: Heart,
  },
  {
    id: "plo5",
    name: "PLO-5",
    tag: "PLO5",
    description: "Five hole cards, must use exactly two. Maximum draw equity and wild swings.",
    players: "2-6",
    gradient: "from-purple-600/40 via-purple-500/20 to-violet-500/10",
    border: "border-purple-500/30",
    glow: "rgba(139,92,246,0.25)",
    icon: Club,
  },
];

const MAX_PLAYER_OPTIONS = [2, 4, 6, 8, 9];
const TURN_TIMER_OPTIONS = [15, 20, 30, 45, 60];
const TIME_BANK_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "120s", value: 120 },
  { label: "180s", value: 180 },
];

const THEMES = [
  {
    id: "neon_vault",
    name: "Neon Vault",
    description: "Electric cyber aesthetic with neon glows",
    color: "#d4af37",
    tailwind: "amber",
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Classic green felt luxury table",
    color: "#10b981",
    tailwind: "emerald",
  },
  {
    id: "crimson",
    name: "Crimson",
    description: "Bold red for high-stakes drama",
    color: "#ef4444",
    tailwind: "red",
  },
  {
    id: "phantom",
    name: "Phantom",
    description: "Mysterious purple twilight vibes",
    color: "#8b5cf6",
    tailwind: "violet",
  },
  {
    id: "gold_rush",
    name: "Gold Rush",
    description: "Opulent gold and amber tones",
    color: "#f59e0b",
    tailwind: "amber",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Sleek dark minimalist elegance",
    color: "#6b7280",
    tailwind: "gray",
  },
];

const DEFAULT_CONFIG: TableConfig = {
  gameType: "cash",
  pokerVariant: "nlhe",
  name: "",
  smallBlind: 10,
  bigBlind: 20,
  minBuyIn: 40,
  maxBuyIn: 200,
  maxPlayers: 6,
  turnTimer: 30,
  timeBank: 60,
  ante: 0,
  straddle: false,
  runItTwice: false,
  bombPot: false,
  theme: "neon_vault",
  isPrivate: false,
  password: "",
  requireAdminApproval: false,
  allowSpectators: true,
  clubMembersOnly: false,
};

// ─── Animation variants ─────────────────────────────────────────────────────

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 w-full mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const Icon = STEPS[i].icon;
        const isCompleted = i < current;
        const isActive = i === current;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  boxShadow: isActive
                    ? "0 0 20px rgba(212,175,55,0.35)"
                    : isCompleted
                    ? "0 0 10px rgba(212,175,55,0.15)"
                    : "none",
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "bg-amber-500/25 border-2 border-amber-400"
                    : isCompleted
                    ? "bg-amber-500/15 border-2 border-amber-500/40"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-primary" : "text-gray-500"
                    }`}
                  />
                )}
              </motion.div>
              <span
                className={`text-[0.5rem] mt-1.5 font-bold uppercase tracking-wider text-center leading-tight ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                    ? "text-amber-500/60"
                    : "text-gray-600"
                }`}
              >
                {STEPS[i].label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={`h-px flex-1 mx-1 mt-[-14px] transition-colors duration-300 ${
                  i < current ? "bg-amber-500/40" : "bg-white/5"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold gold-text uppercase tracking-wider mb-1">
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-gray-500 mb-6">{children}</p>
  );
}

function EllipticalTable({ maxPlayers }: { maxPlayers: number }) {
  const seats = Array.from({ length: maxPlayers });
  const tableWidth = 260;
  const tableHeight = 140;
  const cx = tableWidth / 2;
  const cy = tableHeight / 2;
  const rx = cx - 20;
  const ry = cy - 20;

  return (
    <div className="flex justify-center mt-4 mb-2">
      <svg
        width={tableWidth}
        height={tableHeight}
        viewBox={`0 0 ${tableWidth} ${tableHeight}`}
        className="drop-shadow-lg"
      >
        {/* Table felt */}
        <defs>
          <radialGradient id="feltGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(212,175,55,0.12)" />
            <stop offset="100%" stopColor="rgba(212,175,55,0.03)" />
          </radialGradient>
        </defs>
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="url(#feltGrad)"
          stroke="rgba(212,175,55,0.25)"
          strokeWidth={2}
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 8}
          ry={ry - 8}
          fill="none"
          stroke="rgba(212,175,55,0.08)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Seat dots */}
        {seats.map((_, i) => {
          const angle = (2 * Math.PI * i) / maxPlayers - Math.PI / 2;
          const seatRx = rx + 6;
          const seatRy = ry + 6;
          const x = cx + seatRx * Math.cos(angle);
          const y = cy + seatRy * Math.sin(angle);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={10}
                fill="rgba(212,175,55,0.08)"
                stroke="rgba(212,175,55,0.3)"
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(212,175,55,0.7)"
                fontSize={8}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Step Components ────────────────────────────────────────────────────────

function StepGameType({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  return (
    <div>
      <SectionTitle>Choose Your Game</SectionTitle>
      <SectionSubtitle>
        Select a poker variant to determine the rules and hand rankings.
      </SectionSubtitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {POKER_VARIANTS.map((variant) => {
          const isSelected = config.pokerVariant === variant.id;
          const Icon = variant.icon;
          return (
            <motion.button
              key={variant.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                setConfig((prev) => ({ ...prev, pokerVariant: variant.id }))
              }
              className={`relative text-left rounded-xl p-5 transition-all border overflow-hidden ${
                isSelected ? variant.border : "border-white/5 hover:border-white/15"
              }`}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, rgba(20,31,40,0.6), rgba(16,24,36,0.95))`
                  : "linear-gradient(135deg, rgba(20,31,40,0.5), rgba(16,24,36,0.85))",
                boxShadow: isSelected
                  ? `0 0 30px ${variant.glow}`
                  : "none",
              }}
            >
              {/* Gradient overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${variant.gradient} transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-40"
                }`}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isSelected ? "bg-white/10" : "bg-white/5"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isSelected ? "text-white" : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {variant.name}
                        </span>
                        <span
                          className={`text-[0.5rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-white/15 text-white"
                              : "bg-white/5 text-gray-500"
                          }`}
                        >
                          {variant.tag}
                        </span>
                      </div>
                      <span className="text-[0.625rem] text-gray-500">
                        {variant.players} players
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 rounded-full bg-amber-500/25 border border-amber-400 flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </motion.div>
                  )}
                </div>

                <p className="text-[0.6875rem] text-gray-400 leading-relaxed mt-2">
                  {variant.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StepStakes({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  const handleSBChange = (val: string) => {
    const sb = Math.max(1, parseInt(val) || 0);
    setConfig((prev) => ({ ...prev, smallBlind: sb, bigBlind: sb * 2 }));
  };

  const handleBBChange = (val: string) => {
    const bb = Math.max(2, parseInt(val) || 0);
    setConfig((prev) => ({ ...prev, bigBlind: bb }));
  };

  const minChips = config.minBuyIn * config.bigBlind;
  const maxChips = config.maxBuyIn * config.bigBlind;

  return (
    <div>
      <SectionTitle>Stakes & Buy-in</SectionTitle>
      <SectionSubtitle>
        Set the blind levels and buy-in range for your table.
      </SectionSubtitle>

      <div className="space-y-5">
        {/* Table Name */}
        <div>
          <label htmlFor="table-name" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Table Name
            <span className="text-gray-600 font-normal ml-2">(optional)</span>
          </label>
          <input
            id="table-name"
            type="text"
            value={config.name}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Auto-generated if empty..."
            className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        {/* Blinds */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="small-blind" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Small Blind<span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="small-blind"
              type="number"
              required
              min={1}
              value={config.smallBlind}
              onChange={(e) => handleSBChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 tabular-nums"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
          <div>
            <label htmlFor="big-blind" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Big Blind<span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="big-blind"
              type="number"
              required
              min={config.smallBlind * 2}
              value={config.bigBlind}
              onChange={(e) => handleBBChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 tabular-nums"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
        </div>

        {/* Buy-in in BB multiples */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="min-buyin" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Min Buy-in (BB)<span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="min-buyin"
              type="number"
              required
              min={1}
              value={config.minBuyIn}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  minBuyIn: Math.max(1, parseInt(e.target.value) || 0),
                }))
              }
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 tabular-nums"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
          <div>
            <label htmlFor="max-buyin" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Max Buy-in (BB)<span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="max-buyin"
              type="number"
              required
              min={1}
              value={config.maxBuyIn}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  maxBuyIn: Math.max(1, parseInt(e.target.value) || 0),
                }))
              }
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 tabular-nums"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
        </div>

        {/* Buy-in ratio warning */}
        {config.minBuyIn < 20 && (
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-2"
            style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <span className="text-amber-400 text-sm">&#9888;</span>
            <span className="text-[0.6875rem] text-amber-400">
              Min buy-in is less than 20 BB. This may lead to very short-stacked play.
            </span>
          </div>
        )}

        {/* Calculated Range */}
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between"
          style={{
            background: "rgba(212,175,55,0.04)",
            border: "1px solid rgba(212,175,55,0.12)",
          }}
        >
          <span className="text-[0.6875rem] text-gray-400">
            Buy-in range in chips
          </span>
          <span className="text-sm font-bold text-primary tabular-nums">
            {minChips.toLocaleString()} &ndash; {maxChips.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepPlayers({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  return (
    <div>
      <SectionTitle>Players & Seating</SectionTitle>
      <SectionSubtitle>
        Choose the maximum number of players and preview the table layout.
      </SectionSubtitle>

      <label id="max-players-label" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-3">
        Max Players
      </label>
      <div className="flex gap-2 mb-6">
        {MAX_PLAYER_OPTIONS.map((n) => {
          const isActive = config.maxPlayers === n;
          return (
            <motion.button
              key={n}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setConfig((prev) => ({ ...prev, maxPlayers: n }))}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? "bg-amber-500/20 text-primary border-2 border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"
              }`}
            >
              {n}
            </motion.button>
          );
        })}
      </div>

      {/* Visual table preview */}
      <div
        className="vault-card p-4"
      >
        <div className="text-center text-[0.625rem] text-gray-500 uppercase tracking-wider font-bold mb-1">
          Table Preview
        </div>
        <EllipticalTable maxPlayers={config.maxPlayers} />
        <div className="text-center text-[0.625rem] text-gray-600 mt-1">
          {config.maxPlayers} seats around the table
        </div>
      </div>
    </div>
  );
}

function StepTimers({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  return (
    <div>
      <SectionTitle>Timer & Blind Structure</SectionTitle>
      <SectionSubtitle>
        Configure turn timers and time bank allocations.
      </SectionSubtitle>

      <div className="space-y-6">
        {/* Turn Timer */}
        <div>
          <label id="turn-timer-label" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Turn Timer
          </label>
          <div className="flex gap-2">
            {TURN_TIMER_OPTIONS.map((t) => {
              const isActive = config.turnTimer === t;
              return (
                <motion.button
                  key={t}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, turnTimer: t }))
                  }
                  className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                    isActive
                      ? "bg-amber-500/20 text-primary border-2 border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {t}s
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Time Bank */}
        <div>
          <label id="time-bank-label" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Time Bank
          </label>
          <div className="flex gap-2">
            {TIME_BANK_OPTIONS.map((opt) => {
              const isActive = config.timeBank === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, timeBank: opt.value }))
                  }
                  className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                    isActive
                      ? "bg-amber-500/20 text-primary border-2 border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRules({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  const toggles: {
    key: keyof TableConfig;
    label: string;
    description: string;
  }[] = [
    {
      key: "straddle",
      label: "Straddle",
      description:
        "Players can voluntarily post a blind raise before cards are dealt",
    },
    {
      key: "runItTwice",
      label: "Run It Twice",
      description:
        "When all-in, deal remaining community cards twice and split the pot",
    },
    {
      key: "bombPot",
      label: "Bomb Pots",
      description:
        "Periodic hands where everyone antes extra and goes straight to the flop",
    },
  ];

  return (
    <div>
      <SectionTitle>Advanced Rules</SectionTitle>
      <SectionSubtitle>
        Fine-tune optional game mechanics and special rules.
      </SectionSubtitle>

      <div className="space-y-5">
        {/* Ante */}
        <div>
          <label htmlFor="ante-amount" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Ante Amount
          </label>
          <input
            id="ante-amount"
            type="number"
            min={0}
            value={config.ante}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                ante: Math.max(0, parseInt(e.target.value) || 0),
              }))
            }
            placeholder="0"
            className="w-full max-w-xs px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40 tabular-nums"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <p className="text-[0.625rem] text-gray-600 mt-1">
            Set to 0 for no ante
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {toggles.map(({ key, label, description }) => {
            const isOn = config[key] as boolean;
            return (
              <div
                key={key}
                className={`rounded-xl p-4 flex items-center justify-between gap-4 transition-all cursor-pointer ${
                  isOn ? "border-amber-500/25" : "border-white/5"
                }`}
                style={{
                  background: isOn
                    ? "linear-gradient(135deg, rgba(212,175,55,0.05), rgba(20,31,40,0.8))"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isOn ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}
                onClick={() =>
                  setConfig((prev) => ({ ...prev, [key]: !prev[key as keyof TableConfig] }))
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-0.5">
                    {label}
                  </div>
                  <div className="text-[0.6875rem] text-gray-500 leading-relaxed">
                    {description}
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${
                    isOn ? "bg-primary" : "bg-white/10"
                  }`}
                >
                  <motion.div
                    animate={{ x: isOn ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-lg"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepTheme({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  return (
    <div>
      <SectionTitle>Table Theme</SectionTitle>
      <SectionSubtitle>
        Choose a visual theme for your table felt and accents.
      </SectionSubtitle>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES.map((theme) => {
          const isSelected = config.theme === theme.id;
          return (
            <motion.button
              key={theme.id}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() =>
                setConfig((prev) => ({ ...prev, theme: theme.id }))
              }
              className={`relative rounded-xl p-4 text-left transition-all ${
                isSelected
                  ? "border-2"
                  : "border border-white/5 hover:border-white/15"
              }`}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${theme.color}08, rgba(16,24,36,0.9))`
                  : "rgba(20,31,40,0.6)",
                borderColor: isSelected ? theme.color : undefined,
                boxShadow: isSelected
                  ? `0 0 25px ${theme.color}30`
                  : "none",
              }}
            >
              {/* Theme swatch */}
              <div
                className="w-full h-16 rounded-lg mb-2"
                style={{
                  background: `radial-gradient(ellipse at center, ${theme.color}40 0%, ${theme.color}15 50%, transparent 80%)`,
                }}
              />
              {/* Mini table preview */}
              <div
                className="w-full h-16 rounded-lg mb-3 relative overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, rgba(15,20,25,0.95) 0%, rgba(15,20,25,0.85) 100%)`,
                  border: `1px solid ${theme.color}20`,
                }}
              >
                {/* Table felt (oval) */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
                  style={{
                    width: "75%",
                    height: "70%",
                    background: `radial-gradient(ellipse at center, ${theme.color}35 0%, ${theme.color}18 60%, ${theme.color}08 100%)`,
                    border: `1.5px solid ${theme.color}50`,
                    boxShadow: `inset 0 0 12px ${theme.color}15, 0 0 8px ${theme.color}10`,
                  }}
                />
                {/* Rail accent line */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
                  style={{
                    width: "85%",
                    height: "82%",
                    border: `1px solid ${theme.color}20`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    background: theme.color,
                    boxShadow: `0 0 6px ${theme.color}60`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {theme.name}
                  </div>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check
                      className="w-4 h-4 shrink-0"
                      style={{ color: theme.color }}
                    />
                  </motion.div>
                )}
              </div>
              <p className="text-[0.625rem] text-gray-500 leading-relaxed">
                {theme.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[0.625rem] text-gray-600 mt-4 text-center">
        <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5" />
        Themes from your inventory
      </p>
    </div>
  );
}

function StepPrivacy({
  config,
  setConfig,
}: {
  config: TableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TableConfig>>;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const options = [
    {
      value: false,
      icon: Globe,
      label: "Public",
      description: "Anyone can find and join your table from the lobby",
    },
    {
      value: true,
      icon: Lock,
      label: "Private",
      description: "Only players with the password can join your table",
    },
  ];

  return (
    <div>
      <SectionTitle>Privacy Settings</SectionTitle>
      <SectionSubtitle>
        Control who can discover and join your table.
      </SectionSubtitle>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {options.map((opt) => {
          const isSelected = config.isPrivate === opt.value;
          const Icon = opt.icon;
          return (
            <motion.button
              key={String(opt.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  isPrivate: opt.value,
                  password: opt.value ? prev.password : "",
                }))
              }
              className={`relative text-left rounded-xl p-5 transition-all ${
                isSelected
                  ? "border-2 border-amber-400"
                  : "border border-white/5 hover:border-white/15"
              }`}
              style={{
                background: isSelected
                  ? "linear-gradient(135deg, rgba(212,175,55,0.06), rgba(20,31,40,0.85))"
                  : "rgba(20,31,40,0.5)",
                boxShadow: isSelected
                  ? "0 0 25px rgba(212,175,55,0.15)"
                  : "none",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-amber-500/20 border border-amber-500/30"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? "text-primary" : "text-gray-500"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        isSelected ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-amber-500/25 border border-amber-400 flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-gray-500 mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Password field */}
      <AnimatePresence>
        {config.isPrivate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <label htmlFor="table-password" className="block text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Table Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="table-password"
                type={showPassword ? "text" : "password"}
                value={config.password}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Enter a password..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-[#d4af37]/50 focus:border-[#d4af37]/40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Access Control Toggles */}
      <div className="mt-6">
        <div className="text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-3">
          Access Control
        </div>
        <div className="space-y-3">
          {([
            {
              key: "requireAdminApproval" as keyof TableConfig,
              label: "Require Admin Approval",
              description: "New players must be approved by an admin before joining",
            },
            {
              key: "allowSpectators" as keyof TableConfig,
              label: "Allow Spectators",
              description: "Non-players can watch the game without a seat",
            },
            {
              key: "clubMembersOnly" as keyof TableConfig,
              label: "Club Members Only",
              description: "Restrict table access to club members only",
            },
          ] as const).map(({ key, label, description }) => {
            const isOn = config[key] as boolean;
            return (
              <div
                key={key}
                className={`rounded-xl p-4 flex items-center justify-between gap-4 transition-all cursor-pointer ${
                  isOn ? "border-amber-500/25" : "border-white/5"
                }`}
                style={{
                  background: isOn
                    ? "linear-gradient(135deg, rgba(212,175,55,0.05), rgba(20,31,40,0.8))"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isOn ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}
                onClick={() =>
                  setConfig((prev) => ({ ...prev, [key]: !prev[key as keyof TableConfig] }))
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-0.5">
                    {label}
                  </div>
                  <div className="text-[0.6875rem] text-gray-500 leading-relaxed">
                    {description}
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${
                    isOn ? "bg-primary" : "bg-white/10"
                  }`}
                >
                  <motion.div
                    animate={{ x: isOn ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-lg"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepReview({
  config,
}: {
  config: TableConfig;
}) {
  const variant = POKER_VARIANTS.find((v) => v.id === config.pokerVariant);
  const theme = THEMES.find((t) => t.id === config.theme);

  const rows: { label: string; value: string }[] = [
    { label: "Poker Variant", value: variant ? `${variant.name} (${variant.tag})` : config.pokerVariant },
    { label: "Table Name", value: config.name || "Auto-generated" },
    { label: "Blinds", value: `${config.smallBlind} / ${config.bigBlind}` },
    {
      label: "Buy-in Range",
      value: `${config.minBuyIn}BB - ${config.maxBuyIn}BB (${(config.minBuyIn * config.bigBlind).toLocaleString()} - ${(config.maxBuyIn * config.bigBlind).toLocaleString()} chips)`,
    },
    { label: "Max Players", value: String(config.maxPlayers) },
    { label: "Turn Timer", value: `${config.turnTimer}s` },
    { label: "Time Bank", value: config.timeBank === 0 ? "Off" : `${config.timeBank}s` },
    { label: "Ante", value: config.ante === 0 ? "None" : String(config.ante) },
    { label: "Straddle", value: config.straddle ? "Enabled" : "Disabled" },
    { label: "Run It Twice", value: config.runItTwice ? "Enabled" : "Disabled" },
    { label: "Bomb Pots", value: config.bombPot ? "Enabled" : "Disabled" },
    { label: "Theme", value: theme?.name ?? config.theme },
    { label: "Privacy", value: config.isPrivate ? "Private (password protected)" : "Public" },
    { label: "Admin Approval", value: config.requireAdminApproval ? "Required" : "Not Required" },
    { label: "Spectators", value: config.allowSpectators ? "Allowed" : "Not Allowed" },
    { label: "Club Members Only", value: config.clubMembersOnly ? "Yes" : "No" },
  ];

  return (
    <div>
      <SectionTitle>Review & Create</SectionTitle>
      <SectionSubtitle>
        Confirm your table settings before launching.
      </SectionSubtitle>

      <div
        className="vault-card overflow-hidden"
      >
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-5 py-3 ${
              i % 2 === 0
                ? "bg-white/[0.02]"
                : "bg-transparent"
            } ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}
          >
            <span className="text-[0.6875rem] text-gray-500 font-medium">
              {row.label}
            </span>
            <span className="text-[0.8125rem] text-white font-bold text-right">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TableSetup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [config, setConfig] = useState<TableConfig>(DEFAULT_CONFIG);
  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  const totalSteps = STEPS.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step, totalSteps]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name || undefined,
          smallBlind: config.smallBlind,
          bigBlind: config.bigBlind,
          minBuyIn: config.minBuyIn * config.bigBlind,
          maxBuyIn: config.maxBuyIn * config.bigBlind,
          maxPlayers: config.maxPlayers,
          turnTimer: config.turnTimer,
          timeBankSeconds: config.timeBank,
          ante: config.ante,
          straddle: config.straddle,
          runItTwice: config.runItTwice,
          bombPot: config.bombPot,
          theme: config.theme,
          isPrivate: config.isPrivate,
          password: config.isPrivate ? config.password : undefined,
          pokerVariant: config.pokerVariant,
          gameType: config.gameType,
          requireAdminApproval: config.requireAdminApproval,
          allowSpectators: config.allowSpectators,
          clubMembersOnly: config.clubMembersOnly,
        }),
      });
      if (res.ok) {
        const table = await res.json();
        toast({
          title: "Table created",
          description: `Your table is ready. Redirecting...`,
        });
        setCreateSuccess(true);
        setTimeout(() => navigate(`/game/${table.id}`), 1000);
      } else {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        toast({
          title: "Creation failed",
          description: err.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Could not create the table. Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepGameType config={config} setConfig={setConfig} />;
      case 1:
        return <StepStakes config={config} setConfig={setConfig} />;
      case 2:
        return <StepPlayers config={config} setConfig={setConfig} />;
      case 3:
        return <StepTimers config={config} setConfig={setConfig} />;
      case 4:
        return <StepRules config={config} setConfig={setConfig} />;
      case 5:
        return <StepTheme config={config} setConfig={setConfig} />;
      case 6:
        return <StepPrivacy config={config} setConfig={setConfig} />;
      case 7:
        return <StepReview config={config} />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Create Table">
      <div className="px-4 md:px-8 pb-10 max-w-3xl mx-auto">
        {/* Mobile step progress */}
        <div className="md:hidden mb-4">
          <div className="text-xs text-primary font-bold mb-1">Step {step + 1} of {totalSteps}: {STEPS[step].label}</div>
          <div className="h-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={totalSteps} />

        {/* Step content with animation */}
        <div
          className="relative mb-6"
          style={{
            background: "linear-gradient(145deg, rgba(20,17,12,0.9) 0%, rgba(15,12,8,0.95) 100%)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "0.75rem",
            padding: "1.5rem 2rem",
            backdropFilter: "blur(20px)",
          }
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={!isFirst ? { scale: 1.03 } : {}}
            whileTap={!isFirst ? { scale: 0.97 } : {}}
            onClick={goPrev}
            disabled={isFirst}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              isFirst
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-300 border border-white/10 hover:border-white/20 hover:text-white"
            }`}
            style={
              isFirst
                ? {}
                : { background: "rgba(255,255,255,0.04)" }
            }
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </motion.button>

          {/* Step counter */}
          <span className="text-[0.625rem] text-gray-600 font-bold uppercase tracking-widest">
            Step {step + 1} of {totalSteps}
          </span>

          {isLast ? (
            <GoldButton
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 text-xs shadow-[0_0_25px_rgba(212,175,55,0.35)]"
            >
              <Rocket className="w-4 h-4" />
              {submitting ? "Launching..." : "Launch Table"}
            </GoldButton>
          ) : (
            <GoldButton
              onClick={goNext}
              className="flex items-center gap-2 text-xs shadow-[0_0_20px_rgba(212,175,55,0.25)]"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </GoldButton>
          )}
        </div>
      </div>

      {/* Success overlay */}
      <AnimatePresence>
        {createSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
              <p className="text-lg font-bold text-secondary">Table Created Successfully!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
