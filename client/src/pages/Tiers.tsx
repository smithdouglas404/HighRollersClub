import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Crown, Shield, Star, Zap, Gem, Check, Loader2 } from "lucide-react";

interface TierDefinition {
  id: string;
  name: string;
  price: number;
  benefits: string[];
}

const TIER_ICONS: Record<string, typeof Crown> = {
  free: Shield,
  bronze: Shield,
  silver: Star,
  gold: Crown,
  platinum: Gem,
};

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  free: { bg: "from-gray-600/20 to-gray-700/20", border: "border-gray-500/30", text: "text-gray-300", glow: "" },
  bronze: { bg: "from-orange-600/20 to-amber-700/20", border: "border-orange-500/30", text: "text-orange-400", glow: "shadow-[0_0_20px_rgba(234,88,12,0.15)]" },
  silver: { bg: "from-gray-300/20 to-gray-500/20", border: "border-gray-300/30", text: "text-gray-200", glow: "shadow-[0_0_20px_rgba(156,163,175,0.15)]" },
  gold: { bg: "from-amber-500/20 to-yellow-600/20", border: "border-amber-400/40", text: "text-amber-400", glow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]" },
  platinum: { bg: "from-purple-500/20 to-indigo-600/20", border: "border-purple-400/40", text: "text-purple-300", glow: "shadow-[0_0_20px_rgba(168,85,247,0.2)]" },
};

const TIER_FULL_BENEFITS: Record<string, string[]> = {
  free: ["Play cash games", "Basic statistics"],
  bronze: ["Coaching access", "Daily challenges", "Everything in Free"],
  silver: ["Multi-table play", "Replay sharing", "Everything in Bronze"],
  gold: ["Create clubs", "Host tournaments with rake", "KYC eligible", "Everything in Silver"],
  platinum: ["Marketplace selling", "Priority support", "Advanced API access", "Everything in Gold"],
};

export default function Tiers() {
  const { user, refreshUser } = useAuth();
  const [tiers, setTiers] = useState<TierDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tiers")
      .then(r => r.json())
      .then(data => setTiers(data))
      .catch(() => setError("Failed to load tier data"))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tierId: string) => {
    setUpgrading(tierId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/tiers/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Upgrade failed");
      } else {
        setSuccess(`Successfully upgraded to ${tierId}!`);
        await refreshUser();
      }
    } catch {
      setError("Network error");
    } finally {
      setUpgrading(null);
    }
  };

  const currentTier = user?.tier || "free";
  const tierOrder = ["free", "bronze", "silver", "gold", "platinum"];
  const currentRank = tierOrder.indexOf(currentTier);

  if (loading) {
    return (
      <DashboardLayout title="Membership Tiers">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Membership Tiers">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-white mb-2">Membership Tiers</h1>
          <p className="text-gray-400 text-sm">Upgrade your membership to unlock exclusive benefits</p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            {(() => { const Icon = TIER_ICONS[currentTier] || Shield; return <Icon className="w-4 h-4 text-primary" />; })()}
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Current: {currentTier}</span>
          </div>
        </div>

        {error && (
          <div className="mx-auto max-w-md p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-auto max-w-md p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tierOrder.map((tierId, idx) => {
            const tier = tiers.find(t => t.id === tierId);
            const colors = TIER_COLORS[tierId] || TIER_COLORS.free;
            const Icon = TIER_ICONS[tierId] || Shield;
            const benefits = TIER_FULL_BENEFITS[tierId] || tier?.benefits || [];
            const isCurrent = tierId === currentTier;
            const isLower = idx < currentRank;
            const price = tier?.price || 0;

            return (
              <div
                key={tierId}
                className={`relative rounded-xl border p-5 flex flex-col bg-gradient-to-b ${colors.bg} ${colors.border} ${colors.glow} ${isCurrent ? "ring-2 ring-primary/50" : ""}`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-black text-[0.625rem] font-bold uppercase tracking-wider">
                    Current
                  </div>
                )}
                <div className="text-center mb-4">
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${colors.text}`} />
                  <h3 className={`text-lg font-display font-bold uppercase tracking-wider ${colors.text}`}>
                    {tierId}
                  </h3>
                  <p className="text-2xl font-black text-white mt-1">
                    {price === 0 ? "Free" : `${price.toLocaleString()}`}
                  </p>
                  {price > 0 && <p className="text-[0.625rem] text-gray-500 uppercase">chips / month</p>}
                </div>

                <div className="flex-1 space-y-2 mb-4">
                  {benefits.map((benefit, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${colors.text}`} />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(tierId)}
                  disabled={isCurrent || isLower || tierId === "free" || upgrading === tierId}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    isCurrent
                      ? "bg-primary/20 text-primary cursor-default"
                      : isLower || tierId === "free"
                        ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                        : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 hover:border-primary/50"
                  }`}
                >
                  {upgrading === tierId ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : isLower || tierId === "free" ? (
                    "---"
                  ) : (
                    "Upgrade"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
