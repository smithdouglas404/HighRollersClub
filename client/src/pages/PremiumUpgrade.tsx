import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import { Crown, ArrowRight, Loader2 } from "lucide-react";

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
        <GoldButton
          onClick={() => setLocation("/tiers")}
          className="inline-flex items-center gap-2"
        >
          <Crown className="w-4 h-4" />
          View Membership Tiers
          <ArrowRight className="w-4 h-4" />
        </GoldButton>
      </div>
    </DashboardLayout>
  );
}
