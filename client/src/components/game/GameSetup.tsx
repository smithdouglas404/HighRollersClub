import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ChevronRight, ChevronLeft, Zap, Shield, Crown, Star, Flame,
  Users, Coins, Clock, Bot, Trophy, Bomb, Swords, UserPlus,
  Gamepad2, Settings2, Wallet, AlertTriangle, ArrowRightLeft,
  Lock, Eye, EyeOff, Repeat, Gauge, Layers, RotateCcw,
  Timer, Rabbit, CreditCard, Percent, Hash, SlidersHorizontal,
  Shuffle, Coffee, Award, DollarSign, Info, MessageSquare,
  Check, Sparkles,
} from "lucide-react";
import { useWallet, type WalletType } from "@/lib/wallet-context";
import { AVATAR_OPTIONS, type AvatarOption } from "../poker/AvatarSelect";

import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.webp";

type GameFormat = "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot";

export interface GameSetupConfig {
  gameFormat: GameFormat;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  timeBankSeconds: number;
  allowBots: boolean;
  replaceBots: boolean;
  minBuyIn: number;
  maxBuyIn: number;
  buyInAmount: number;
  startingChips: number;
  blindPreset: string;
  bombPotFrequency: number;
  bombPotAnte: number;
  straddleEnabled: boolean;
  bigBlindAnte: boolean;
  runItTwice: "always" | "ask" | "no";
  rabbitHunting: boolean;
  showAllHands: boolean;
  autoTopUp: boolean;
  dealToAwayPlayers: boolean;
  autoTrimExcessBets: boolean;
  spectatorMode: boolean;
  guestChatEnabled: boolean;
  actionTimerSeconds: number;
  speedMultiplier: number;
  autoStartDelay: number;
  showdownSpeed: "fast" | "normal" | "slow";
  timeBankRefillHands: number;
  rakePercent: number;
  rakeCap: number;
  sevenTwoBounty: number;
  doubleBoard: boolean;
  pokerVariant: string;
  useCentsValues: boolean;
  isPrivate: boolean;
  tablePassword: string;
  allowReEntry: boolean;
  allowRebuy: boolean;
  lateRegistrationMinutes: number;
  breakIntervalMinutes: number;
  breakDurationMinutes: number;
  payoutStructure: string;
  customBlindSchedule: { level: number; sb: number; bb: number; ante: number; durationSeconds: number }[];
}

const FORMAT_OPTIONS: { key: GameFormat; label: string; icon: any; desc: string; color: string; rgb: string; tooltip: string }[] = [
  { key: "cash",       label: "Cash Game",  icon: Coins,  desc: "Standard ring game — join and leave anytime",     color: "amber",    rgb: "217,162,37", tooltip: "Cash Game — Play with chips worth real value. You can join or leave the table at any time." },
  { key: "sng",        label: "Sit & Go",   icon: Clock,  desc: "Fixed buy-in, rising blinds", color: "amber",   rgb: "245,158,11", tooltip: "Sit & Go (SNG) — A mini-tournament that starts when enough players join. Blinds increase over time." },
  { key: "tournament", label: "Tournament",  icon: Trophy, desc: "Multi-table, scheduled",  color: "emerald", rgb: "52,211,153", tooltip: "Tournament (MTT) — Compete against many players. Last one standing wins the prize pool." },
  { key: "heads_up",   label: "Heads Up",   icon: Swords, desc: "1v1 match",               color: "purple",  rgb: "168,85,247", tooltip: "Heads Up — A 1-on-1 match between two players. Great for practicing." },
  { key: "bomb_pot",   label: "Bomb Pot",   icon: Bomb,   desc: "Periodic bomb pots",      color: "red",     rgb: "239,68,68", tooltip: "Bomb Pot — Every few hands, all players put in extra chips and see a flop together. High action!" },
];

const TIER_CONFIG: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  legendary: { bg: "bg-cyan-500/10 border-cyan-500/20", text: "text-cyan-400", label: "LEGENDARY", icon: Crown },
  epic:      { bg: "bg-purple-500/10 border-purple-500/20", text: "text-purple-400", label: "EPIC", icon: Star },
  rare:      { bg: "bg-cyan-500/10 border-cyan-500/20", text: "text-cyan-400", label: "RARE", icon: Zap },
  common:    { bg: "bg-gray-500/10 border-gray-500/20", text: "text-gray-400", label: "COMMON", icon: Shield },
};

const TIER_FILTERS = ["all", "legendary", "epic", "rare"] as const;

interface GameSetupProps {
  mode: "offline" | "multiplayer";
  onStartOffline?: (avatar: AvatarOption, name: string, config: GameSetupConfig) => void;
  onCreateTable?: (config: GameSetupConfig & { name: string }) => void;
  onExit?: () => void;
}

const WIZARD_STEPS = [
  { key: "avatar",   label: "Avatar",      icon: Gamepad2 },
  { key: "format",   label: "Game Type",   icon: Trophy },
  { key: "stakes",   label: "Stakes",      icon: Coins },
  { key: "rules",    label: "Table Rules",  icon: Layers },
  { key: "speed",    label: "Speed & More", icon: Timer },
  { key: "review",   label: "Review",       icon: Sparkles },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]["key"];

