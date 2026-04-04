import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Eye, EyeOff, Repeat, RotateCcw, Rabbit, DollarSign,
  Coins, Timer, Clock, Gauge, Shuffle, Percent, CreditCard,
  Shield, Lock, Users, Bot, UserPlus, Save, AlertTriangle,
  Bomb, Swords, MessageSquare, Scissors, Layers, Volume2,
  VolumeX, Hand, BellOff, Hourglass, Sparkles, Settings2,
} from "lucide-react";
import { useGameUI, type RunItTwicePreference, type GesturesVisibility } from "@/lib/game-ui-context";

export interface InGameSettings {
  // Existing
  straddleEnabled: boolean;
  bigBlindAnte: boolean;
  rabbitHunting: boolean;
  showAllHands: boolean;
  autoTopUp: boolean;
  actionTimerSeconds: number;
  speedMultiplier: number;
  autoStartDelay: number;
  rakePercent: number;
  rakeCap: number;
  allowBots: boolean;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  // Changed: boolean → enum
  runItTwice: "always" | "ask" | "no";
  // Promoted from GameSetup only
  timeBankSeconds: number;
  bombPotFrequency: number;
  bombPotAnte: number;
  // New game settings
  pokerVariant: string;
  useCentsValues: boolean;
  showdownSpeed: "fast" | "normal" | "slow";
  dealToAwayPlayers: boolean;
  timeBankRefillHands: number;
  spectatorMode: boolean;
  doubleBoard: boolean;
  sevenTwoBounty: number;
  guestChatEnabled: boolean;
  autoTrimExcessBets: boolean;
  // T18: Advanced admin settings
  maxValuePerHand: number;
  turnTimerDuration: number;
  autoStartNextHand: boolean;
}

interface InGameAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: InGameSettings;
  onApply: (settings: InGameSettings) => void;
  isMultiplayer?: boolean;
  isAdmin?: boolean;
}

type TabId = "game" | "preferences";

