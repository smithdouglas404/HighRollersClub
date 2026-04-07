import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Shield, Clock, AlertTriangle, Ban, Coffee,
  Loader2, CheckCircle, DollarSign, TrendingDown
} from "lucide-react";

interface RGSettings {
  selfExcludedUntil: string | null;
  depositLimitDaily: number;
  depositLimitWeekly: number;
  depositLimitMonthly: number;
  sessionTimeLimitMinutes: number;
  lossLimitDaily: number;
  coolOffUntil: string | null;
}

function StatusBanner({ settings }: { settings: RGSettings }) {
  const now = new Date();
  const selfExcluded = settings.selfExcludedUntil && new Date(settings.selfExcludedUntil) > now;
  const coolingOff = settings.coolOffUntil && new Date(settings.coolOffUntil) > now;

  if (!selfExcluded && !coolingOff) return null;

  return (
    <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-red-400 font-semibold mb-1">
        <Ban className="w-5 h-5" />
        Active Restriction
      </div>
      {selfExcluded && (
        <p className="text-red-300 text-sm">
          You are currently self-excluded until{" "}
          <strong>{new Date(settings.selfExcludedUntil!).toLocaleDateString()} {new Date(settings.selfExcludedUntil!).toLocaleTimeString()}</strong>.
          You cannot join tables or make deposits during this period.
        </p>
      )}
      {coolingOff && !selfExcluded && (
        <p className="text-red-300 text-sm">
          Cool-off period active until{" "}
          <strong>{new Date(settings.coolOffUntil!).toLocaleDateString()} {new Date(settings.coolOffUntil!).toLocaleTimeString()}</strong>.
          You cannot join tables during this period.
        </p>
      )}
    </div>
  );
}