export function GameSetup({ mode, onStartOffline, onCreateTable, onExit }: GameSetupProps) {
  const [step, setStep] = useState<WizardStep>("avatar");
  const [isReady, setIsReady] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>(AVATAR_OPTIONS[0]);
  const [playerName, setPlayerName] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const [gameFormat, setGameFormat] = useState<GameFormat>("cash");
  const [tableName, setTableName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [ante, setAnte] = useState(0);
  const [timeBankSeconds, setTimeBankSeconds] = useState(30);
  const [allowBots, setAllowBots] = useState(true);
  const [replaceBots, setReplaceBots] = useState(true);
  const [minBuyIn, setMinBuyIn] = useState(200);
  const [maxBuyIn, setMaxBuyIn] = useState(2000);
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [startingChips, setStartingChips] = useState(1500);
  const [blindPreset, setBlindPreset] = useState("standard");
  const [bombPotFrequency, setBombPotFrequency] = useState(5);
  const [bombPotAnte, setBombPotAnte] = useState(0);
  const [straddleEnabled, setStraddleEnabled] = useState(false);
  const [bigBlindAnte, setBigBlindAnte] = useState(false);
  const [runItTwice, setRunItTwice] = useState<"always" | "ask" | "no">("ask");
  const [rabbitHunting, setRabbitHunting] = useState(false);
  const [showAllHands, setShowAllHands] = useState(true);
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [dealToAwayPlayers, setDealToAwayPlayers] = useState(false);
  const [autoTrimExcessBets, setAutoTrimExcessBets] = useState(false);
  const [spectatorMode, setSpectatorMode] = useState(true);
  const [guestChatEnabled, setGuestChatEnabled] = useState(true);
  const [actionTimerSeconds, setActionTimerSeconds] = useState(15);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [autoStartDelay, setAutoStartDelay] = useState(5);
  const [showdownSpeed, setShowdownSpeed] = useState<"fast" | "normal" | "slow">("normal");
  const [timeBankRefillHands, setTimeBankRefillHands] = useState(0);
  const [rakePercent, setRakePercent] = useState(5);
  const [rakeCap, setRakeCap] = useState(0);
  const [sevenTwoBounty, setSevenTwoBounty] = useState(0);
  const [doubleBoard, setDoubleBoard] = useState(false);
  const [pokerVariant, setPokerVariant] = useState("nlhe");
  const [useCentsValues, setUseCentsValues] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [tablePassword, setTablePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowReEntry, setAllowReEntry] = useState(false);
  const [allowRebuy, setAllowRebuy] = useState(false);
  const [lateRegistrationMinutes, setLateRegistrationMinutes] = useState(15);
  const [breakIntervalMinutes, setBreakIntervalMinutes] = useState(60);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(5);
  const [payoutStructure, setPayoutStructure] = useState("standard");
  const [customBlindSchedule, setCustomBlindSchedule] = useState<{ level: number; sb: number; bb: number; ante: number; durationSeconds: number }[]>([]);

  const walletData = mode === "multiplayer" ? useWallet() : null;
  const relevantWalletType: WalletType = gameFormat === "sng" ? "sng"
    : gameFormat === "tournament" ? "tournament"
    : "cash_game";
  const relevantWalletLabel = gameFormat === "sng" ? "Sit & Go"
    : gameFormat === "tournament" ? "Tournament"
    : "Cash Game";
  const relevantBalance = walletData?.balances[relevantWalletType] ?? 0;
  const effectiveBuyIn = (gameFormat === "sng" || gameFormat === "tournament") ? buyInAmount : minBuyIn;
  const canAfford = mode === "offline" || relevantBalance >= effectiveBuyIn;

  const filteredAvatars = tierFilter === "all"
    ? AVATAR_OPTIONS
    : AVATAR_OPTIONS.filter(a => a.tier === tierFilter);

  const stepIndex = WIZARD_STEPS.findIndex(s => s.key === step);
  const selectedFormat = FORMAT_OPTIONS.find(f => f.key === gameFormat)!;

  const canProceedFromAvatar = playerName.trim().length > 0;

  const goNext = () => {
    const idx = stepIndex;
    if (idx < WIZARD_STEPS.length - 1) {
      setStep(WIZARD_STEPS[idx + 1].key);
    }
  };

  const goBack = () => {
    const idx = stepIndex;
    if (idx > 0) {
      setStep(WIZARD_STEPS[idx - 1].key);
    }
  };

  const goToStep = (target: WizardStep) => {
    const targetIdx = WIZARD_STEPS.findIndex(s => s.key === target);
    if (targetIdx <= stepIndex) {
      setStep(target);
    } else if (targetIdx === stepIndex + 1 && (step !== "avatar" || canProceedFromAvatar)) {
      setStep(target);
    }
  };

  const buildConfig = (): GameSetupConfig => ({
    gameFormat,
    maxPlayers: gameFormat === "heads_up" ? 2 : maxPlayers,
    smallBlind,
    bigBlind,
    ante,
    timeBankSeconds,
    allowBots,
    replaceBots: allowBots ? replaceBots : false,
    minBuyIn: (gameFormat === "sng" || gameFormat === "tournament") ? buyInAmount : minBuyIn,
    maxBuyIn: (gameFormat === "sng" || gameFormat === "tournament") ? buyInAmount : maxBuyIn,
    buyInAmount,
    startingChips,
    blindPreset,
    bombPotFrequency: gameFormat === "bomb_pot" ? bombPotFrequency : 0,
    bombPotAnte: gameFormat === "bomb_pot" ? (bombPotAnte || bigBlind) : 0,
    straddleEnabled,
    bigBlindAnte,
    runItTwice,
    rabbitHunting,
    showAllHands,
    autoTopUp,
    dealToAwayPlayers,
    autoTrimExcessBets,
    spectatorMode,
    guestChatEnabled,
    actionTimerSeconds,
    speedMultiplier,
    autoStartDelay,
    showdownSpeed,
    timeBankRefillHands,
    rakePercent: mode === "offline" ? 0 : rakePercent,
    rakeCap: mode === "offline" ? 0 : rakeCap,
    sevenTwoBounty,
    doubleBoard,
    pokerVariant,
    useCentsValues,
    isPrivate,
    tablePassword: isPrivate ? tablePassword : "",
    allowReEntry,
    allowRebuy,
    lateRegistrationMinutes,
    breakIntervalMinutes,
    breakDurationMinutes,
    payoutStructure,
    customBlindSchedule: blindPreset === "custom" ? customBlindSchedule : [],
  });

  const handleStart = () => {
    setIsReady(true);
    const config = buildConfig();
    setTimeout(() => {
      if (mode === "offline" && onStartOffline) {
        onStartOffline(selectedAvatar, playerName.trim(), config);
      } else if (mode === "multiplayer" && onCreateTable) {
        onCreateTable({ ...config, name: tableName.trim() || "My Table" });
      }
    }, 800);
  };

  const inputClass = "w-full bg-white/[0.07] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_8px_rgba(0,212,255,0.15)] transition-colors placeholder:text-gray-500";
  const labelClass = "text-[0.625rem] font-bold uppercase tracking-wider text-amber-400/80 block mb-1.5";

  const Toggle = ({ value, onChange, label, icon: Icon, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; icon: any; desc?: string }) => (
    <label className="flex items-center gap-3 cursor-pointer group py-1.5">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-cyan-500' : 'bg-white/10'} relative shrink-0`}
        data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-300 flex items-center gap-1.5 group-hover:text-white transition-colors">
          <Icon className="w-3 h-3 text-cyan-400/60 shrink-0" /> {label}
        </span>
        {desc && <div className="text-[0.5625rem] text-gray-400 mt-0.5 leading-relaxed">{desc}</div>}
      </div>
    </label>
  );

  const colorMap: Record<string, { icon: string; text: string }> = {
    cyan: { icon: "text-cyan-400/60", text: "text-cyan-400/80" },
    amber: { icon: "text-amber-400/60", text: "text-amber-400/80" },
    purple: { icon: "text-purple-400/60", text: "text-purple-400/80" },
    emerald: { icon: "text-emerald-400/60", text: "text-emerald-400/80" },
  };

  const SectionHeader = ({ label, icon: Icon, color = "cyan" }: { label: string; icon: any; color?: string }) => {
    const colors = colorMap[color] || colorMap.cyan;
    return (
      <div className="flex items-center gap-2 pt-1 pb-0.5">
        <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
        <span className={`text-[0.625rem] font-bold uppercase tracking-widest ${colors.text}`}>{label}</span>
        <div className="flex-1 h-px bg-white/[0.04]" />
      </div>
    );
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 max-w-2xl mx-auto">
      {WIZARD_STEPS.map((s, i) => {
        const isCurrent = s.key === step;
        const isCompleted = i < stepIndex;
        const isClickable = i < stepIndex || (i === stepIndex + 1 && (step !== "avatar" || canProceedFromAvatar));
        const StepIcon = s.icon;
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && (
              <div className="w-6 sm:w-10 h-px relative mx-0.5">
                <div className="absolute inset-0 bg-gray-700" />
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={false}
                  animate={{ width: isCompleted ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  style={{ backgroundColor: selectedAvatar.borderColor }}
                />
              </div>
            )}
            <button
              onClick={() => isClickable && goToStep(s.key)}
              disabled={!isClickable && !isCurrent}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all ${
                isCurrent
                  ? "text-white"
                  : isCompleted
                    ? "text-gray-400 hover:text-white cursor-pointer"
                    : "text-gray-600 cursor-not-allowed"
              }`}
              style={isCurrent ? { color: selectedAvatar.borderColor } : undefined}
              data-testid={`step-${s.key}`}
            >
              {isCompleted ? (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: selectedAvatar.borderColor }}
                >
                  <Check className="w-2.5 h-2.5 text-black" />
                </div>
              ) : (
                <StepIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );

  const NavButtons = ({ nextDisabled, nextLabel, onNext }: { nextDisabled?: boolean; nextLabel?: string; onNext?: () => void }) => (
    <motion.div
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="flex items-center gap-3 pt-2 max-w-lg mx-auto"
    >
      {stepIndex > 0 && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={goBack}
          className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wider text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </motion.button>
      )}
      <motion.button
        whileHover={!nextDisabled ? { scale: 1.03 } : undefined}
        whileTap={!nextDisabled ? { scale: 0.97 } : undefined}
        onClick={onNext || goNext}
        disabled={nextDisabled}
        className={`flex-1 rounded-xl px-7 py-3 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
          nextDisabled ? "text-gray-600 bg-gray-800/50 cursor-not-allowed" : "text-black"
        }`}
        style={!nextDisabled ? {
          background: `linear-gradient(135deg, ${selectedAvatar.borderColor}, ${selectedAvatar.borderColor}cc)`,
          boxShadow: `0 0 25px ${selectedAvatar.glowColor}, 0 4px 15px rgba(0,0,0,0.3)`,
        } : undefined}
        data-testid="button-next"
      >
        {nextLabel || "Next"}
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );

  const renderStepContent = () => {
    switch (step) {
      case "avatar":
        return (
          <>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-center gap-1"
            >
              {TIER_FILTERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`px-3 py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider transition-all ${
                    tierFilter === tier
                      ? tier === "all"
                        ? "bg-white/10 text-white border border-white/15"
                        : `${TIER_CONFIG[tier].bg} ${TIER_CONFIG[tier].text} border`
                      : "text-gray-600 hover:text-gray-400 border border-transparent"
                  }`}
                  data-testid={`filter-${tier}`}
                >
                  {tier === "all" ? "All" : TIER_CONFIG[tier].label}
                </button>
              ))}
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5"
            >
              {filteredAvatars.map((av, i) => {
                const isSelected = selectedAvatar.id === av.id;
                const tier = TIER_CONFIG[av.tier];
                const TierIcon = tier.icon;
                return (
                  <motion.button
                    key={av.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 + i * 0.02 }}
                    onClick={() => setSelectedAvatar(av)}
                    data-testid={`avatar-${av.id}`}
                    className={`relative rounded-xl overflow-hidden transition-all duration-300 group ${
                      isSelected ? "scale-[1.05] z-10" : "opacity-70 hover:opacity-100 hover:scale-[1.02]"
                    }`}
                    style={{
                      border: isSelected ? `2px solid ${av.borderColor}` : "2px solid rgba(255,255,255,0.05)",
                      boxShadow: isSelected ? `0 0 25px ${av.glowColor}, 0 8px 25px rgba(0,0,0,0.4)` : "0 4px 15px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className="aspect-square relative">
                      <img src={av.image} alt={av.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: av.borderColor, boxShadow: `0 0 10px ${av.glowColor}` }}
                        >
                          <Check className="w-2.5 h-2.5 text-black" />
                        </motion.div>
                      )}
                      <div className="absolute top-1 left-1">
                        <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[6px] font-bold uppercase tracking-wider ${tier.bg} ${tier.text} border backdrop-blur-sm`}>
                          <TierIcon className="w-2 h-2" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
                        <div className="text-[0.5rem] font-bold text-white truncate drop-shadow-lg">{av.name}</div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="max-w-lg mx-auto"
            >
              <div className="relative">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                  onKeyDown={(e) => e.key === "Enter" && canProceedFromAvatar && goNext()}
                  placeholder="Enter your player name..."
                  maxLength={16}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-all bg-white/[0.03] backdrop-blur-sm focus:bg-white/[0.05]"
                  style={{
                    border: playerName.trim() ? `1px solid ${selectedAvatar.borderColor}40` : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: playerName.trim() ? `0 0 15px ${selectedAvatar.glowColor.replace("0.3", "0.1")}` : "none",
                  }}
                  data-testid="input-player-name"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem] text-gray-600 font-mono">
                  {playerName.length}/16
                </div>
              </div>
            </motion.div>

            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (mode === "offline" && onStartOffline) {
                  setIsReady(true);
                  const practiceConfig: GameSetupConfig = {
                    ...buildConfig(),
                    gameFormat: "cash",
                    maxPlayers: 4,
                    smallBlind: 1,
                    bigBlind: 2,
                    ante: 0,
                    timeBankSeconds: 60,
                    minBuyIn: 100,
                    maxBuyIn: 500,
                    allowBots: true,
                    rakePercent: 0,
                    rakeCap: 0,
                  };
                  setTimeout(() => onStartOffline(selectedAvatar, playerName.trim() || "Player", practiceConfig), 800);
                } else {
                  handleStart();
                }
              }}
              className="w-full max-w-lg mx-auto rounded-xl px-5 py-3.5 text-left flex items-center gap-4 transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(0,212,255,0.05))",
                border: "1px solid rgba(52,211,153,0.2)",
                boxShadow: "0 0 20px rgba(52,211,153,0.08)",
              }}
              data-testid="button-practice-mode"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}
              >
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-emerald-300">Practice Mode</div>
                <div className="text-[0.5625rem] text-gray-400 mt-0.5">Micro stakes, 4 players — skip setup</div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500/50" />
            </motion.button>

            <NavButtons nextDisabled={!canProceedFromAvatar} nextLabel="Customize" />
          </>
        );

      case "format":
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="max-w-lg mx-auto space-y-4"
          >
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (mode === "offline" && onStartOffline) {
                  setIsReady(true);
                  const practiceConfig: GameSetupConfig = {
                    ...buildConfig(),
                    gameFormat: "cash",
                    maxPlayers: 4,
                    smallBlind: 1,
                    bigBlind: 2,
                    ante: 0,
                    timeBankSeconds: 60,
                    minBuyIn: 100,
                    maxBuyIn: 500,
                    allowBots: true,
                    rakePercent: 0,
                    rakeCap: 0,
                  };
                  setTimeout(() => onStartOffline(selectedAvatar, playerName.trim() || "Player", practiceConfig), 800);
                } else {
                  handleStart();
                }
              }}
              className="w-full rounded-xl px-5 py-4 text-left flex items-center gap-4 transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(0,212,255,0.05))",
                border: "1px solid rgba(52,211,153,0.2)",
                boxShadow: "0 0 20px rgba(52,211,153,0.08)",
              }}
              data-testid="button-practice-mode"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}
              >
                <Gamepad2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-emerald-300">Practice Mode</div>
                <div className="text-[0.625rem] text-gray-400 mt-0.5">Micro stakes, slow timer, 4 players — skip setup</div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500/50" />
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[0.5625rem] text-gray-400 font-bold uppercase tracking-wider">or choose a format</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="grid grid-cols-1 gap-2">
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
                      else if (maxPlayers === 2) setMaxPlayers(6);
                    }}
                    data-testid={`format-${opt.key}`}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                      isSelected
                        ? "border-transparent"
                        : "bg-white/[0.03] border-white/[0.08] text-gray-300 hover:border-white/15 hover:bg-white/[0.05]"
                    }`}
                    style={isSelected ? {
                      backgroundColor: `rgba(${opt.rgb},0.1)`,
                      borderColor: `rgba(${opt.rgb},0.3)`,
                      boxShadow: `0 0 20px rgba(${opt.rgb},0.1)`,
                      color: `rgb(${opt.rgb})`,
                    } : {}}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={isSelected
                        ? { background: `rgba(${opt.rgb},0.15)`, border: `1px solid rgba(${opt.rgb},0.3)` }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{opt.label}</div>
                      <div className="text-[0.625rem] text-gray-400 mt-0.5">{opt.desc}</div>
                    </div>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check className="w-5 h-5" />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            {mode === "multiplayer" && (
              <div>
                <label className={labelClass}>Table Name</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder={gameFormat === "sng" ? "Turbo SNG" : "High Stakes Showdown"}
                  className={inputClass}
                  maxLength={50}
                  data-testid="input-table-name"
                />
              </div>
            )}

            <NavButtons />
          </motion.div>
        );

      case "stakes":
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="max-w-lg mx-auto space-y-4"
          >
            <div
              className="rounded-2xl backdrop-blur-md bg-white/[0.04] border border-white/[0.1] p-5 space-y-4"
              style={{ boxShadow: `0 0 40px ${selectedAvatar.glowColor.replace("0.3", "0.05")}` }}
            >
              <div>
                <label className={`${labelClass} flex items-center gap-1`}>
                  <Users className="w-3 h-3" /> Max Players
                </label>
                <select
                  value={gameFormat === "heads_up" ? 2 : maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  disabled={gameFormat === "heads_up"}
                  className={`${inputClass} disabled:opacity-50`}
                  data-testid="select-max-players"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n} className="bg-gray-900">{n} Players</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`${labelClass} flex items-center gap-1`} title="Small Blind">
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
                    className={inputClass}
                    data-testid="input-small-blind"
                  />
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`} title="Big Blind">
                    <Coins className="w-3 h-3" /> Big Blind
                  </label>
                  <input
                    type="number"
                    value={bigBlind}
                    onChange={(e) => setBigBlind(parseInt(e.target.value) || 2)}
                    min={2}
                    className={inputClass}
                    data-testid="input-big-blind"
                  />
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`} title="Ante">
                    <Zap className="w-3 h-3" /> Ante
                  </label>
                  <input
                    type="number"
                    value={ante}
                    onChange={(e) => setAnte(parseInt(e.target.value) || 0)}
                    min={0}
                    className={inputClass}
                    data-testid="input-ante"
                  />
                </div>
              </div>

              {gameFormat !== "sng" && gameFormat !== "tournament" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Min Buy-In</label>
                    <input type="number" value={minBuyIn} onChange={(e) => setMinBuyIn(parseInt(e.target.value) || 100)} min={1} className={inputClass} data-testid="input-min-buyin" />
                  </div>
                  <div>
                    <label className={labelClass}>Max Buy-In</label>
                    <input type="number" value={maxBuyIn} onChange={(e) => setMaxBuyIn(parseInt(e.target.value) || 1000)} min={1} className={inputClass} data-testid="input-max-buyin" />
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {(gameFormat === "sng" || gameFormat === "tournament") && (
                  <motion.div
                    key="sng-fields"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-4 rounded-xl border space-y-4 ${gameFormat === "tournament" ? "border-emerald-500/15 bg-emerald-500/5" : "border-cyan-500/15 bg-cyan-500/5"}`}>
                      <div className={`text-[0.625rem] font-bold uppercase tracking-wider ${gameFormat === "tournament" ? "text-emerald-400" : "text-cyan-400"}`}>
                        {gameFormat === "tournament" ? "Tournament Settings" : "SNG Settings"}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={`${labelClass} flex items-center gap-1`}>
                            <CreditCard className="w-3 h-3" /> Buy-In
                          </label>
                          <input type="number" value={buyInAmount} onChange={(e) => setBuyInAmount(parseInt(e.target.value) || 100)} min={100} className={inputClass} data-testid="input-buyin" />
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1`}>
                            <Coins className="w-3 h-3" /> Starting Chips
                          </label>
                          <input type="number" value={startingChips} onChange={(e) => setStartingChips(parseInt(e.target.value) || 1500)} min={100} className={inputClass} data-testid="input-starting-chips" />
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1`}>
                            <Gauge className="w-3 h-3" /> Blind Speed
                          </label>
                          <select value={blindPreset} onChange={(e) => {
                            setBlindPreset(e.target.value);
                            if (e.target.value === "custom" && customBlindSchedule.length === 0) {
                              setCustomBlindSchedule([
                                { level: 1, sb: 10, bb: 20, ante: 0, durationSeconds: 300 },
                                { level: 2, sb: 20, bb: 40, ante: 0, durationSeconds: 300 },
                                { level: 3, sb: 30, bb: 60, ante: 5, durationSeconds: 300 },
                                { level: 4, sb: 50, bb: 100, ante: 10, durationSeconds: 300 },
                                { level: 5, sb: 100, bb: 200, ante: 20, durationSeconds: 300 },
                              ]);
                            }
                          }} className={inputClass} data-testid="select-blind-speed">
                            <option value="hyper" className="bg-gray-900">Hyper Turbo (2min)</option>
                            <option value="turbo" className="bg-gray-900">Turbo (3min)</option>
                            <option value="standard" className="bg-gray-900">Standard (5min)</option>
                            <option value="mtt" className="bg-gray-900">Slow (10min)</option>
                            <option value="deep" className="bg-gray-900">Deep Stack (15min)</option>
                            <option value="custom" className="bg-gray-900">Custom Schedule</option>
                          </select>
                        </div>
                      </div>

                      {blindPreset === "custom" && (
                        <div className="space-y-2 mt-2">
                          <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-cyan-400/60">Blind Schedule</div>
                          <div className="space-y-1">
                            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1.5rem] gap-1 text-[0.5rem] font-bold uppercase tracking-wider text-gray-600 px-1">
                              <span>Lvl</span><span>SB</span><span>BB</span><span>Ante</span><span>Time</span><span></span>
                            </div>
                            {customBlindSchedule.map((level, idx) => (
                              <div key={idx} className="grid grid-cols-[2rem_1fr_1fr_1fr_1fr_1.5rem] gap-1 items-center">
                                <span className="text-[0.625rem] text-gray-500 text-center">{level.level}</span>
                                <input type="number" value={level.sb} min={1} onChange={(e) => {
                                  const v = parseInt(e.target.value) || 1;
                                  setCustomBlindSchedule(prev => prev.map((l, i) => i === idx ? { ...l, sb: v } : l));
                                }} className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[0.625rem] text-white w-full" />
                                <input type="number" value={level.bb} min={2} onChange={(e) => {
                                  const v = parseInt(e.target.value) || 2;
                                  setCustomBlindSchedule(prev => prev.map((l, i) => i === idx ? { ...l, bb: v } : l));
                                }} className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[0.625rem] text-white w-full" />
                                <input type="number" value={level.ante} min={0} onChange={(e) => {
                                  const v = parseInt(e.target.value) || 0;
                                  setCustomBlindSchedule(prev => prev.map((l, i) => i === idx ? { ...l, ante: v } : l));
                                }} className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[0.625rem] text-white w-full" />
                                <select value={level.durationSeconds} onChange={(e) => {
                                  const v = parseInt(e.target.value);
                                  setCustomBlindSchedule(prev => prev.map((l, i) => i === idx ? { ...l, durationSeconds: v } : l));
                                }} className="bg-white/5 border border-white/10 rounded px-1 py-1 text-[0.625rem] text-white w-full">
                                  {[120, 180, 300, 420, 600, 900].map(s => (
                                    <option key={s} value={s} className="bg-gray-900">{s / 60}m</option>
                                  ))}
                                </select>
                                <button onClick={() => {
                                  if (customBlindSchedule.length > 2) {
                                    setCustomBlindSchedule(prev => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 })));
                                  }
                                }} className="text-gray-600 hover:text-red-400 transition-colors text-center text-xs">
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const last = customBlindSchedule[customBlindSchedule.length - 1];
                              setCustomBlindSchedule(prev => [...prev, {
                                level: prev.length + 1,
                                sb: last ? last.sb * 2 : 10,
                                bb: last ? last.bb * 2 : 20,
                                ante: last ? Math.max(last.ante * 2, last.bb / 4) : 0,
                                durationSeconds: last?.durationSeconds || 300,
                              }]);
                            }}
                            className="w-full py-1.5 rounded-lg text-[0.5625rem] font-bold uppercase tracking-wider text-cyan-400/80 border border-cyan-500/20 hover:bg-cyan-500/10 transition-colors"
                          >
                            + Add Level
                          </button>
                        </div>
                      )}

                      <div className="h-px bg-white/[0.06]" />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                        <Toggle value={allowReEntry} onChange={setAllowReEntry} icon={RotateCcw} label="Re-Entry" desc="Eliminated players can re-enter" />
                        <Toggle value={allowRebuy} onChange={setAllowRebuy} icon={Repeat} label="Rebuy" desc="Players can rebuy before elimination" />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={`${labelClass} flex items-center gap-1`}>
                            <Clock className="w-3 h-3" /> Late Registration
                          </label>
                          <select value={lateRegistrationMinutes} onChange={(e) => setLateRegistrationMinutes(parseInt(e.target.value))} className={inputClass} data-testid="select-late-reg">
                            {[0, 5, 10, 15, 20, 30, 45, 60].map(n => (
                              <option key={n} value={n} className="bg-gray-900">{n === 0 ? "None" : `${n} min`}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={`${labelClass} flex items-center gap-1`}>
                            <Coffee className="w-3 h-3" /> Break Every
                          </label>
                          <select value={breakIntervalMinutes} onChange={(e) => setBreakIntervalMinutes(parseInt(e.target.value))} className={inputClass} data-testid="select-break-interval">
                            {[0, 30, 45, 60, 90, 120].map(n => (
                              <option key={n} value={n} className="bg-gray-900">{n === 0 ? "No Breaks" : `${n} min`}</option>
                            ))}
                          </select>
                        </div>
                        {breakIntervalMinutes > 0 && (
                          <div>
                            <label className={`${labelClass} flex items-center gap-1`}>
                              <Clock className="w-3 h-3" /> Break Length
                            </label>
                            <select value={breakDurationMinutes} onChange={(e) => setBreakDurationMinutes(parseInt(e.target.value))} className={inputClass} data-testid="select-break-duration">
                              {[3, 5, 8, 10, 15].map(n => (
                                <option key={n} value={n} className="bg-gray-900">{n} min</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={`${labelClass} flex items-center gap-1`}>
                          <Award className="w-3 h-3" /> Payout Structure
                        </label>
                        <select value={payoutStructure} onChange={(e) => setPayoutStructure(e.target.value)} className={inputClass} data-testid="select-payout">
                          <option value="standard" className="bg-gray-900">Standard — Top 15% paid</option>
                          <option value="top-heavy" className="bg-gray-900">Top Heavy — Winner takes more</option>
                          <option value="flat" className="bg-gray-900">Flat — Even distribution</option>
                          <option value="winner-take-all" className="bg-gray-900">Winner Take All</option>
                          <option value="top3" className="bg-gray-900">Top 3 Only</option>
                          <option value="satellite" className="bg-gray-900">Satellite — Seats awarded</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {gameFormat === "bomb_pot" && (
                  <motion.div
                    key="bomb-fields"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 rounded-lg border border-red-500/15 bg-red-500/5">
                      <div className="text-[0.625rem] font-bold uppercase tracking-wider text-red-400 mb-3">Bomb Pot Settings</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Every N Hands</label>
                          <select value={bombPotFrequency} onChange={(e) => setBombPotFrequency(parseInt(e.target.value))} className={inputClass}>
                            {[3, 5, 7, 10].map(n => (
                              <option key={n} value={n} className="bg-gray-900">Every {n} hands</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Bomb Ante</label>
                          <input type="number" value={bombPotAnte} onChange={(e) => setBombPotAnte(parseInt(e.target.value) || 0)} min={0} placeholder={`${bigBlind}`} className={inputClass} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === "multiplayer" && walletData && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                  canAfford ? "bg-white/[0.03] border-white/[0.06]" : "bg-red-500/5 border-red-500/15"
                }`}>
                  <Wallet className={`w-3.5 h-3.5 shrink-0 ${canAfford ? "text-cyan-400" : "text-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.625rem] text-gray-400">{relevantWalletLabel} Wallet:</span>
                      <span className={`text-xs font-bold tabular-nums ${canAfford ? "text-white" : "text-red-400"}`}>
                        {relevantBalance.toLocaleString()}
                      </span>
                      <span className="text-[0.5rem] text-cyan-600 uppercase">chips</span>
                    </div>
                    {!canAfford && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="text-[0.5625rem] text-red-400">
                          Need {(effectiveBuyIn - relevantBalance).toLocaleString()} more chips
                        </span>
                        <span className="text-[0.5rem] text-gray-600">—</span>
                        <Link href={`/wallet?tab=transfer&to=${relevantWalletType}`}>
                          <span className="text-[0.5625rem] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-0.5">
                            <ArrowRightLeft className="w-2.5 h-2.5" /> Transfer Funds
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <NavButtons />
          </motion.div>
        );

      case "rules":
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="max-w-lg mx-auto space-y-4"
          >
            <div
              className="rounded-2xl backdrop-blur-md bg-white/[0.04] border border-white/[0.1] p-5 space-y-4"
              style={{ boxShadow: `0 0 40px ${selectedAvatar.glowColor.replace("0.3", "0.05")}` }}
            >
              <SectionHeader label="Table Rules" icon={Layers} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                <Toggle value={straddleEnabled} onChange={setStraddleEnabled} icon={DollarSign} label="Straddle" desc="UTG can post 2x BB blind pre-flop" />
                <Toggle value={bigBlindAnte} onChange={setBigBlindAnte} icon={Coins} label="Big Blind Ante" desc="Only BB posts the ante each hand" />
                <Toggle value={rabbitHunting} onChange={setRabbitHunting} icon={Rabbit} label="Rabbit Hunting" desc="Peek at undealt cards after fold" />
                <Toggle value={showAllHands} onChange={setShowAllHands} icon={Eye} label="Show All Hands" desc="Reveal all cards at showdown" />
                {gameFormat !== "sng" && gameFormat !== "tournament" && (
                  <Toggle value={autoTopUp} onChange={setAutoTopUp} icon={RotateCcw} label="Auto Top-Up" desc="Auto-rebuy to max buy-in when short" />
                )}
                <Toggle value={dealToAwayPlayers} onChange={setDealToAwayPlayers} icon={Users} label="Deal to Away" desc="Deal cards to sitting-out players" />
                <Toggle value={spectatorMode} onChange={setSpectatorMode} icon={Eye} label="Spectators" desc="Allow non-players to watch" />
                <Toggle value={guestChatEnabled} onChange={setGuestChatEnabled} icon={MessageSquare} label="Guest Chat" desc="Allow guests to send chat messages" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Repeat className="w-3 h-3" /> Run It Twice
                  </label>
                  <select value={runItTwice} onChange={(e) => setRunItTwice(e.target.value as "always" | "ask" | "no")} className={inputClass}>
                    <option value="no" className="bg-gray-900">No</option>
                    <option value="ask" className="bg-gray-900">Ask Players</option>
                    <option value="always" className="bg-gray-900">Always</option>
                  </select>
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Swords className="w-3 h-3" /> 7-2 Bounty
                  </label>
                  <select value={sevenTwoBounty} onChange={(e) => setSevenTwoBounty(parseInt(e.target.value))} className={inputClass}>
                    <option value={0} className="bg-gray-900">Disabled</option>
                    <option value={5} className="bg-gray-900">5 chips/player</option>
                    <option value={10} className="bg-gray-900">10 chips/player</option>
                    <option value={20} className="bg-gray-900">20 chips/player</option>
                    <option value={50} className="bg-gray-900">50 chips/player</option>
                  </select>
                </div>
              </div>
            </div>

            <NavButtons />
          </motion.div>
        );

      case "speed":
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="max-w-lg mx-auto space-y-4"
          >
            <div
              className="rounded-2xl backdrop-blur-md bg-white/[0.04] border border-white/[0.1] p-5 space-y-4"
              style={{ boxShadow: `0 0 40px ${selectedAvatar.glowColor.replace("0.3", "0.05")}` }}
            >
              <SectionHeader label="Speed & Timing" icon={Timer} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Timer className="w-3 h-3" /> Action Timer
                  </label>
                  <select value={actionTimerSeconds} onChange={(e) => setActionTimerSeconds(parseInt(e.target.value))} className={inputClass} data-testid="select-action-timer">
                    {[5, 8, 10, 12, 15, 20, 25, 30, 45, 60].map(n => (
                      <option key={n} value={n} className="bg-gray-900">{n}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Clock className="w-3 h-3" /> Time Bank
                  </label>
                  <select value={timeBankSeconds} onChange={(e) => setTimeBankSeconds(parseInt(e.target.value))} className={inputClass} data-testid="select-time-bank">
                    {[10, 15, 20, 30, 45, 60, 90, 120, 180].map((n) => (
                      <option key={n} value={n} className="bg-gray-900">{n}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Gauge className="w-3 h-3" /> Game Speed
                  </label>
                  <select value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))} className={inputClass} data-testid="select-speed">
                    <option value={0.5} className="bg-gray-900">Turbo (2x)</option>
                    <option value={0.75} className="bg-gray-900">Fast (1.5x)</option>
                    <option value={1.0} className="bg-gray-900">Normal</option>
                    <option value={1.5} className="bg-gray-900">Relaxed (0.75x)</option>
                    <option value={2.0} className="bg-gray-900">Slow (0.5x)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Shuffle className="w-3 h-3" /> Auto-Start
                  </label>
                  <select value={autoStartDelay} onChange={(e) => setAutoStartDelay(parseInt(e.target.value))} className={inputClass} data-testid="select-auto-start">
                    {[0, 3, 5, 8, 10, 15].map(n => (
                      <option key={n} value={n} className="bg-gray-900">{n === 0 ? "Instant" : `${n}s`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <Eye className="w-3 h-3" /> Showdown
                  </label>
                  <select value={showdownSpeed} onChange={(e) => setShowdownSpeed(e.target.value as "fast" | "normal" | "slow")} className={inputClass}>
                    <option value="fast" className="bg-gray-900">Fast</option>
                    <option value="normal" className="bg-gray-900">Normal</option>
                    <option value="slow" className="bg-gray-900">Slow</option>
                  </select>
                </div>
                <div>
                  <label className={`${labelClass} flex items-center gap-1`}>
                    <RotateCcw className="w-3 h-3" /> Bank Refill
                  </label>
                  <select value={timeBankRefillHands} onChange={(e) => setTimeBankRefillHands(parseInt(e.target.value))} className={inputClass}>
                    <option value={0} className="bg-gray-900">No refill</option>
                    <option value={5} className="bg-gray-900">5 hands</option>
                    <option value={10} className="bg-gray-900">10 hands</option>
                    <option value={20} className="bg-gray-900">20 hands</option>
                  </select>
                </div>
              </div>

              {mode === "multiplayer" && (
                <>
                  <SectionHeader label="Rake" icon={Percent} color="amber" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`${labelClass} flex items-center gap-1`}>
                        <Percent className="w-3 h-3" /> Rake %
                      </label>
                      <select value={rakePercent} onChange={(e) => setRakePercent(parseFloat(e.target.value))} className={inputClass} data-testid="select-rake">
                        {[0, 1, 2, 2.5, 3, 4, 5, 7, 10].map(n => (
                          <option key={n} value={n} className="bg-gray-900">{n === 0 ? "No Rake" : `${n}%`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`${labelClass} flex items-center gap-1`}>
                        <CreditCard className="w-3 h-3" /> Rake Cap
                      </label>
                      <input type="number" value={rakeCap} onChange={(e) => setRakeCap(parseInt(e.target.value) || 0)} min={0} placeholder="No cap" className={inputClass} data-testid="input-rake-cap" />
                    </div>
                  </div>

                  <SectionHeader label="Privacy" icon={Lock} color="purple" />
                  <Toggle value={isPrivate} onChange={setIsPrivate} icon={Lock} label="Private Table" desc="Only players with the password can join" />
                  <AnimatePresence>
                    {isPrivate && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="relative">
                          <label className={labelClass}>Table Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={tablePassword}
                              onChange={(e) => setTablePassword(e.target.value)}
                              placeholder="Enter password..."
                              className={`${inputClass} pr-10`}
                              maxLength={30}
                              data-testid="input-table-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              <SectionHeader label="Bots & AI" icon={Bot} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                <Toggle value={allowBots} onChange={setAllowBots} icon={Bot} label="Allow Bots" desc="Fill empty seats with AI players" />
                {allowBots && (
                  <Toggle value={replaceBots} onChange={setReplaceBots} icon={UserPlus} label="Replace Bots" desc="Swap bots out when humans join" />
                )}
              </div>
            </div>

            <NavButtons />
          </motion.div>
        );

      case "review":
        return (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="max-w-lg mx-auto space-y-4"
          >
            <div className="flex items-center gap-4 p-4 rounded-xl backdrop-blur-md bg-white/[0.04] border border-white/[0.08]">
              <div
                className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                style={{ border: `2px solid ${selectedAvatar.borderColor}`, boxShadow: `0 0 12px ${selectedAvatar.glowColor}` }}
              >
                <img src={selectedAvatar.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{playerName}</div>
                <div className={`text-[0.5625rem] font-bold uppercase tracking-wider ${TIER_CONFIG[selectedAvatar.tier].text}`}>
                  {selectedAvatar.name} — {TIER_CONFIG[selectedAvatar.tier].label}
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl backdrop-blur-md bg-white/[0.04] border border-white/[0.1] p-5 space-y-3"
              style={{ boxShadow: `0 0 40px ${selectedAvatar.glowColor.replace("0.3", "0.05")}` }}
            >
              <div className="text-[0.625rem] font-bold uppercase tracking-widest text-cyan-400/80 mb-2">Game Summary</div>

              <ReviewRow label="Format" value={selectedFormat.label} icon={selectedFormat.icon} />
              {mode === "multiplayer" && tableName && <ReviewRow label="Table" value={tableName} icon={Settings2} />}
              <ReviewRow label="Players" value={`${gameFormat === "heads_up" ? 2 : maxPlayers} max`} icon={Users} />
              <ReviewRow label="Blinds" value={`${smallBlind}/${bigBlind}${ante > 0 ? ` + ${ante} ante` : ""}`} icon={Coins} />
              {(gameFormat === "sng" || gameFormat === "tournament") ? (
                <>
                  <ReviewRow label="Buy-In" value={`${buyInAmount} chips`} icon={CreditCard} />
                  <ReviewRow label="Starting Stack" value={`${startingChips.toLocaleString()} chips`} icon={Coins} />
                </>
              ) : (
                <ReviewRow label="Buy-In Range" value={`${minBuyIn} – ${maxBuyIn}`} icon={CreditCard} />
              )}
              <ReviewRow label="Action Timer" value={`${actionTimerSeconds}s + ${timeBankSeconds}s bank`} icon={Timer} />
              {allowBots && <ReviewRow label="Bots" value="Enabled" icon={Bot} />}
              {isPrivate && <ReviewRow label="Privacy" value="Password Protected" icon={Lock} />}
              {straddleEnabled && <ReviewRow label="Straddle" value="Enabled" icon={DollarSign} />}
              {sevenTwoBounty > 0 && <ReviewRow label="7-2 Bounty" value={`${sevenTwoBounty} chips`} icon={Swords} />}
            </div>

            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 pt-1 max-w-lg mx-auto"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goBack}
                className="flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                data-testid="button-back-review"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </motion.button>
              <motion.button
                whileHover={canAfford ? { scale: 1.03 } : undefined}
                whileTap={canAfford ? { scale: 0.97 } : undefined}
                onClick={handleStart}
                disabled={!canAfford}
                className={`flex-1 rounded-xl px-7 py-3.5 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  canAfford ? "text-black" : "text-gray-500 bg-gray-800/50 cursor-not-allowed border border-white/[0.06]"
                }`}
                style={canAfford ? {
                  background: `linear-gradient(135deg, ${selectedAvatar.borderColor}, ${selectedAvatar.borderColor}cc)`,
                  boxShadow: `0 0 25px ${selectedAvatar.glowColor}, 0 4px 15px rgba(0,0,0,0.3)`,
                } : undefined}
                data-testid="button-start-game"
              >
                {!canAfford ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    INSUFFICIENT FUNDS
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    {mode === "offline" ? "START GAME" : "CREATE TABLE"}
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        );
    }
  };

  const stepTitles: Record<WizardStep, string> = {
    avatar: "CHOOSE YOUR AVATAR",
    format: "SELECT GAME TYPE",
    stakes: "SET YOUR STAKES",
    rules: "TABLE RULES",
    speed: "SPEED & EXTRAS",
    review: "REVIEW & LAUNCH",
  };

  return (
    <AnimatePresence mode="wait">
      {isReady ? (
        <motion.div
          key="transition"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.8 }}
          className="min-h-screen bg-[#111b2a] flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="font-display text-xl tracking-widest" style={{ color: selectedAvatar.borderColor }}>
              ENTERING TABLE...
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key={`step-${step}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-[#111b2a] text-white flex flex-col items-center relative overflow-hidden"
          style={{ justifyContent: "safe center", paddingTop: "2vh", paddingBottom: "2vh" }}
        >
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,20,30,0.4)_0%,rgba(0,0,0,0.95)_70%)]" />
          </div>
          <div className="absolute inset-0 z-[2] pointer-events-none">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full transition-all duration-700"
              style={{ background: `radial-gradient(circle, ${selectedAvatar.glowColor} 0%, transparent 60%)` }}
            />
          </div>

          <div className="relative z-10 w-full max-w-4xl px-6 space-y-4 overflow-y-auto" style={{ maxHeight: "96vh" }}>
            <div className="flex justify-start">
              {onExit ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onExit}
                  data-testid="button-exit-setup"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to Lobby
                </motion.button>
              ) : (
                <Link href="/lobby">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back to Lobby
                  </motion.button>
                </Link>
              )}
            </div>

            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center space-y-3"
            >
              <div className="w-12 h-12 mx-auto relative">
                <div className="absolute inset-[-6px] bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                <img src={lionLogo} alt="" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(0,212,255,0.5)]" />
              </div>
              <h1 className="font-display text-lg font-bold tracking-[0.2em] gold-text">
                {stepTitles[step]}
              </h1>
              <StepIndicator />
            </motion.div>

            {renderStepContent()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReviewRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <Icon className="w-3.5 h-3.5 text-cyan-400/50 shrink-0" />
      <span className="text-[0.6875rem] text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-[0.6875rem] text-white font-medium">{value}</span>
    </div>
  );
}
