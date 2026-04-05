import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Crown, Sparkles, Palette, Gauge, BarChart3,
  Zap, Headphones, Trophy, Ban, Check,
  Loader2, AlertCircle, CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const PERKS = [
  { icon: Sparkles, title: "Exclusive Avatars", description: "Unlock rare and legendary avatar collections" },
  { icon: Gauge, title: "Priority Table Seating", description: "Jump the queue and get seated first at popular tables" },
  { icon: BarChart3, title: "Advanced Analytics", description: "Deep stats, win-rate graphs, and session tracking" },
  { icon: Palette, title: "Custom Table Themes", description: "Access premium felt colors and table designs" },
  { icon: Zap, title: "Reduced Rake Fees", description: "Pay 25% less rake on every hand you play" },
  { icon: Headphones, title: "VIP Support", description: "Priority response from our dedicated support team" },
  { icon: Trophy, title: "Tournament Priority", description: "Early registration access to high-stakes tournaments" },
  { icon: Ban, title: "Ad-Free Experience", description: "No banners, no interruptions, pure poker" },
];

const PREMIUM_COST = 5000;
const YEARLY_DISCOUNT = 0.2;
const PREMIUM_YEARLY_COST = parseFloat((PREMIUM_COST * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2));

const VIP_PERKS = [
  "Access to Premium Avatars",
  "Exclusive 1/1 Marketplace",
  "Priority Seating at High-Stakes Tables",
  "Private VIP Chat",
  "2x Daily Bonus",
];

interface PremiumStatus {
  isPremium: boolean;
  expiresAt: string | null;
}

export default function PremiumUpgrade() {
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const displayCost = billingCycle === "monthly" ? PREMIUM_COST : PREMIUM_YEARLY_COST;
  const displayPeriod = billingCycle === "monthly" ? "month" : "year";

  const fetchStatus = async () => {
    try {
      const res = await apiRequest("GET", "/api/subscribe/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // User may not be authenticated yet, ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiRequest("POST", "/api/subscribe/premium");
      const data = await res.json();
      setSuccess(`Premium activated! ${data.chipsDeducted.toLocaleString()} chips deducted. New balance: ${data.newBalance.toLocaleString()} chips.`);
      setStatus({ isPremium: true, expiresAt: data.expiresAt });
    } catch (err: any) {
      try {
        const text = err.message || "";
        // apiRequest throws "status: body" format
        const bodyStr = text.includes(": ") ? text.split(": ").slice(1).join(": ") : text;
        const parsed = JSON.parse(bodyStr);
        setError(parsed.message || "Failed to subscribe. Please try again.");
      } catch {
        setError("Failed to subscribe. Please try again.");
      }
    } finally {
      setSubscribing(false);
    }
  };

  const isCurrentlyPremium = status?.isPremium ?? false;
  const expiresAt = status?.expiresAt ? new Date(status.expiresAt) : null;

  return (
    <DashboardLayout title="Premium">
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4a843]/15 border border-[#d4a843]/25 mb-2">
            <Crown className="w-8 h-8 text-[#f0d478]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-wider gold-text">
            {isCurrentlyPremium ? "PREMIUM MEMBER" : "UPGRADE TO PREMIUM"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isCurrentlyPremium
              ? "You have access to all premium perks and features."
              : "Unlock the full High Rollers experience with exclusive perks, priority access, and premium features."}
          </p>
          {isCurrentlyPremium && expiresAt && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">
                Active until {expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          )}
        </motion.div>

        {/* Billing Cycle Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center justify-center gap-4"
        >
          <span className={`text-sm font-bold uppercase tracking-wider transition-colors ${billingCycle === "monthly" ? "text-white" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            className="relative w-14 h-7 rounded-full transition-colors"
            style={{ background: billingCycle === "yearly" ? "linear-gradient(135deg, #9a7b2c, #d4af37)" : "rgba(255,255,255,0.1)" }}
          >
            <motion.div
              className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
              animate={{ left: billingCycle === "yearly" ? "calc(100% - 24px)" : "4px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-sm font-bold uppercase tracking-wider transition-colors ${billingCycle === "yearly" ? "text-white" : "text-gray-500"}`}>
            Yearly
            <span className="ml-1.5 text-[0.625rem] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Save 20%</span>
          </span>
        </motion.div>

        {/* VIP Perks Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-surface-high/50 backdrop-blur-xl border border-[#d4a843]/15 rounded-xl p-5 space-y-3"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#f0d478] mb-3">VIP Perks Included</h3>
          {VIP_PERKS.map((perk) => (
            <div key={perk} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <span className="text-sm text-white font-medium">{perk}</span>
            </div>
          ))}
        </motion.div>

        {/* Perks Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {PERKS.map((perk, i) => {
            const Icon = perk.icon;
            return (
              <motion.div
                key={perk.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.04 }}
                className="bg-surface-high/50 backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 flex items-start gap-3 hover:border-[#d4a843]/20 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#d4a843]/10 border border-[#d4a843]/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#f0d478]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{perk.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{perk.description}</div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Pricing Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-high/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 md:p-8 space-y-6"
        >
          {/* Price Display */}
          <div className="text-center space-y-1">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl md:text-5xl font-display font-bold gold-text">
                {displayCost.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">chips/{displayPeriod}</span>
            </div>
            {billingCycle === "yearly" && (
              <div className="text-xs text-green-400 font-bold">
                You save {(PREMIUM_COST * 12 - PREMIUM_YEARLY_COST).toLocaleString()} chips vs monthly
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Deducted from your main wallet
            </div>
          </div>

          {/* Feature summary */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {["All 8 premium perks", billingCycle === "monthly" ? "30-day duration" : "365-day duration", "Instant activation"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-[#d4a843]" />
                {item}
              </span>
            ))}
          </div>

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs font-medium text-green-400">{success}</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs font-medium text-red-400">{error}</span>
            </div>
          )}

          {/* CTA Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSubscribe}
              disabled={subscribing || loading}
              className="px-10 py-4 rounded-xl text-sm font-black uppercase tracking-[0.15em] text-black shadow-[0_0_20px_rgba(212,168,67,0.3)] hover:shadow-[0_0_40px_rgba(212,168,67,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 40%, #f3e2ad 60%, #d4af37 100%)" }}
            >
              <span className="flex items-center gap-2">
                {subscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4" />
                )}
                {subscribing
                  ? "Processing..."
                  : isCurrentlyPremium
                    ? "Extend Subscription"
                    : "UPGRADE TO PREMIUM"}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
