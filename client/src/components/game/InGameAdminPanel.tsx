import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Eye, EyeOff, Repeat, RotateCcw, Rabbit, DollarSign,
  Coins, Timer, Clock, Gauge, Shuffle, Percent, CreditCard,
  Shield, Lock, Users, Bot, UserPlus, Save, AlertTriangle,
} from "lucide-react";

export interface InGameSettings {
  straddleEnabled: boolean;
  bigBlindAnte: boolean;
  runItTwice: boolean;
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
}

interface InGameAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: InGameSettings;
  onApply: (settings: InGameSettings) => void;
  isMultiplayer?: boolean;
}

export function InGameAdminPanel({ isOpen, onClose, settings, onApply, isMultiplayer }: InGameAdminPanelProps) {
  const [local, setLocal] = useState<InGameSettings>({ ...settings });
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocal({ ...settings });
      setHasChanges(false);
      setConfirmApply(false);
    }
  }, [isOpen, settings]);

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

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors";
  const labelClass = "text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 block mb-1";

  const Toggle = ({ value, onChange, label, icon: Icon }: { value: boolean; onChange: (v: boolean) => void; label: string; icon: any }) => (
    <label className="flex items-center gap-2.5 cursor-pointer group py-1">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-8 h-[18px] rounded-full transition-colors ${value ? 'bg-cyan-500' : 'bg-white/10'} relative shrink-0`}
        data-testid={`admin-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className={`block w-3 h-3 rounded-full bg-white absolute top-[3px] transition-transform ${value ? 'translate-x-[16px]' : 'translate-x-[3px]'}`} />
      </button>
      <span className="text-[0.6875rem] text-gray-300 flex items-center gap-1.5 group-hover:text-white transition-colors">
        <Icon className="w-3 h-3 text-gray-500 shrink-0" /> {label}
      </span>
    </label>
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
              borderLeft: "1px solid rgba(0,212,255,0.1)",
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
                <span className="text-sm font-bold text-white tracking-wide">Admin Settings</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                data-testid="button-close-admin-panel"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[0.625rem] text-amber-300/80">Changes apply at the start of the next hand.</span>
              </div>

              {/* Blinds & Ante */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Coins className="w-3.5 h-3.5 text-cyan-400/60" />
                  <span className="text-[0.625rem] font-bold uppercase tracking-widest text-cyan-400/80">Blinds & Ante</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
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
                  <DollarSign className="w-3.5 h-3.5 text-cyan-400/60" />
                  <span className="text-[0.625rem] font-bold uppercase tracking-widest text-cyan-400/80">Table Rules</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <div className="space-y-0">
                  <Toggle value={local.straddleEnabled} onChange={(v) => update("straddleEnabled", v)} icon={DollarSign} label="Straddle" />
                  <Toggle value={local.bigBlindAnte} onChange={(v) => update("bigBlindAnte", v)} icon={Coins} label="Big Blind Ante" />
                  <Toggle value={local.runItTwice} onChange={(v) => update("runItTwice", v)} icon={Repeat} label="Run It Twice" />
                  <Toggle value={local.rabbitHunting} onChange={(v) => update("rabbitHunting", v)} icon={Rabbit} label="Rabbit Hunting" />
                  <Toggle value={local.showAllHands} onChange={(v) => update("showAllHands", v)} icon={Eye} label="Show All Hands" />
                  <Toggle value={local.autoTopUp} onChange={(v) => update("autoTopUp", v)} icon={RotateCcw} label="Auto Top-Up" />
                </div>
              </div>

              {/* Speed & Timing */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Timer className="w-3.5 h-3.5 text-cyan-400/60" />
                  <span className="text-[0.625rem] font-bold uppercase tracking-widest text-cyan-400/80">Speed & Timing</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
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
                </div>
              </div>

              {/* Rake (multiplayer) */}
              {isMultiplayer && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Percent className="w-3.5 h-3.5 text-amber-400/60" />
                    <span className="text-[0.625rem] font-bold uppercase tracking-widest text-amber-400/80">Rake</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Rake %</label>
                      <select value={local.rakePercent} onChange={(e) => update("rakePercent", parseFloat(e.target.value))} className={inputClass} data-testid="admin-select-rake">
                        {[0, 1, 2, 2.5, 3, 4, 5, 7, 10].map(n => (
                          <option key={n} value={n} className="bg-gray-900">{n === 0 ? "No Rake" : `${n}%`}</option>
                        ))}
                      </select>
                    </div>
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
                  </div>
                </div>
              )}

              {/* Bots */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="w-3.5 h-3.5 text-cyan-400/60" />
                  <span className="text-[0.625rem] font-bold uppercase tracking-widest text-cyan-400/80">Bots</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
                <Toggle value={local.allowBots} onChange={(v) => update("allowBots", v)} icon={Bot} label="Allow Bots" />
              </div>
            </div>

            {/* Footer with apply/reset */}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
