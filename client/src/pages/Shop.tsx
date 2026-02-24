import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles, Star, Crown, Wallet, Gift,
  Tag, Zap, Gem, Coins, Clock, Loader2, ArrowUpRight, ArrowDownRight
} from "lucide-react";

import avatar1 from "@assets/generated_images/player_seated_cyberpunk_1.png";
import avatar2 from "@assets/generated_images/player_seated_cyberpunk_2.png";
import avatar3 from "@assets/generated_images/player_seated_cyberpunk_3.png";
import avatar4 from "@assets/generated_images/player_seated_cyberpunk_4.png";
import entropyHud from "@assets/generated_images/holographic_hud_overlay.png";
import allianceHud from "@assets/generated_images/marketplace_item_armor.png";
import feltTexture from "@assets/generated_images/poker_table_top_cinematic.png";

const TABS = ["Avatars", "Table Themes", "Emotes", "Premium"];

interface ShopItem {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  rarity: "Legendary" | "Epic" | "Rare" | "Mythic";
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

const FEATURED_ITEMS: ShopItem[] = [
  { id: "1", name: "The Cyber Source", subtitle: "Animated Mythic", image: avatar1, rarity: "Mythic" },
  { id: "2", name: "Deep Space Odyssey", subtitle: "Legendary Avatar", image: avatar2, rarity: "Legendary" },
  { id: "3", name: "Demonic Odyssey", subtitle: "Legendary Theme", image: entropyHud, rarity: "Legendary" },
];

const NEW_ARRIVALS: ShopItem[] = [
  { id: "n1", name: "Neon Wolf", subtitle: "Avatar", image: avatar3, rarity: "Epic" },
  { id: "n2", name: "Dark Felt", subtitle: "Theme", image: feltTexture, rarity: "Rare" },
  { id: "n3", name: "Gold Crown", subtitle: "Emote", image: avatar4, rarity: "Epic" },
  { id: "n4", name: "Alliance", subtitle: "Theme", image: allianceHud, rarity: "Rare" },
  { id: "n5", name: "Cyber Eye", subtitle: "Avatar", image: avatar1, rarity: "Legendary" },
  { id: "n6", name: "Fire Table", subtitle: "Theme", image: entropyHud, rarity: "Epic" },
];

const RARITY_COLORS: Record<string, string> = {
  Mythic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  Legendary: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Epic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  Rare: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

function FeaturedCard({ item }: { item: ShopItem }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      className="glass rounded-xl overflow-hidden border border-white/5 hover:border-amber-500/20 transition-all cursor-pointer group"
      style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}
    >
      <div className="aspect-square relative overflow-hidden">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${RARITY_COLORS[item.rarity]}`}>
          {item.rarity}
        </div>
      </div>
      <div className="p-3">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{item.subtitle}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-wider">Coming Soon</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Shop() {
  const [activeTab, setActiveTab] = useState("Avatars");
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ bonus: number } | null>(null);
  const [loadingTx, setLoadingTx] = useState(true);

  // Fetch real balance
  useEffect(() => {
    fetch("/api/wallet/balance")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.balance != null) setBalance(data.balance); })
      .catch(() => {});
  }, []);

  // Fetch transactions
  useEffect(() => {
    fetch("/api/wallet/transactions")
      .then((r) => r.ok ? r.json() : [])
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoadingTx(false));
  }, []);

  const handleClaimDaily = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch("/api/wallet/claim-daily", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setClaimResult({ bonus: data.bonus });
        await refreshUser();
        // Refresh transactions
        const txRes = await fetch("/api/wallet/transactions");
        if (txRes.ok) setTransactions(await txRes.json());
        setTimeout(() => setClaimResult(null), 3000);
      }
    } catch {} finally {
      setClaiming(false);
    }
  };

  const displayBalance = balance ?? user?.chipBalance ?? 0;

  return (
    <DashboardLayout>
      <div className="px-8 pb-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white/[0.02] rounded-lg p-1 w-fit border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ─── Main Content (3 cols) ─────────────────────── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Gem className="w-5 h-5 text-purple-400" />
                Ultra-Rare Customization Marketplace
              </h2>
            </div>

            {/* Featured Items */}
            <div className="grid grid-cols-3 gap-4">
              {FEATURED_ITEMS.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <FeaturedCard item={item} />
                </motion.div>
              ))}
            </div>

            {/* New Arrivals */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                New Arrivals
                <span className="text-[8px] font-bold text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 ml-2">Coming Soon</span>
              </h3>
              <div className="grid grid-cols-6 gap-3">
                {NEW_ARRIVALS.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    whileHover={{ scale: 1.08 }}
                    className="glass rounded-lg overflow-hidden border border-white/5 hover:border-cyan-500/20 transition-all cursor-pointer"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="text-[8px] font-bold text-white truncate">{item.name}</div>
                        <div className="text-[7px] text-amber-400/60">Coming Soon</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Transaction History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-xl border border-white/5 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Transaction History
                </h3>
                <span className="text-[9px] text-gray-600">{transactions.length} transactions</span>
              </div>
              {loadingTx ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-[11px] text-gray-600">No transactions yet. Claim your daily bonus to get started!</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {transactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-3 ${
                        tx.amount > 0 ? "bg-green-500/10 border border-green-500/15" : "bg-red-500/10 border border-red-500/15"
                      }`}>
                        {tx.amount > 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white capitalize">{tx.type}</div>
                        <div className="text-[9px] text-gray-600">{tx.description || tx.type}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-gray-600">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ─── Right Sidebar ─────────────────────────────── */}
          <div className="space-y-4">
            {/* Real Balance Display */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-4 border border-amber-500/15"
            >
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Your Balance</span>
              </div>
              <div className="text-2xl font-black text-amber-400 tabular-nums">
                {displayBalance.toLocaleString()}
              </div>
              <div className="text-[9px] text-gray-600 uppercase">chips</div>
            </motion.div>

            {/* Daily Bonus Claim */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-4 border border-green-500/15 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 blur-3xl rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-green-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Daily Bonus</span>
                </div>
                <p className="text-[10px] text-gray-500 mb-3">Claim your free chips every 24 hours!</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaimDaily}
                  disabled={claiming}
                  className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #00ff9d, #00d4aa)",
                    boxShadow: "0 0 20px rgba(0,255,157,0.2)",
                  }}
                >
                  {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                  Claim Daily Bonus
                </motion.button>
                {claimResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mt-2 text-xs font-bold text-green-400"
                  >
                    +{claimResult.bonus.toLocaleString()} chips claimed!
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Limited Time Offer */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-4 border border-amber-500/15 overflow-hidden relative"
              style={{ boxShadow: "0 0 30px rgba(201,168,76,0.05)" }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 blur-3xl rounded-full" />
              <div className="relative">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                  Limited-Time Offer:
                </div>
                <div className="text-sm font-black text-white uppercase tracking-wider mb-1">
                  Elite Player's Pass
                </div>
                <div className="text-[9px] text-gray-600 mb-3">
                  <span className="text-amber-400/60 font-bold uppercase">Coming Soon</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {[Star, Crown, Zap].map((Icon, i) => (
                    <div key={i} className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                      <Icon className="w-3 h-3 text-amber-400" />
                    </div>
                  ))}
                </div>
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black/50 cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #c9a84c80, #e8c56680)",
                  }}
                >
                  Coming Soon
                </button>
              </div>
            </motion.div>

            {/* Wallet Actions */}
            <div className="flex gap-2">
              <button className="flex-1 glass rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-white/5 hover:border-white/10 hover:text-white transition-all flex items-center justify-center gap-1.5">
                <Wallet className="w-3 h-3" />
                Deposit
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
