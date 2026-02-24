import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles, Star, Crown, ShoppingCart, Wallet, Heart,
  Download, Tag, Zap, Gem
} from "lucide-react";

import avatar1 from "@assets/generated_images/cyberpunk_poker_player_avatar_1.png";
import avatar2 from "@assets/generated_images/cyberpunk_poker_player_avatar_2.png";
import avatar3 from "@assets/generated_images/cyberpunk_poker_player_avatar_3.png";
import avatar4 from "@assets/generated_images/cyberpunk_poker_player_avatar_4.png";
import entropyHud from "@assets/generated_images/holographic_entropy_network_hud.png";
import allianceHud from "@assets/generated_images/holographic_player_alliance_ui.png";
import feltTexture from "@assets/generated_images/Dark_Teal_Poker_Felt_Texture_83ec2760.png";

const TABS = ["Avatars", "Table Themes", "Emotes", "Premium"];

interface ShopItem {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  rarity: "Legendary" | "Epic" | "Rare" | "Mythic";
  priceChips: number;
  priceCrypto?: string;
  salePrice?: number;
  isNew?: boolean;
}

const FEATURED_ITEMS: ShopItem[] = [
  {
    id: "1", name: "The Cyber Source", subtitle: "Animated Mythic",
    image: avatar1, rarity: "Mythic", priceChips: 3000, priceCrypto: "0.1 ETH", salePrice: 2995
  },
  {
    id: "2", name: "Deep Space Odyssee", subtitle: "Legendary Avatar",
    image: avatar2, rarity: "Legendary", priceChips: 3000, priceCrypto: "1,000 ETH", salePrice: undefined
  },
  {
    id: "3", name: "Demonic Odyssey", subtitle: "Legendary Theme",
    image: entropyHud, rarity: "Legendary", priceChips: 3000, priceCrypto: "$5", salePrice: 2995
  },
];

const NEW_ARRIVALS: ShopItem[] = [
  { id: "n1", name: "Neon Wolf", subtitle: "Avatar", image: avatar3, rarity: "Epic", priceChips: 1500 },
  { id: "n2", name: "Dark Felt", subtitle: "Theme", image: feltTexture, rarity: "Rare", priceChips: 800 },
  { id: "n3", name: "Gold Crown", subtitle: "Emote", image: avatar4, rarity: "Epic", priceChips: 500 },
  { id: "n4", name: "Alliance", subtitle: "Theme", image: allianceHud, rarity: "Rare", priceChips: 1200 },
  { id: "n5", name: "Cyber Eye", subtitle: "Avatar", image: avatar1, rarity: "Legendary", priceChips: 2500 },
  { id: "n6", name: "Fire Table", subtitle: "Theme", image: entropyHud, rarity: "Epic", priceChips: 1800 },
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
        {item.isNew && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider text-green-400 bg-green-500/20 border border-green-500/20">
            NEW
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{item.subtitle}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        <div className="flex items-center justify-between mt-2">
          <div>
            {item.salePrice ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400">{item.salePrice} Chips</span>
                <span className="text-[9px] text-gray-600 line-through">{item.priceChips}</span>
              </div>
            ) : (
              <span className="text-xs font-bold text-amber-400">{item.priceChips} Chips</span>
            )}
            {item.priceCrypto && (
              <div className="text-[9px] text-gray-500">{item.priceCrypto}</div>
            )}
          </div>
          <button className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
            <ShoppingCart className="w-3 h-3 text-amber-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Shop() {
  const [activeTab, setActiveTab] = useState("Avatars");

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
                        <div className="text-[7px] text-amber-400">{item.priceChips}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right Sidebar ─────────────────────────────── */}
          <div className="space-y-4">
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
                <div className="text-[10px] text-gray-500 mb-1">
                  3000 Chips (+75 $USD*)
                </div>
                <div className="text-[9px] text-gray-600 mb-3">
                  Exclusive Emo Pack
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {[Star, Crown, Zap].map((Icon, i) => (
                    <div key={i} className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                      <Icon className="w-3 h-3 text-amber-400" />
                    </div>
                  ))}
                </div>
                <button
                  className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black"
                  style={{
                    background: "linear-gradient(135deg, #c9a84c, #e8c566)",
                    boxShadow: "0 0 20px rgba(201,168,76,0.3)",
                  }}
                >
                  Buy Now
                </button>
              </div>
            </motion.div>

            {/* Wallet Actions */}
            <div className="flex gap-2">
              <button className="flex-1 glass rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-white/5 hover:border-white/10 hover:text-white transition-all flex items-center justify-center gap-1.5">
                <Wallet className="w-3 h-3" />
                Deposit $0.16
              </button>
              <button className="flex-1 glass rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-white/5 hover:border-white/10 hover:text-white transition-all flex items-center justify-center gap-1.5">
                <Heart className="w-3 h-3" />
                Wishlist
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
