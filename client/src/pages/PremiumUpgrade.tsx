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
                {PREMIUM_COST.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">chips/month</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Deducted from your main wallet
            </div>
          </div>

          {/* Feature summary */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {["All 8 premium perks", "30-day duration", "Instant activation"].map((item) => (
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
              className="btn-neon gold-gradient px-8 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(212,168,67,0.3)] hover:shadow-[0_0_30px_rgba(212,168,67,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    ? "Extend 30 Days"
                    : "Upgrade Now"}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
