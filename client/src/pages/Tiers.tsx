import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { Crown, Shield, Star, Zap, Gem, Check, Loader2, Lock, DollarSign, ArrowUp, ArrowDown } from "lucide-react";

interface TierDefinition {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
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

const KYC_LEVELS: Record<string, { label: string; color: string }> = {
  free: { label: "None", color: "text-gray-500" },
  bronze: { label: "Email", color: "text-orange-400" },
  silver: { label: "Basic", color: "text-gray-200" },
  gold: { label: "Full KYC", color: "text-amber-400" },
  platinum: { label: "Enhanced", color: "text-purple-300" },
};

const TIER_PRICES: Record<string, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  bronze: { monthly: 499, annual: 4799 },
  silver: { monthly: 1499, annual: 14399 },
  gold: { monthly: 2999, annual: 28799 },
  platinum: { monthly: 7999, annual: 76799 },
};

const TIER_LIMITS: Record<string, { depositDay: string; withdrawWeek: string; stakes: string }> = {
  free: { depositDay: "N/A", withdrawWeek: "N/A", stakes: "Play chips only" },
  bronze: { depositDay: "$200/day", withdrawWeek: "$500/week", stakes: "Micro (5/10)" },
  silver: { depositDay: "$1,000/day", withdrawWeek: "$2,500/week", stakes: "Mid (25/50)" },
  gold: { depositDay: "$5,000/day", withdrawWeek: "$10,000/week", stakes: "High (200/400)" },
  platinum: { depositDay: "$25,000/day", withdrawWeek: "$50,000/week", stakes: "Unlimited" },
};

const TIER_BENEFITS: Record<string, string[]> = {
  free: [
    "Play chips only",
    "5 starter avatars",
    "Join clubs",
    "Basic stats",
    "500 chip daily bonus",
  ],
  bronze: [
    "Real money micro stakes (5/10)",
    "$200/day deposit, $500/week withdraw",
    "1 club (25 members)",
    "Coaching & hand replay",
    "1,000 chip daily bonus",
  ],
  silver: [
    "Mid stakes (25/50)",
    "$1,000/day deposit, $2,500/week withdraw",
    "Multi-table (4 tables)",
    "Marketplace buy, staking, insurance",
    "Run it twice, 10% rakeback",
    "2,500 chip daily bonus",
  ],
  gold: [
    "High stakes (200/400)",
    "$5,000/day deposit, $10,000/week withdraw",
    "Full KYC verified",
    "5 clubs (500 members each)",
    "Marketplace sell (5% fee)",
    "Advanced analytics, 20% rakeback",
    "Blockchain verification",
    "5,000 chip daily bonus",
  ],
  platinum: [
    "Unlimited stakes",
    "$25,000/day deposit, $50,000/week withdraw",
    "VIP tables & concierge support",
    "Unlimited clubs",
    "Marketplace (2.5% fee)",
    "API access, 30% rakeback",
    "Ad-free experience",
    "10,000 chip daily bonus",
  ],
};

export default function Tiers() {
  const { user, refreshUser } = useAuth();
  const [tiers, setTiers] = useState<TierDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

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
        body: JSON.stringify({ tier: tierId, plan: billingCycle }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresKyc) {
          setError("KYC verification required. Please complete identity verification first.");
        } else {
          setError(data.message || "Upgrade failed");
        }
      } else {
        setSuccess(`Payment initiated for ${tierId} tier (${data.priceFormatted}/${billingCycle === "annual" ? "year" : "month"})!`);
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
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-white mb-2">Membership Tiers</h1>
          <p className="text-gray-400 text-sm">Upgrade your membership to unlock real money play, higher limits, and exclusive benefits</p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            {(() => { const Icon = TIER_ICONS[currentTier] || Shield; return <Icon className="w-4 h-4 text-primary" />; })()}
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Current: {currentTier}</span>
          </div>

          {/* Billing cycle toggle */}
          <div className="mt-4 inline-flex items-center gap-1 p-1 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                billingCycle === "annual"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Annual <span className="text-green-400 text-[0.6rem] ml-1">Save ~20%</span>
            </button>
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
            const colors = TIER_COLORS[tierId] || TIER_COLORS.free;
            const Icon = TIER_ICONS[tierId] || Shield;
            const benefits = TIER_BENEFITS[tierId] || [];
            const isCurrent = tierId === currentTier;
            const isLower = idx < currentRank;
            const prices = TIER_PRICES[tierId];
            const price = billingCycle === "annual" ? prices.annual : prices.monthly;
            const limits = TIER_LIMITS[tierId];
            const kyc = KYC_LEVELS[tierId];

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
                <div className="text-center mb-3">
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${colors.text}`} />
                  <h3 className={`text-lg font-display font-bold uppercase tracking-wider ${colors.text}`}>
                    {tierId}
                  </h3>
                  <p className="text-2xl font-black text-white mt-1">
                    {price === 0 ? "Free" : `$${(price / 100).toFixed(2)}`}
                  </p>
                  {price > 0 && (
                    <p className="text-[0.625rem] text-gray-500 uppercase">
                      per {billingCycle === "annual" ? "year" : "month"}
                    </p>
                  )}
                </div>

                {/* Deposit / Withdraw limits */}
                <div className="mb-3 rounded-lg bg-black/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <ArrowDown className={`w-3 h-3 shrink-0 ${colors.text}`} />
                    <span className="text-gray-400">Deposit:</span>
                    <span className="text-white font-bold ml-auto">{limits.depositDay}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <ArrowUp className={`w-3 h-3 shrink-0 ${colors.text}`} />
                    <span className="text-gray-400">Withdraw:</span>
                    <span className="text-white font-bold ml-auto">{limits.withdrawWeek}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <DollarSign className={`w-3 h-3 shrink-0 ${colors.text}`} />
                    <span className="text-gray-400">Stakes:</span>
                    <span className="text-white font-bold ml-auto">{limits.stakes}</span>
                  </div>
                </div>

                {/* KYC badge */}
                <div className="mb-3 flex items-center justify-center gap-1.5">
                  <Lock className={`w-3 h-3 ${kyc.color}`} />
                  <span className={`text-[0.625rem] font-bold uppercase tracking-wider ${kyc.color}`}>
                    KYC: {kyc.label}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 mb-4">
                  {benefits.map((benefit, i) => (
                    <div key={i} className="flex items-start gap-2 text-[0.6875rem] text-gray-300">
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
                        : "bg-gradient-to-r from-[#9a7b2c] via-[#d4af37] to-[#f3e2ad] text-black hover:brightness-110 border border-[#d4af37]/30"
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

        {/* KYC prompt */}
        <div className="text-center mt-6">
          <Link href="/kyc">
            <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-bold hover:bg-purple-500/20 transition-all">
              <Shield className="w-4 h-4" />
              Complete KYC Verification
            </button>
          </Link>
          <p className="text-gray-500 text-xs mt-2">Higher tiers require identity verification to unlock deposit and withdrawal limits</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
