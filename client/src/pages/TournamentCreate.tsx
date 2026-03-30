import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Trophy, Clock, Coins, Users, Lock, Plus, Trash2,
  Loader2, ChevronRight, ChevronLeft, Calendar, Settings,
  DollarSign, Scale, Timer, Layers, Sparkles, Shield,
  Coffee, Zap, Eye,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type GameType = "texas_holdem" | "omaha" | "short_deck" | "plo5";
type PayoutStructure = "top_15" | "top_10" | "top_20" | "winner_take_all";
type RegistrationCloseTime = "15min" | "30min" | "1hr" | "at_start";
type TimeBankOption = 30 | 60 | 90 | 120;
type BlindInterval = 10 | 15 | 20 | 30;
type NumberOfLevels = 6 | 8 | 10 | 12;
type TabKey = "general" | "structure" | "financials" | "rules";

interface BreakSchedule {
  id: string;
  everyXLevels: number;
  durationMinutes: number;
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

const GAME_TYPES: { key: GameType; label: string; desc: string; icon: typeof Trophy }[] = [
  { key: "texas_holdem", label: "Texas Hold'em", desc: "Classic 2-card poker", icon: Sparkles },
  { key: "omaha", label: "Omaha", desc: "4-card action", icon: Layers },
  { key: "short_deck", label: "Short Deck", desc: "36-card deck, faster play", icon: Zap },
  { key: "plo5", label: "PLO5", desc: "5-card Pot Limit Omaha", icon: Shield },
];

const TABS: { key: TabKey; label: string; icon: typeof Trophy }[] = [
  { key: "general", label: "General", icon: Settings },
  { key: "structure", label: "Structure", icon: Layers },
  { key: "financials", label: "Financials", icon: DollarSign },
  { key: "rules", label: "Rules", icon: Scale },
];

const REG_CLOSE_OPTIONS: { value: RegistrationCloseTime; label: string }[] = [
  { value: "15min", label: "15 min before" },
  { value: "30min", label: "30 min before" },
  { value: "1hr", label: "1 hour before" },
  { value: "at_start", label: "At start time" },
];

const PAYOUT_OPTIONS: { value: PayoutStructure; label: string; desc: string }[] = [
  { value: "top_15", label: "Top 15% Standard", desc: "Standard payout to top 15% of field" },
  { value: "top_10", label: "Top 10%", desc: "Steeper payouts, fewer winners" },
  { value: "top_20", label: "Top 20%", desc: "Flatter payout, more winners" },
  { value: "winner_take_all", label: "Winner Take All", desc: "Entire prize pool to 1st place" },
];

/* ─── Tab transition variants ─────────────────────────────────────────────── */

const tabVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 60 : -60,
    opacity: 0,
  }),
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

