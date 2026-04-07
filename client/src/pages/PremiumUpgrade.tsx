import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Crown, ArrowRight, Loader2 } from "lucide-react";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";

/**
 * Legacy Premium page — the old single-tier premium system has been replaced
 * by the new 5-tier subscription model. This page redirects to /tiers.
 */
export default function PremiumUpgrade() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation("/tiers");
    }, 2000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <DashboardLayout title="Premium">
      <div className="p-8 max-w-lg mx-auto text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4a843]/15 border border-[#d4a843]/25 mb-2">
          <Crown className="w-8 h-8 text-[#f0d478]" />
        </div>
        <h1 className="text-2xl font-display font-bold gold-text">
          Premium Has Been Upgraded
        </h1>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          The old Premium subscription has been replaced by our new tiered membership system
          with Bronze, Silver, Gold, and Platinum tiers -- each with real money stakes,
          deposit limits, and exclusive perks.
        </p>
        <div className="flex items-center justify-center gap-2 text-primary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Redirecting to Membership Tiers...</span>
        </div>
        <button
          onClick={() => setLocation("/tiers")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider gold-vault-btn" style={{ background: "linear-gradient(135deg, #8a6914 0%, #c9a227 20%, #f3e2ad 50%, #d4af37 80%, #8a6914 100%)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }} data-x=" transition-all hover:shadow-[0_0_20px_rgba(212,168,67,0.3)]"
        >
          <Crown className="w-4 h-4" />
          View Membership Tiers
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </DashboardLayout>
  );
}