export function InGameAdminPanel({ isOpen, onClose, settings, onApply, isMultiplayer, isAdmin = true }: InGameAdminPanelProps) {
  const [local, setLocal] = useState<InGameSettings>({ ...settings });
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(isAdmin ? "game" : "preferences");

  const gameUI = useGameUI();

  useEffect(() => {
    if (isOpen) {
      setLocal({ ...settings });
      setHasChanges(false);
      setConfirmApply(false);
      if (!isAdmin) setActiveTab("preferences");
    }
  }, [isOpen, settings, isAdmin]);

  const update = <K extends keyof InGameSettings>(key: K, value: InGameSettings[K]) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setConfirmApply(false);
  };

  const handleApply = useCallback(() => {
    if (!confirmApply) {
      setConfirmApply(true);
      return;
    }
    onApply(local);
    setHasChanges(false);
    setConfirmApply(false);
  }, [confirmApply, local, onApply]);

  const handleReset = () => {
    setLocal({ ...settings });
    setHasChanges(false);
    setConfirmApply(false);
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors";
  const labelClass = "text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1";

  const Toggle = ({ value, onChange, label, icon: Icon, badge }: { value: boolean; onChange: (v: boolean) => void; label: string; icon: any; badge?: string }) => (
    <label className="flex items-center gap-2.5 cursor-pointer group py-1">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-8 h-[18px] rounded-full transition-colors ${value ? 'bg-amber-500' : 'bg-white/10'} relative shrink-0`}
        data-testid={`admin-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className={`block w-3 h-3 rounded-full bg-white absolute top-[3px] transition-transform ${value ? 'translate-x-[16px]' : 'translate-x-[3px]'}`} />
      </button>
      <span className="text-[0.6875rem] text-gray-300 flex items-center gap-1.5 group-hover:text-white transition-colors">
        <Icon className="w-3 h-3 text-gray-500 shrink-0" /> {label}
        {badge && <span className="text-[0.5rem] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">{badge}</span>}
      </span>
    </label>
  );

  const SectionHeader = ({ label, icon: Icon, color = "cyan" }: { label: string; icon: any; color?: string }) => {
    const colorMap: Record<string, { icon: string; text: string }> = {
      cyan: { icon: "text-amber-400/60", text: "text-amber-400/80" },
      amber: { icon: "text-amber-400/60", text: "text-amber-400/80" },
      purple: { icon: "text-purple-400/60", text: "text-purple-400/80" },
    };
    const colors = colorMap[color] || colorMap.cyan;
    return (
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
        <span className={`text-[0.625rem] font-bold uppercase tracking-widest ${colors.text}`}>{label}</span>
        <div className="flex-1 h-px bg-white/[0.04]" />
      </div>
    );
  };

  const renderGameTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[0.625rem] text-amber-300/80">Changes apply at the start of the next hand.</span>
      </div>

      {/* Game Type */}
      <div>
        <SectionHeader icon={Sparkles} label="Game Type" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Poker Variant</label>
            <select value={local.pokerVariant} disabled className={`${inputClass} opacity-60`}>
              <option value="nlhe" className="bg-gray-900">NL Hold'em</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <Toggle value={local.useCentsValues} onChange={(v) => update("useCentsValues", v)} icon={DollarSign} label="Cents" />
          </div>
        </div>
      </div>

      {/* Blinds & Ante */}
      <div>
        <SectionHeader icon={Coins} label="Blinds & Ante" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Small Blind</label>
            <input
              type="number"
              value={local.smallBlind}
              onChange={(e) => update("smallBlind", parseInt(e.target.value) || 1)}
              min={1}
              className={inputClass}
              data-testid="admin-input-sb"
            />
          </div>
          <div>
            <label className={labelClass}>Big Blind</label>
            <input
              type="number"
              value={local.bigBlind}
              onChange={(e) => update("bigBlind", parseInt(e.target.value) || 2)}
              min={2}
              className={inputClass}
              data-testid="admin-input-bb"
            />
          </div>
          <div>
            <label className={labelClass}>Ante</label>
            <input
              type="number"
              value={local.ante}
              onChange={(e) => update("ante", parseInt(e.target.value) || 0)}
              min={0}
              className={inputClass}
              data-testid="admin-input-ante"
            />
          </div>
        </div>
      </div>

      {/* Table Rules */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <DollarSign className="w-3.5 h-3.5 text-amber-400/60" />
          <span className="text-[0.625rem] font-bold uppercase tracking-widest text-amber-400/80">Table Rules</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
        <div className="space-y-0">
          <Toggle value={local.straddleEnabled} onChange={(v) => update("straddleEnabled", v)} icon={DollarSign} label="Straddle" />
          <Toggle value={local.bigBlindAnte} onChange={(v) => update("bigBlindAnte", v)} icon={Coins} label="Big Blind Ante" />
          {/* Run It Twice — 3-option select */}
          <div className="flex items-center gap-2.5 py-1">
            <Repeat className="w-3 h-3 text-gray-500 shrink-0 ml-[42px]" />
            <span className="text-[0.6875rem] text-gray-300 whitespace-nowrap">Run It Twice</span>
            <select
              value={local.runItTwice}
              onChange={(e) => update("runItTwice", e.target.value as "always" | "ask" | "no")}
              className="ml-auto bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[0.625rem] text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="no" className="bg-gray-900">No</option>
              <option value="ask" className="bg-gray-900">Ask Players</option>
              <option value="always" className="bg-gray-900">Always</option>
            </select>
          </div>
          <Toggle value={local.rabbitHunting} onChange={(v) => update("rabbitHunting", v)} icon={Rabbit} label="Rabbit Hunting" />
          <Toggle value={local.showAllHands} onChange={(v) => update("showAllHands", v)} icon={Eye} label="Show All Hands" />
          <Toggle value={local.autoTopUp} onChange={(v) => update("autoTopUp", v)} icon={RotateCcw} label="Auto Top-Up" />
          <Toggle value={local.dealToAwayPlayers} onChange={(v) => update("dealToAwayPlayers", v)} icon={Users} label="Deal to Away Players" />
          <Toggle value={local.autoTrimExcessBets} onChange={(v) => update("autoTrimExcessBets", v)} icon={Scissors} label="Auto Trim Excess Bets" />
          <Toggle value={local.spectatorMode} onChange={(v) => update("spectatorMode", v)} icon={Eye} label="Spectator Mode" />
          <Toggle value={local.guestChatEnabled} onChange={(v) => update("guestChatEnabled", v)} icon={MessageSquare} label="Guest Chat" />
        </div>
      </div>

      {/* Bomb Pots & Special Rules */}
      <div>
        <SectionHeader icon={Bomb} label="Bomb Pots & Special" color="amber" />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className={labelClass}>Frequency</label>
            <select value={local.bombPotFrequency} onChange={(e) => update("bombPotFrequency", parseInt(e.target.value))} className={inputClass}>
              <option value={0} className="bg-gray-900">Disabled</option>
              <option value={3} className="bg-gray-900">Every 3 hands</option>
              <option value={5} className="bg-gray-900">Every 5 hands</option>
              <option value={10} className="bg-gray-900">Every 10 hands</option>
              <option value={15} className="bg-gray-900">Every 15 hands</option>
              <option value={20} className="bg-gray-900">Every 20 hands</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Bomb Ante</label>
            <input
              type="number"
              value={local.bombPotAnte}
              onChange={(e) => update("bombPotAnte", parseInt(e.target.value) || 0)}
              min={0}
              placeholder="= BB"
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>7-2 Bounty</label>
            <select value={local.sevenTwoBounty} onChange={(e) => update("sevenTwoBounty", parseInt(e.target.value))} className={inputClass}>
              <option value={0} className="bg-gray-900">Disabled</option>
              <option value={5} className="bg-gray-900">5 chips/player</option>
              <option value={10} className="bg-gray-900">10 chips/player</option>
              <option value={20} className="bg-gray-900">20 chips/player</option>
              <option value={50} className="bg-gray-900">50 chips/player</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <Toggle value={local.doubleBoard} onChange={(v) => update("doubleBoard", v)} icon={Layers} label="Double Board" badge="SOON" />
          </div>
        </div>
      </div>

      {/* Speed & Timing */}
      <div>
        <SectionHeader icon={Timer} label="Speed & Timing" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Action Timer</label>
            <select value={local.actionTimerSeconds} onChange={(e) => update("actionTimerSeconds", parseInt(e.target.value))} className={inputClass} data-testid="admin-select-timer">
              {[5, 8, 10, 12, 15, 20, 25, 30, 45, 60].map(n => (
                <option key={n} value={n} className="bg-gray-900">{n}s</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Turn Timer Duration</label>
            <select value={local.turnTimerDuration} onChange={(e) => update("turnTimerDuration", parseInt(e.target.value))} className={inputClass} data-testid="admin-select-turn-timer">
              {[15, 30, 45, 60, 90].map(n => (
                <option key={n} value={n} className="bg-gray-900">{n}s</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Game Speed</label>
            <select value={local.speedMultiplier} onChange={(e) => update("speedMultiplier", parseFloat(e.target.value))} className={inputClass} data-testid="admin-select-speed">
              <option value={0.5} className="bg-gray-900">Turbo (2x)</option>
              <option value={0.75} className="bg-gray-900">Fast (1.5x)</option>
              <option value={1.0} className="bg-gray-900">Normal</option>
              <option value={1.5} className="bg-gray-900">Relaxed</option>
              <option value={2.0} className="bg-gray-900">Slow</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Auto-Start Delay</label>
            <select value={local.autoStartDelay} onChange={(e) => update("autoStartDelay", parseInt(e.target.value))} className={inputClass} data-testid="admin-select-autostart">
              {[0, 3, 5, 8, 10, 15].map(n => (
                <option key={n} value={n} className="bg-gray-900">{n === 0 ? "Instant" : `${n}s`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Time Bank</label>
            <select value={local.timeBankSeconds} onChange={(e) => update("timeBankSeconds", parseInt(e.target.value))} className={inputClass}>
              {[10, 15, 20, 30, 45, 60, 90, 120].map(n => (
                <option key={n} value={n} className="bg-gray-900">{n}s</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Time Bank Refill</label>
            <select value={local.timeBankRefillHands} onChange={(e) => update("timeBankRefillHands", parseInt(e.target.value))} className={inputClass}>
              <option value={0} className="bg-gray-900">No refill</option>
              <option value={5} className="bg-gray-900">Every 5 hands</option>
              <option value={10} className="bg-gray-900">Every 10 hands</option>
              <option value={20} className="bg-gray-900">Every 20 hands</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Showdown Speed</label>
            <select value={local.showdownSpeed} onChange={(e) => update("showdownSpeed", e.target.value as "fast" | "normal" | "slow")} className={inputClass}>
              <option value="fast" className="bg-gray-900">Fast</option>
              <option value="normal" className="bg-gray-900">Normal</option>
              <option value="slow" className="bg-gray-900">Slow</option>
            </select>
          </div>
          <div className="col-span-2">
            <Toggle value={local.autoStartNextHand} onChange={(v) => update("autoStartNextHand", v)} icon={Clock} label="Auto-Start Next Hand" />
          </div>
        </div>
      </div>

      {/* Rake & Limits */}
      <div>
        <SectionHeader icon={Percent} label="Rake & Limits" color="amber" />
        <div className="space-y-3">
          {/* Rake percentage slider */}
          <div>
            <label className={labelClass}>Rake Percentage — {local.rakePercent}%</label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={local.rakePercent}
              onChange={(e) => update("rakePercent", parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500"
              data-testid="admin-slider-rake"
            />
            <div className="flex justify-between mt-0.5 px-0.5">
              <span className="text-[0.5rem] text-gray-500">0%</span>
              <span className="text-[0.5rem] text-gray-500">10%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Rake Cap</label>
              <input
                type="number"
                value={local.rakeCap}
                onChange={(e) => update("rakeCap", parseInt(e.target.value) || 0)}
                min={0}
                placeholder="No cap"
                className={inputClass}
                data-testid="admin-input-rakecap"
              />
            </div>
            <div>
              <label className={labelClass}>Max Value / Hand</label>
              <input
                type="number"
                value={local.maxValuePerHand}
                onChange={(e) => update("maxValuePerHand", parseInt(e.target.value) || 0)}
                min={0}
                placeholder="No limit"
                className={inputClass}
                data-testid="admin-input-maxvalue"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bots */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Bot className="w-3.5 h-3.5 text-amber-400/60" />
          <span className="text-[0.625rem] font-bold uppercase tracking-widest text-amber-400/80">Bots</span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>
        <Toggle value={local.allowBots} onChange={(v) => update("allowBots", v)} icon={Bot} label="Allow Bots" />
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Settings2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[0.625rem] text-amber-300/80">Personal preferences — saved locally.</span>
      </div>

      {/* Sound & Notifications */}
      <div>
        <SectionHeader icon={Volume2} label="Sound & Notifications" />
        <div className="space-y-0">
          <Toggle
            value={gameUI.disableChatBeep}
            onChange={(v) => gameUI.setDisableChatBeep(v)}
            icon={BellOff}
            label="Disable Chat Beep"
          />
          <Toggle
            value={gameUI.hideHandReviewNotification}
            onChange={(v) => gameUI.setHideHandReviewNotification(v)}
            icon={EyeOff}
            label="Hide Hand Review"
          />
        </div>
      </div>

      {/* Gameplay */}
      <div>
        <SectionHeader icon={Shuffle} label="Gameplay" />
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Run It Twice Preference</label>
            <select
              value={gameUI.runItTwicePreference}
              onChange={(e) => gameUI.setRunItTwicePreference(e.target.value as RunItTwicePreference)}
              className={inputClass}
            >
              <option value="always" className="bg-gray-900">Always Run Twice</option>
              <option value="ask" className="bg-gray-900">Ask Me</option>
              <option value="once" className="bg-gray-900">Run Once</option>
            </select>
          </div>
          <Toggle
            value={gameUI.autoActivateExtraTime}
            onChange={(v) => gameUI.setAutoActivateExtraTime(v)}
            icon={Hourglass}
            label="Auto Activate Extra Time"
          />
        </div>
      </div>

      {/* Emotes & Gestures */}
      <div>
        <SectionHeader icon={Hand} label="Emotes & Gestures" />
        <div>
          <label className={labelClass}>Gestures Visibility</label>
          <select
            value={gameUI.gesturesVisibility}
            onChange={(e) => gameUI.setGesturesVisibility(e.target.value as GesturesVisibility)}
            className={inputClass}
          >
            <option value="show" className="bg-gray-900">Show</option>
            <option value="sound-muted" className="bg-gray-900">Sound Muted</option>
            <option value="hidden" className="bg-gray-900">Hidden</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-[61] w-80 flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(12,20,35,0.98) 0%, rgba(8,14,24,0.99) 100%)",
              borderLeft: "1px solid rgba(212,175,55,0.1)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white tracking-wide">Settings</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                data-testid="button-close-admin-panel"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 px-4 pt-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("game")}
                  className={`flex-1 pb-2 text-[0.625rem] font-bold uppercase tracking-wider transition-colors relative ${
                    activeTab === "game" ? "text-amber-400" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Game
                  {activeTab === "game" && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400 rounded-full" />
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab("preferences")}
                className={`flex-1 pb-2 text-[0.625rem] font-bold uppercase tracking-wider transition-colors relative ${
                  activeTab === "preferences" ? "text-amber-400" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Preferences
                {activeTab === "preferences" && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400 rounded-full" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
              {activeTab === "game" && isAdmin ? renderGameTab() : renderPreferencesTab()}
            </div>

            {/* Footer with apply/reset — only for Game tab */}
            {activeTab === "game" && isAdmin && (
              <div
                className="shrink-0 px-4 py-3 flex items-center gap-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <button
                  onClick={handleReset}
                  disabled={!hasChanges}
                  className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 transition-all disabled:opacity-30"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  data-testid="button-admin-reset"
                >
                  Reset
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasChanges}
                  className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all disabled:opacity-30"
                  style={{
                    background: confirmApply
                      ? "linear-gradient(180deg, #16a34a 0%, #15803d 100%)"
                      : "linear-gradient(180deg, #d97706 0%, #b45309 100%)",
                    border: confirmApply
                      ? "1px solid rgba(34,197,94,0.4)"
                      : "1px solid rgba(245,158,11,0.3)",
                    boxShadow: confirmApply
                      ? "0 0 12px rgba(34,197,94,0.2)"
                      : "0 0 12px rgba(245,158,11,0.15)",
                  }}
                  data-testid="button-admin-apply"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Save className="w-3.5 h-3.5" />
                    {confirmApply ? "Confirm Apply" : "Apply Changes"}
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