function DepositLimitsSection({ settings, onSave }: { settings: RGSettings; onSave: (data: Partial<RGSettings>) => Promise<void> }) {
  const [daily, setDaily] = useState(String(settings.depositLimitDaily || ""));
  const [weekly, setWeekly] = useState(String(settings.depositLimitWeekly || ""));
  const [monthly, setMonthly] = useState(String(settings.depositLimitMonthly || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave({
      depositLimitDaily: Number(daily) || 0,
      depositLimitWeekly: Number(weekly) || 0,
      depositLimitMonthly: Number(monthly) || 0,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <GoldCard padding="p-5">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">Deposit Limits</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set maximum deposit amounts per time period. Set to 0 for no limit.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Daily Limit</label>
          <input
            type="number"
            min="0"
            value={daily}
            onChange={e => setDaily(e.target.value)}
            placeholder="0 (no limit)"
            className="w-full px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Weekly Limit</label>
          <input
            type="number"
            min="0"
            value={weekly}
            onChange={e => setWeekly(e.target.value)}
            placeholder="0 (no limit)"
            className="w-full px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Monthly Limit</label>
          <input
            type="number"
            min="0"
            value={monthly}
            onChange={e => setMonthly(e.target.value)}
            placeholder="0 (no limit)"
            className="w-full px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 relative overflow-hidden font-black uppercase tracking-wider text-black px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
        style={{ background: "linear-gradient(135deg, #8a6914 0%, #c9a227 20%, #f3e2ad 50%, #d4af37 80%, #8a6914 100%)" }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
        {saving ? "Saving..." : saved ? "Saved" : "Save Limits"}
      </button>
    </div>
  );
}

function SessionTimeLimitSection({ settings, onSave }: { settings: RGSettings; onSave: (data: Partial<RGSettings>) => Promise<void> }) {
  const [value, setValue] = useState(String(settings.sessionTimeLimitMinutes));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const options = [
    { label: "No limit", value: "0" },
    { label: "30 minutes", value: "30" },
    { label: "1 hour", value: "60" },
    { label: "2 hours", value: "120" },
    { label: "4 hours", value: "240" },
  ];

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave({ sessionTimeLimitMinutes: Number(value) || 0 });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <GoldCard padding="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">Session Time Limit</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Get a reminder when your session exceeds this duration. You will be disconnected at 2x the limit.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={value}
          onChange={e => setValue(e.target.value)}
          className="px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 relative overflow-hidden font-black uppercase tracking-wider text-black px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
        style={{ background: "linear-gradient(135deg, #8a6914 0%, #c9a227 20%, #f3e2ad 50%, #d4af37 80%, #8a6914 100%)" }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
        {saving ? "Saving..." : saved ? "Saved" : "Save Limit"}
      </button>
    </div>
  );
}

function LossLimitSection({ settings, onSave }: { settings: RGSettings; onSave: (data: Partial<RGSettings>) => Promise<void> }) {
  const [value, setValue] = useState(String(settings.lossLimitDaily || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave({ lossLimitDaily: Number(value) || 0 });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <GoldCard padding="p-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">Loss Limit</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set a daily loss limit. Set to 0 for no limit.
      </p>
      <div className="mb-4">
        <label className="block text-xs text-muted-foreground mb-1">Daily Loss Limit</label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="0 (no limit)"
          className="w-full max-w-xs px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 relative overflow-hidden font-black uppercase tracking-wider text-black px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
        style={{ background: "linear-gradient(135deg, #8a6914 0%, #c9a227 20%, #f3e2ad 50%, #d4af37 80%, #8a6914 100%)" }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
        {saving ? "Saving..." : saved ? "Saved" : "Save Limit"}
      </button>
    </div>
  );
}

function SelfExclusionSection({ settings, onExclude }: { settings: RGSettings; onExclude: (days: number) => Promise<void> }) {
  const [duration, setDuration] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const options = [
    { label: "24 hours", value: "1" },
    { label: "7 days", value: "7" },
    { label: "30 days", value: "30" },
    { label: "90 days", value: "90" },
    { label: "Permanent", value: "0" },
  ];

  const now = new Date();
  const isExcluded = settings.selfExcludedUntil && new Date(settings.selfExcludedUntil) > now;

  const handleExclude = async () => {
    if (!confirmed) return;
    setSaving(true);
    await onExclude(Number(duration));
    setSaving(false);
    setConfirmed(false);
  };

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Ban className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">Self-Exclusion</h3>
      </div>

      {isExcluded ? (
        <div className="text-sm text-red-300">
          <p>You are currently self-excluded until <strong>{new Date(settings.selfExcludedUntil!).toLocaleDateString()}</strong>.</p>
          <p className="mt-1 text-amber-400 font-semibold">
            {(() => {
              const remaining = new Date(settings.selfExcludedUntil!).getTime() - now.getTime();
              const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
              const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""} remaining`;
            })()}
          </p>
          <p className="mt-1 text-muted-foreground">This cannot be reversed early for exclusion periods longer than 24 hours.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-300">
                <strong>WARNING:</strong> Self-exclusion blocks all access to games, tables, and deposits for the selected duration.
                Exclusion periods longer than 24 hours <strong>cannot be reversed early</strong>. Permanent exclusion lasts 10 years.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <select
              value={duration}
              onChange={e => { setDuration(e.target.value); setConfirmed(false); }}
              className="px-3 py-2 rounded-md bg-surface-lowest border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-1 accent-red-500"
            />
            <span className="text-sm text-muted-foreground">
              I understand that self-exclusion cannot be reversed early and I want to proceed.
            </span>
          </label>

          <button
            onClick={handleExclude}
            disabled={!confirmed || saving}
            className="px-4 py-2 rounded-md bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            {saving ? "Processing..." : "Activate Self-Exclusion"}
          </button>
        </>
      )}
    </div>
  );
}

function CoolOffSection({ settings, onCoolOff }: { settings: RGSettings; onCoolOff: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const isCoolingOff = settings.coolOffUntil && new Date(settings.coolOffUntil) > now;

  const handleCoolOff = async () => {
    setSaving(true);
    await onCoolOff();
    setSaving(false);
  };

  return (
    <GoldCard padding="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Coffee className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">Cool-Off Period</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Take a 24-hour break from playing. You will not be able to join any tables during this time.
      </p>
      {isCoolingOff ? (
        <p className="text-sm text-yellow-300">
          Cool-off active until <strong>{new Date(settings.coolOffUntil!).toLocaleDateString()} {new Date(settings.coolOffUntil!).toLocaleTimeString()}</strong>
        </p>
      ) : (
        <button
          onClick={handleCoolOff}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-yellow-600 text-white font-medium text-sm hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
          {saving ? "Activating..." : "Take a 24h Break"}
        </button>
      )}
    </div>
  );
}

export default function ResponsibleGambling() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RGSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/responsible-gambling/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSettings = async (data: Partial<RGSettings>) => {
    try {
      const res = await fetch("/api/responsible-gambling/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to update" }));
        throw new Error(err.message);
      }
      const updated = await res.json();
      setSettings(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selfExclude = async (days: number) => {
    try {
      const res = await fetch("/api/responsible-gambling/self-exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message);
      }
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const coolOff = async () => {
    try {
      const res = await fetch("/api/responsible-gambling/cool-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message);
      }
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!settings) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">
          {error || "Unable to load responsible gambling settings."}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-white">Responsible Gambling</h1>
            <p className="text-sm text-muted-foreground">Manage your limits and take control of your gaming habits.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <StatusBanner settings={settings} />

        <div className="space-y-5">
          <DepositLimitsSection settings={settings} onSave={updateSettings} />
          <SessionTimeLimitSection settings={settings} onSave={updateSettings} />
          <LossLimitSection settings={settings} onSave={updateSettings} />
          <CoolOffSection settings={settings} onCoolOff={coolOff} />
          <SelfExclusionSection settings={settings} onExclude={selfExclude} />
        </div>
      </div>
    </DashboardLayout>
  );
}