let breakIdCounter = 0;
function nextBreakId() {
  breakIdCounter += 1;
  return `break_${breakIdCounter}_${Date.now()}`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function TournamentCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [tabDirection, setTabDirection] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  /* ── General tab state ── */
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<GameType>("texas_holdem");
  const [startDate, setStartDate] = useState("");
  const [buyIn, setBuyIn] = useState(100);
  const [regFee, setRegFee] = useState(10);
  const [regCloseTime, setRegCloseTime] = useState<RegistrationCloseTime>("30min");
  const [lateRegistration, setLateRegistration] = useState(true);
  const [numberOfLevels, setNumberOfLevels] = useState<NumberOfLevels>(10);

  /* ── Structure tab state ── */
  const [startingStack, setStartingStack] = useState(10000);
  const [blindInterval, setBlindInterval] = useState<BlindInterval>(15);
  const [breaks, setBreaks] = useState<BreakSchedule[]>([
    { id: nextBreakId(), everyXLevels: 4, durationMinutes: 5 },
  ]);

  /* ── Financials tab state ── */
  const [payoutStructure, setPayoutStructure] = useState<PayoutStructure>("top_15");
  const [guaranteedPrize, setGuaranteedPrize] = useState(0);
  const [adminFee, setAdminFee] = useState(5);

  /* ── Rules tab state ── */
  const [autoAway, setAutoAway] = useState(true);
  const [timeBank, setTimeBank] = useState<TimeBankOption>(60);
  const [maxPlayers, setMaxPlayers] = useState(50);

  /* ── Derived values ── */
  const totalBuyIn = buyIn + regFee;
  const estPrizePool = useMemo(() => {
    const netBuyIn = buyIn * (1 - adminFee / 100);
    return Math.max(netBuyIn * maxPlayers, guaranteedPrize);
  }, [buyIn, adminFee, maxPlayers, guaranteedPrize]);

  /* ── Tab navigation helpers ── */
  const currentTabIndex = TABS.findIndex((t) => t.key === activeTab);

  function goToTab(key: TabKey) {
    const newIdx = TABS.findIndex((t) => t.key === key);
    setTabDirection(newIdx > currentTabIndex ? 1 : -1);
    setActiveTab(key);
  }

  function goNext() {
    if (currentTabIndex < TABS.length - 1) {
      goToTab(TABS[currentTabIndex + 1].key);
    }
  }

  function goPrev() {
    if (currentTabIndex > 0) {
      goToTab(TABS[currentTabIndex - 1].key);
    }
  }

  /* ── Break schedule helpers ── */
  function addBreak() {
    setBreaks((prev) => [
      ...prev,
      { id: nextBreakId(), everyXLevels: 4, durationMinutes: 5 },
    ]);
  }

  function removeBreak(id: string) {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBreak(id: string, field: keyof Omit<BreakSchedule, "id">, value: number) {
    setBreaks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  }

  /* ── Submit ── */
  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Validation error", description: "Tournament name is required.", variant: "destructive" });
      goToTab("general");
      return;
    }
    if (!startDate) {
      toast({ title: "Validation error", description: "Start date & time is required.", variant: "destructive" });
      goToTab("general");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        gameType,
        startDate: new Date(startDate).toISOString(),
        buyIn,
        registrationFee: regFee,
        registrationCloseTime: regCloseTime,
        lateRegistration,
        numberOfLevels,
        startingStack,
        blindLevelInterval: blindInterval,
        breakSchedule: breaks.map(({ everyXLevels, durationMinutes }) => ({
          everyXLevels,
          durationMinutes,
        })),
        payoutStructure,
        guaranteedPrize,
        adminFeePercent: adminFee,
        autoAwayOnTimeout: autoAway,
        timeBankSeconds: timeBank,
        maxPlayers,
      };

      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to create tournament" }));
        throw new Error(data.message || "Failed to create tournament");
      }

      toast({ title: "Tournament created", description: `"${name.trim()}" has been published successfully.` });
      navigate("/tournaments");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Reusable gold input class ── */
  const goldInputClass =
    "w-full bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all [color-scheme:dark]";
  const goldSelectClass =
    "w-full bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all";
  const goldLabelClass =
    "text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1.5";

  /* ── Toggle component ── */
  function GoldToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-10 h-5.5 rounded-full transition-all duration-200 relative ${
            value
              ? "shadow-[0_0_10px_rgba(212,175,55,0.3)]"
              : "bg-white/10"
          }`}
          style={
            value
              ? { background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)" }
              : undefined
          }
        >
          <span
            className={`block w-4 h-4 rounded-full bg-white absolute top-[3px] transition-transform duration-200 shadow-sm ${
              value ? "translate-x-[22px]" : "translate-x-[3px]"
            }`}
          />
        </button>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    );
  }

  /* ─── Tab Content ───────────────────────────────────────────────────────── */

  function renderGeneral() {
    return (
      <div className="space-y-6">
        {/* Tournament Name */}
        <div>
          <label className={goldLabelClass}>Tournament Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday Night Championship"
            className={goldInputClass}
            maxLength={80}
          />
        </div>

        {/* Game Type Selector */}
        <div>
          <label className={goldLabelClass}>Game Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {GAME_TYPES.map((gt) => {
              const Icon = gt.icon;
              const isSelected = gameType === gt.key;
              return (
                <motion.button
                  key={gt.key}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setGameType(gt.key)}
                  className={`relative p-4 rounded-xl text-left transition-all overflow-hidden ${
                    isSelected
                      ? "border-amber-500/40"
                      : "border-white/5 hover:border-white/10"
                  }`}
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(154,123,44,0.15) 0%, rgba(212,175,55,0.08) 100%)"
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isSelected ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.05)"}`,
                    boxShadow: isSelected ? "0 0 20px 2px rgba(212,175,55,0.12)" : "none",
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
                  )}
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-amber-400" : "text-gray-500"}`} />
                  <div className={`text-xs font-bold ${isSelected ? "text-amber-300" : "text-gray-300"}`}>
                    {gt.label}
                  </div>
                  <div className="text-[0.5625rem] text-gray-600 mt-0.5">{gt.desc}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Start Date & Time */}
        <div>
          <label className={goldLabelClass}>
            <Calendar className="w-3 h-3 inline mr-1 -mt-0.5" />
            Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={goldInputClass}
          />
        </div>

        {/* Buy-in + Registration Fee */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={goldLabelClass}>
              <Coins className="w-3 h-3 inline mr-1 -mt-0.5" />
              Buy-in Amount
            </label>
            <input
              type="number"
              value={buyIn}
              onChange={(e) => setBuyIn(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              className={goldInputClass}
            />
          </div>
          <div>
            <label className={goldLabelClass}>
              <DollarSign className="w-3 h-3 inline mr-1 -mt-0.5" />
              Registration Fee
            </label>
            <input
              type="number"
              value={regFee}
              onChange={(e) => setRegFee(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              className={goldInputClass}
            />
          </div>
        </div>

        {/* Registration Close Time + Late Registration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={goldLabelClass}>
              <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
              Registration Close Time
            </label>
            <select
              value={regCloseTime}
              onChange={(e) => setRegCloseTime(e.target.value as RegistrationCloseTime)}
              className={goldSelectClass}
            >
              {REG_CLOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-gray-900">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={goldLabelClass}>
              <Layers className="w-3 h-3 inline mr-1 -mt-0.5" />
              Number of Levels
            </label>
            <select
              value={numberOfLevels}
              onChange={(e) => setNumberOfLevels(parseInt(e.target.value) as NumberOfLevels)}
              className={goldSelectClass}
            >
              {([6, 8, 10, 12] as NumberOfLevels[]).map((n) => (
                <option key={n} value={n} className="bg-gray-900">
                  {n} levels
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Late Registration Toggle */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <GoldToggle
            value={lateRegistration}
            onChange={setLateRegistration}
            label="Allow Late Registration"
          />
          <p className="text-[0.5625rem] text-gray-600 mt-2 ml-[52px]">
            Players can register after the tournament has started, during early blind levels.
          </p>
        </div>
      </div>
    );
  }

  function renderStructure() {
    return (
      <div className="space-y-6">
        {/* Starting Stack */}
        <div>
          <label className={goldLabelClass}>
            <Coins className="w-3 h-3 inline mr-1 -mt-0.5" />
            Starting Stack
          </label>
          <input
            type="number"
            value={startingStack}
            onChange={(e) => setStartingStack(Math.max(100, parseInt(e.target.value) || 100))}
            min={100}
            className={goldInputClass}
          />
          <p className="text-[0.5625rem] text-gray-600 mt-1">
            Each player starts with this many chips.
          </p>
        </div>

        {/* Blind Level Increase Interval */}
        <div>
          <label className={goldLabelClass}>
            <Timer className="w-3 h-3 inline mr-1 -mt-0.5" />
            Blind Level Increase Interval
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([10, 15, 20, 30] as BlindInterval[]).map((interval) => (
              <motion.button
                key={interval}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setBlindInterval(interval)}
                className="py-3 rounded-lg text-center transition-all"
                style={{
                  background:
                    blindInterval === interval
                      ? "linear-gradient(135deg, rgba(154,123,44,0.2) 0%, rgba(212,175,55,0.1) 100%)"
                      : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    blindInterval === interval ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.05)"
                  }`,
                  boxShadow: blindInterval === interval ? "0 0 15px rgba(212,175,55,0.1)" : "none",
                }}
              >
                <div
                  className={`text-sm font-bold ${
                    blindInterval === interval ? "text-amber-300" : "text-gray-400"
                  }`}
                >
                  {interval} min
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Break Schedule */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={goldLabelClass + " mb-0"}>
              <Coffee className="w-3 h-3 inline mr-1 -mt-0.5" />
              Break Schedule
            </label>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={addBreak}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-amber-400 transition-all"
              style={{
                background: "rgba(212,175,55,0.08)",
                border: "1px solid rgba(212,175,55,0.2)",
              }}
            >
              <Plus className="w-3 h-3" />
              Add Break
            </motion.button>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {breaks.map((brk) => (
                <motion.div
                  key={brk.id}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  layout
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[0.5rem] font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Every X Levels
                      </label>
                      <select
                        value={brk.everyXLevels}
                        onChange={(e) => updateBreak(brk.id, "everyXLevels", parseInt(e.target.value))}
                        className={goldSelectClass}
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n} className="bg-gray-900">
                            Every {n} levels
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[0.5rem] font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Duration
                      </label>
                      <select
                        value={brk.durationMinutes}
                        onChange={(e) => updateBreak(brk.id, "durationMinutes", parseInt(e.target.value))}
                        className={goldSelectClass}
                      >
                        {[3, 5, 10, 15].map((n) => (
                          <option key={n} value={n} className="bg-gray-900">
                            {n} minutes
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeBreak(brk.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
            {breaks.length === 0 && (
              <div className="text-center py-6">
                <Coffee className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                <p className="text-[0.625rem] text-gray-600">No breaks scheduled. Players will play non-stop.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderFinancials() {
    return (
      <div className="space-y-6">
        {/* Payout Structure */}
        <div>
          <label className={goldLabelClass}>
            <Trophy className="w-3 h-3 inline mr-1 -mt-0.5" />
            Payout Structure
          </label>
          <div className="space-y-2">
            {PAYOUT_OPTIONS.map((opt) => {
              const isSelected = payoutStructure === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setPayoutStructure(opt.value)}
                  className="w-full p-4 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(154,123,44,0.12) 0%, rgba(212,175,55,0.06) 100%)"
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isSelected ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.05)"}`,
                    boxShadow: isSelected ? "0 0 20px rgba(212,175,55,0.08)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-xs font-bold ${isSelected ? "text-amber-300" : "text-gray-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[0.5625rem] text-gray-600 mt-0.5">{opt.desc}</div>
                    </div>
                    {isSelected && (
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Guaranteed Prize */}
        <div>
          <label className={goldLabelClass}>
            <Coins className="w-3 h-3 inline mr-1 -mt-0.5" />
            Guaranteed Prize Pool
          </label>
          <input
            type="number"
            value={guaranteedPrize}
            onChange={(e) => setGuaranteedPrize(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            placeholder="0 (no guarantee)"
            className={goldInputClass}
          />
          <p className="text-[0.5625rem] text-gray-600 mt-1">
            Set to 0 for no guaranteed prize pool. The house covers any shortfall.
          </p>
        </div>

        {/* Admin Fee */}
        <div>
          <label className={goldLabelClass}>
            <DollarSign className="w-3 h-3 inline mr-1 -mt-0.5" />
            Admin Fee %
          </label>
          <div className="relative">
            <input
              type="number"
              value={adminFee}
              onChange={(e) => setAdminFee(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              min={0}
              max={100}
              step={0.5}
              className={goldInputClass + " pr-8"}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
          </div>
          <p className="text-[0.5625rem] text-gray-600 mt-1">
            Percentage of buy-ins retained as a house rake. Standard is 5%.
          </p>
        </div>

        {/* Financial Summary Banner */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(154,123,44,0.1) 0%, rgba(212,175,55,0.05) 100%)",
            border: "1px solid rgba(212,175,55,0.2)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-amber-400">Financial Breakdown</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-amber-300">{totalBuyIn.toLocaleString()}</div>
              <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Total Cost/Player</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-300">{adminFee}%</div>
              <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">House Rake</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-300">{estPrizePool.toLocaleString()}</div>
              <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">Est. Prize Pool</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderRules() {
    return (
      <div className="space-y-6">
        {/* Auto-Away Toggle */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <GoldToggle
            value={autoAway}
            onChange={setAutoAway}
            label="Auto-Away on Timeout"
          />
          <p className="text-[0.5625rem] text-gray-600 mt-2 ml-[52px]">
            Players who timeout are automatically set to away/fold status until they return.
          </p>
        </div>

        {/* Time Bank */}
        <div>
          <label className={goldLabelClass}>
            <Timer className="w-3 h-3 inline mr-1 -mt-0.5" />
            Time Bank
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([30, 60, 90, 120] as TimeBankOption[]).map((seconds) => (
              <motion.button
                key={seconds}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setTimeBank(seconds)}
                className="py-3 rounded-lg text-center transition-all"
                style={{
                  background:
                    timeBank === seconds
                      ? "linear-gradient(135deg, rgba(154,123,44,0.2) 0%, rgba(212,175,55,0.1) 100%)"
                      : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    timeBank === seconds ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.05)"
                  }`,
                  boxShadow: timeBank === seconds ? "0 0 15px rgba(212,175,55,0.1)" : "none",
                }}
              >
                <div
                  className={`text-sm font-bold ${
                    timeBank === seconds ? "text-amber-300" : "text-gray-400"
                  }`}
                >
                  {seconds}s
                </div>
              </motion.button>
            ))}
          </div>
          <p className="text-[0.5625rem] text-gray-600 mt-2">
            Total extra time each player can use across the tournament when facing a tough decision.
          </p>
        </div>

        {/* Max Players */}
        <div>
          <label className={goldLabelClass}>
            <Users className="w-3 h-3 inline mr-1 -mt-0.5" />
            Maximum Players
          </label>
          <input
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Math.max(2, Math.min(1000, parseInt(e.target.value) || 2)))}
            min={2}
            max={1000}
            className={goldInputClass}
          />
          <p className="text-[0.5625rem] text-gray-600 mt-1">
            Maximum number of players that can register for the tournament.
          </p>
        </div>

        {/* Rules Summary */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(154,123,44,0.08) 0%, rgba(212,175,55,0.03) 100%)",
            border: "1px solid rgba(212,175,55,0.15)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-amber-400" />
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-amber-400">
              Rules Summary
            </span>
          </div>
          <div className="space-y-2 text-[0.625rem] text-gray-400">
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3 text-amber-500/50" />
              <span>Auto-away: <strong className="text-white">{autoAway ? "Enabled" : "Disabled"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-3 h-3 text-amber-500/50" />
              <span>Time bank: <strong className="text-white">{timeBank}s</strong> per player</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-amber-500/50" />
              <span>Max field: <strong className="text-white">{maxPlayers}</strong> players</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "general":
        return renderGeneral();
      case "structure":
        return renderStructure();
      case "financials":
        return renderFinancials();
      case "rules":
        return renderRules();
    }
  }

  /* ─── Summary Sidebar ───────────────────────────────────────────────────── */

  function renderSummary() {
    const gameLabel = GAME_TYPES.find((g) => g.key === gameType)?.label ?? gameType;

    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(10,10,6,0.95) 0%, rgba(22,27,34,0.80) 100%)",
          border: "1px solid rgba(212,175,55,0.15)",
          boxShadow: "0 0 30px rgba(212,175,55,0.06)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4"
          style={{
            borderBottom: "2px solid",
            borderImage: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(243,226,173,0.3) 50%, rgba(212,175,55,0.5) 100%) 1",
          }}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3
              className="text-xs font-bold uppercase tracking-[0.15em]"
              style={{
                background: "linear-gradient(135deg, #f3e2ad 0%, #d4af37 50%, #f3e2ad 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Tournament Summary
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Tournament Name */}
          <div>
            <div className="text-[0.5rem] font-bold uppercase tracking-wider text-gray-600 mb-1">Name</div>
            <div className="text-sm font-bold text-white truncate">
              {name.trim() || "Untitled Tournament"}
            </div>
          </div>

          {/* Game Type */}
          <div>
            <div className="text-[0.5rem] font-bold uppercase tracking-wider text-gray-600 mb-1">Game</div>
            <div className="text-sm font-medium text-amber-300">{gameLabel}</div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          {/* Key Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] text-gray-500">Est. Prize Pool</span>
              <span className="text-sm font-bold text-amber-400">{estPrizePool.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] text-gray-500">Total Buy-in</span>
              <span className="text-sm font-bold text-white">{totalBuyIn.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] text-gray-500">Starting Chips</span>
              <span className="text-sm font-mono text-gray-300">{startingStack.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] text-gray-500">Blind Levels</span>
              <span className="text-sm font-mono text-gray-300">{blindInterval} min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.625rem] text-gray-500">Max Players</span>
              <span className="text-sm font-mono text-gray-300">{maxPlayers}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          {/* Status */}
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-amber-500/60" />
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-amber-500/60">Draft</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{
              background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)",
              boxShadow: "0 0 20px 2px rgba(212,175,55,0.4)",
            }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {submitting ? "Publishing..." : "Save & Publish"}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/tournaments")}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Cancel
          </motion.button>
        </div>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────────────────────────────── */

  return (
    <DashboardLayout title="Create Tournament">
      <div className="px-4 md:px-8 pb-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6 overflow-hidden rounded-xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(10,10,6,0.9) 0%, rgba(22,27,34,0.8) 100%)",
            border: "1px solid rgba(212,175,55,0.15)",
            boxShadow: "0 0 30px rgba(212,175,55,0.05)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(154,123,44,0.2) 0%, rgba(212,175,55,0.1) 100%)",
                border: "1px solid rgba(212,175,55,0.25)",
              }}
            >
              <Trophy className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
            </div>
            <div>
              <h2
                className="text-lg font-black tracking-[0.12em] uppercase"
                style={{
                  background: "linear-gradient(135deg, #f3e2ad 0%, #d4af37 40%, #f3e2ad 60%, #d4af37 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Tournament Builder
              </h2>
              <p className="text-[0.625rem] text-gray-500 mt-0.5">
                Configure every detail of your tournament experience
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Layout: Content + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Tab Content */}
          <div className="flex-1 min-w-0">
            {/* Tab Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1 mb-6 p-1 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {TABS.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => goToTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all flex-1 justify-center ${
                      isActive
                        ? "text-amber-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                    style={
                      isActive
                        ? {
                            background: "linear-gradient(135deg, rgba(154,123,44,0.15) 0%, rgba(212,175,55,0.08) 100%)",
                            border: "1px solid rgba(212,175,55,0.25)",
                            boxShadow: "0 0 12px rgba(212,175,55,0.08)",
                          }
                        : { border: "1px solid transparent" }
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {!isMobile && tab.label}
                    {isMobile && (
                      <span className="sr-only">{tab.label}</span>
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Tab Content Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(10,10,6,0.9) 0%, rgba(22,27,34,0.8) 100%)",
                border: "1px solid rgba(212,175,55,0.1)",
                boxShadow: "0 0 30px rgba(0,0,0,0.3)",
              }}
            >
              <div className="p-6">
                <AnimatePresence mode="wait" custom={tabDirection}>
                  <motion.div
                    key={activeTab}
                    custom={tabDirection}
                    variants={tabVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    {renderTabContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom Navigation */}
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goPrev}
                  disabled={currentTabIndex === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </motion.button>

                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {TABS.map((tab, i) => (
                    <div
                      key={tab.key}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentTabIndex
                          ? "bg-amber-400 shadow-[0_0_6px_rgba(212,175,55,0.5)]"
                          : i < currentTabIndex
                          ? "bg-amber-500/30"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                {currentTabIndex < TABS.length - 1 ? (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goNext}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-amber-400 transition-all"
                    style={{
                      background: "rgba(212,175,55,0.08)",
                      border: "1px solid rgba(212,175,55,0.2)",
                    }}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-black disabled:opacity-50 transition-all"
                    style={{
                      background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)",
                      boxShadow: "0 0 15px rgba(212,175,55,0.3)",
                    }}
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Publish
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right: Summary Sidebar */}
          <div className={`${isMobile ? "w-full" : "w-[300px] shrink-0"}`}>
            <div className={isMobile ? "" : "sticky top-4"}>
              <motion.div
                initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                {renderSummary()}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
