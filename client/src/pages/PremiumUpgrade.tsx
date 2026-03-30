import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Crown, Sparkles, Palette, Gauge, BarChart3,
  Zap, Headphones, Trophy, Ban, Check
} from "lucide-react";

type BillingCycle = "monthly" | "yearly";

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

const PRICING: Record<BillingCycle, { price: string; period: string; note?: string }> = {
  monthly: { price: "$9.99", period: "/month" },
  yearly: { price: "$89.99", period: "/year", note: "Save 25%" },
};

export default function PremiumUpgrade() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const selected = PRICING[billing];

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
            UPGRADE TO PREMIUM
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Unlock the full High Rollers experience with exclusive perks, priority access, and premium features.
          </p>
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
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                billing === "monthly"
                  ? "bg-[#d4a843]/20 text-[#f0d478] border border-[#d4a843]/30"
                  : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-[#d4a843]/20 text-[#f0d478] border border-[#d4a843]/30"
                  : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              Yearly
              <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold">
                -25%
              </span>
            </button>
          </div>

          {/* Price Display */}
          <div className="text-center space-y-1">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl md:text-5xl font-display font-bold gold-text">
                {selected.price}
              </span>
              <span className="text-sm text-muted-foreground">{selected.period}</span>
            </div>
            {selected.note && (
              <div className="text-xs text-green-400 font-bold">{selected.note}</div>
            )}
          </div>

          {/* Feature summary */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {["All 8 premium perks", "Cancel anytime", "Instant activation"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-[#d4a843]" />
                {item}
              </span>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <button className="btn-neon gold-gradient px-8 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(212,168,67,0.3)] hover:shadow-[0_0_30px_rgba(212,168,67,0.5)] transition-all">
              <span className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Upgrade Now
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
