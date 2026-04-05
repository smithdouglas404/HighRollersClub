import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Search,
  ChevronDown,
  Plus,
  X,
  Loader2,
  Lock,
  Crown,
  Sparkles,
  Check,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";

/* ──────────────────────────── Types ──────────────────────────── */

interface Listing {
  id: string;
  sellerId: string;
  itemId: string;
  price: number;
  status: string;
  buyerId: string | null;
  platformFee: number | null;
  createdAt: string;
  soldAt: string | null;
}

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  price: number;
  imageUrl: string | null;
}

interface InventoryItem {
  id: string;
  itemId: string;
}

/* ──────────────────────────── Constants ──────────────────────── */

type Tab = "browse" | "my-listings";
type RarityFilter = "All" | "Mythic" | "Exclusive" | "Rare" | "Epic" | "Common";
type SortOption = "Price Low" | "Price High" | "Newest";
type PaymentMethod = "gold" | "eth";

const RARITY_FILTERS: RarityFilter[] = ["All", "Mythic", "Exclusive", "Rare", "Epic", "Common"];
const SORT_OPTIONS: SortOption[] = ["Price Low", "Price High", "Newest"];

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  exclusive: 3,
  mythic: 4,
};

const RARITY_GRADIENT: Record<string, string> = {
  mythic: "from-yellow-600 via-amber-400 to-yellow-700",
  exclusive: "from-purple-700 via-fuchsia-500 to-purple-800",
  rare: "from-blue-700 via-cyan-400 to-blue-800",
  epic: "from-violet-700 via-purple-400 to-violet-800",
  common: "from-zinc-600 via-gray-400 to-zinc-700",
};

const RARITY_BADGE: Record<string, { bg: string; text: string; glow: string }> = {
  mythic: {
    bg: "bg-yellow-500/20 border-yellow-500/50",
    text: "text-yellow-300",
    glow: "shadow-[0_0_12px_rgba(234,179,8,0.5)]",
  },
  exclusive: {
    bg: "bg-purple-500/20 border-purple-500/50",
    text: "text-purple-300",
    glow: "",
  },
  rare: {
    bg: "bg-blue-500/20 border-blue-500/50",
    text: "text-blue-300",
    glow: "",
  },
  epic: {
    bg: "bg-violet-500/20 border-violet-500/50",
    text: "text-violet-300",
    glow: "",
  },
  common: {
    bg: "bg-gray-500/20 border-gray-500/40",
    text: "text-gray-400",
    glow: "",
  },
};

const GOLD_TO_ETH = 0.000012; // rough conversion for display

const TIER_RANK: Record<string, number> = {
  free: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

function tierAtLeast(userTier: string | undefined, min: string): boolean {
  return (TIER_RANK[userTier ?? "free"] ?? 0) >= (TIER_RANK[min] ?? 0);
}

/* ──────────────────────────── Confetti keyframes (injected once) ── */

const CONFETTI_STYLE_ID = "marketplace-confetti-style";
function ensureConfettiStyles() {
  if (document.getElementById(CONFETTI_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = CONFETTI_STYLE_ID;
  style.textContent = `
    @keyframes mp-confetti-fall {
      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    .mp-confetti-dot {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: mp-confetti-fall linear forwards;
    }
  `;
  document.head.appendChild(style);
}

function ConfettiOverlay() {
  useEffect(() => { ensureConfettiStyles(); }, []);
  const dots = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.2}s`,
      duration: `${1.8 + Math.random() * 1.4}s`,
      size: `${6 + Math.random() * 6}px`,
      color: ["#d4af37", "#f5d76e", "#c5a028", "#ffe066", "#b8942e"][i % 5],
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {dots.map(d => (
        <div
          key={d.id}
          className="mp-confetti-dot"
          style={{
            left: d.left,
            width: d.size,
            height: d.size,
            backgroundColor: d.color,
            animationDelay: d.delay,
            animationDuration: d.duration,
          }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────── Component ──────────────────────── */

export default function Marketplace() {
  const { user } = useAuth();

  /* ── data ── */
  const [listings, setListings] = useState<Listing[]>([]);
  const [items, setItems] = useState<Map<string, ShopItem>>(new Map());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── UI state ── */
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [rarityDropdownOpen, setRarityDropdownOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  /* ── modals ── */
  const [confirmBuy, setConfirmBuy] = useState<Listing | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gold");
  const [buyProcessing, setBuyProcessing] = useState(false);
  const [buySuccess, setBuySuccess] = useState<Listing | null>(null);
  const [listModal, setListModal] = useState(false);
  const [listItemId, setListItemId] = useState("");
  const [listPrice, setListPrice] = useState("");

  /* ── data fetching (preserved) ── */
  const fetchData = async () => {
    try {
      const [listRes, shopRes, invRes] = await Promise.all([
        fetch("/api/marketplace", { credentials: "include" }).then(r => r.json()),
        fetch("/api/shop", { credentials: "include" }).then(r => r.json()),
        fetch("/api/shop/inventory", { credentials: "include" }).then(r => r.json()),
      ]);
      if (Array.isArray(listRes)) setListings(listRes);
      if (Array.isArray(shopRes)) {
        const map = new Map<string, ShopItem>();
        shopRes.forEach((i: ShopItem) => map.set(i.id, i));
        setItems(map);
      }
      if (Array.isArray(invRes)) setInventory(invRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── filtering & sorting ── */
  const filtered = useMemo(() => {
    let result = listings.filter(l => l.status === "active" || l.status === "listed");

    // tab filter
    if (tab === "my-listings") {
      result = result.filter(l => l.sellerId === user?.id);
    }

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l => {
        const item = items.get(l.itemId);
        return (
          item?.name?.toLowerCase().includes(q) ||
          item?.description?.toLowerCase().includes(q)
        );
      });
    }

    // rarity
    if (rarityFilter !== "All") {
      const r = rarityFilter.toLowerCase();
      result = result.filter(l => items.get(l.itemId)?.rarity?.toLowerCase() === r);
    }

    // sort
    result = [...result].sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "Price Low") return a.price - b.price;
      if (sortBy === "Price High") return b.price - a.price;
      return 0;
    });

    return result;
  }, [listings, items, tab, search, rarityFilter, sortBy, user?.id]);

  /* ── handlers (preserved API patterns) ── */
  const [listError, setListError] = useState("");
  const handleList = async () => {
    if (!listItemId || !listPrice) return;
    const price = parseInt(listPrice);
    if (isNaN(price) || price <= 0) { setListError("Price must be positive"); return; }
    setListError("");
    await fetch("/api/marketplace/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ itemId: listItemId, price: parseInt(listPrice) }),
    });
    setListModal(false);
    setListItemId("");
    setListPrice("");
    fetchData();
  };

  const [buyError, setBuyError] = useState("");
  const handleBuy = async (listing: Listing) => {
    setBuyProcessing(true);
    setBuyError("");
    try {
      const res = await fetch(`/api/marketplace/${listing.id}/buy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Purchase failed" }));
        setBuyError(data.message || "Purchase failed");
        setBuyProcessing(false);
        return;
      }
    } catch {
      setBuyError("Network error — purchase failed");
      setBuyProcessing(false);
      return;
    }
    setBuyProcessing(false);
    setConfirmBuy(null);
    setBuySuccess(listing);
    fetchData();
  };

  const handleCancel = async (listingId: string) => {
    await fetch(`/api/marketplace/${listingId}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    fetchData();
  };

  const canBuy = tierAtLeast(user?.tier, "silver");
  const canSell = tierAtLeast(user?.tier, "silver") && user?.kycStatus === "approved";
  const feePercent = user?.tier === "platinum" ? 2.0 : 2.9;

  return (
    <DashboardLayout title="Marketplace">
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">

        {/* ── Premium Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-900/20 via-black/40 to-yellow-900/20 backdrop-blur-xl p-5"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.08),transparent_60%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Unlock Premium Marketplace Perks</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md">
                  Silver+ members get exclusive access to buy & sell avatars, reduced fees for Platinum holders, and early access to Mythic drops.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* billing toggle */}
              <div className="flex items-center rounded-full bg-black/40 border border-white/[0.06] p-0.5 text-[0.625rem]">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    billingCycle === "monthly"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    billingCycle === "yearly"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Yearly
                </button>
              </div>
              <Link
                href="/tiers"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-amber-500 text-black text-xs font-bold hover:from-yellow-500 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
              >
                UPGRADE
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Header + Tabs ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Avatar Marketplace</h2>
              <p className="text-xs text-gray-400">{filtered.length} item{filtered.length !== 1 ? "s" : ""} available</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab pills */}
            <div className="flex items-center rounded-full bg-black/40 border border-white/[0.06] p-0.5">
              {(["browse", "my-listings"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    tab === t
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                      : "text-gray-400 hover:text-white border border-transparent"
                  }`}
                >
                  {t === "browse" ? "Browse" : "My Listings"}
                </button>
              ))}
            </div>

            {canSell && (
              <button
                onClick={() => setListModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> List Item
              </button>
            )}
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search avatars..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs placeholder:text-gray-600 focus:border-yellow-500/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Rarity dropdown */}
          <div className="relative">
            <button
              onClick={() => setRarityDropdownOpen(!rarityDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] text-xs text-gray-300 hover:border-yellow-500/30 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-yellow-500" />
              {rarityFilter}
              <ChevronDown className={`w-3 h-3 transition-transform ${rarityDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {rarityDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-30 w-40 rounded-lg bg-[#1a1a2e] border border-white/[0.1] py-1 shadow-xl"
                >
                  {RARITY_FILTERS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setRarityFilter(r); setRarityDropdownOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                        rarityFilter === r ? "text-yellow-300 bg-yellow-500/10" : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-full text-[0.625rem] font-medium transition-colors ${
                  sortBy === s
                    ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30"
                    : "text-gray-500 hover:text-white border border-transparent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-500/60" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {tab === "my-listings" ? "You have no active listings" : "No avatars match your filters"}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filtered.map((listing, idx) => {
              const item = items.get(listing.itemId);
              const rarity = (item?.rarity ?? "common").toLowerCase();
              const badge = RARITY_BADGE[rarity] ?? RARITY_BADGE.common;
              const gradient = RARITY_GRADIENT[rarity] ?? RARITY_GRADIENT.common;
              const isOwn = listing.sellerId === user?.id;

              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  className="group rounded-xl bg-[#0f0f1a] border border-white/[0.06] overflow-hidden hover:border-yellow-500/20 transition-all duration-300"
                >
                  {/* Image area */}
                  <div className={`aspect-square bg-gradient-to-br ${gradient} opacity-80 flex items-center justify-center relative`}>
                    {item?.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-lg" />
                    ) : (
                      <ShoppingBag className="w-14 h-14 text-white/30" />
                    )}
                    {/* Rarity badge overlay */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[0.5rem] uppercase font-bold border ${badge.bg} ${badge.text} ${badge.glow}`}
                    >
                      {rarity}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="text-xs font-bold text-white truncate">{item?.name ?? "Unknown Avatar"}</div>
                    {item?.description && (
                      <p className="text-[0.6rem] text-gray-500 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}

                    {/* Dual pricing */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold" style={{ color: "#d4af37" }}>
                        {listing.price.toLocaleString()} <span className="text-[0.5rem] font-normal text-yellow-600">GOLD</span>
                      </span>
                      <span className="text-[0.5rem] text-gray-600">
                        ~{(listing.price * GOLD_TO_ETH).toFixed(4)} ETH
                      </span>
                    </div>

                    {/* Action */}
                    {tab === "my-listings" && isOwn ? (
                      <button
                        onClick={() => handleCancel(listing.id)}
                        className="w-full py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[0.625rem] font-medium hover:bg-red-500/20 transition-colors"
                      >
                        Cancel Listing
                      </button>
                    ) : isOwn ? (
                      <span className="block text-center text-[0.625rem] text-gray-600 py-1.5">Your listing</span>
                    ) : !canBuy ? (
                      <button
                        disabled
                        className="w-full py-1.5 rounded-lg bg-gray-800/50 border border-white/[0.04] text-gray-500 text-[0.625rem] font-medium flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <Lock className="w-3 h-3" /> Silver+ Required
                      </button>
                    ) : (
                      <button
                        onClick={() => { setConfirmBuy(listing); setPaymentMethod("gold"); setBuyProcessing(false); }}
                        className="w-full py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-[0.625rem] font-bold hover:bg-yellow-500/20 transition-colors"
                      >
                        Buy Now
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── Buy Confirmation Modal ── */}
        <AnimatePresence>
          {confirmBuy && !buySuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => { if (!buyProcessing) setConfirmBuy(null); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#12121e] rounded-2xl border border-yellow-500/20 p-6 w-full max-w-sm space-y-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Confirm Purchase</h3>
                  {!buyProcessing && (
                    <button onClick={() => setConfirmBuy(null)}>
                      <X className="w-4 h-4 text-gray-500 hover:text-white transition-colors" />
                    </button>
                  )}
                </div>

                {/* Item preview */}
                {(() => {
                  const item = items.get(confirmBuy.itemId);
                  const rarity = (item?.rarity ?? "common").toLowerCase();
                  const gradient = RARITY_GRADIENT[rarity] ?? RARITY_GRADIENT.common;
                  const badge = RARITY_BADGE[rarity] ?? RARITY_BADGE.common;
                  return (
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                        {item?.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-contain" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-white/30" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{item?.name ?? "Unknown"}</div>
                        <span className={`text-[0.5rem] uppercase font-bold ${badge.text}`}>{rarity}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Price */}
                <div className="rounded-lg bg-black/40 border border-white/[0.06] p-3 space-y-2">
                  <div className="flex justify-between text-[0.625rem]">
                    <span className="text-gray-400">Price</span>
                    <span className="font-bold" style={{ color: "#d4af37" }}>{confirmBuy.price.toLocaleString()} Gold</span>
                  </div>
                  <div className="flex justify-between text-[0.625rem]">
                    <span className="text-gray-400">ETH Equivalent</span>
                    <span className="text-gray-300">~{(confirmBuy.price * GOLD_TO_ETH).toFixed(4)} ETH</span>
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-[0.5rem] text-gray-500 uppercase tracking-wider mb-2 block">Payment Method</label>
                  <div className="flex gap-2">
                    {(["gold", "eth"] as PaymentMethod[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          paymentMethod === m
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                            : "bg-black/20 border-white/[0.06] text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {m === "gold" ? "Gold Chips" : "ETH"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error display */}
                {buyError && (
                  <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{buyError}</p>
                )}

                {/* Confirm button */}
                <button
                  onClick={() => handleBuy(confirmBuy)}
                  disabled={buyProcessing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-500 text-black text-xs font-bold hover:from-yellow-500 hover:to-amber-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
                >
                  {buyProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "CONFIRM PURCHASE"
                  )}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Purchase Success Modal ── */}
        <AnimatePresence>
          {buySuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setBuySuccess(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-[#12121e] rounded-2xl border border-yellow-500/30 p-8 w-full max-w-sm text-center space-y-5 shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <ConfettiOverlay />

                <div className="relative z-20 space-y-5">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-yellow-400" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">PURCHASE SUCCESSFUL!</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {items.get(buySuccess.itemId)?.name ?? "Item"} has been added to your inventory.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href="/wardrobe"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-500 text-black text-xs font-bold hover:from-yellow-500 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/20"
                    >
                      View in Wardrobe <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => setBuySuccess(null)}
                      className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 text-xs font-medium hover:text-white transition-colors"
                    >
                      Back to Market
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── List Item Modal ── */}
        <AnimatePresence>
          {listModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setListModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#12121e] rounded-2xl border border-yellow-500/20 p-6 w-full max-w-md space-y-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">List an Avatar for Sale</h3>
                  <button onClick={() => setListModal(false)}>
                    <X className="w-4 h-4 text-gray-500 hover:text-white transition-colors" />
                  </button>
                </div>

                {!canSell ? (
                  <div className="text-center py-6 space-y-2">
                    <Lock className="w-8 h-8 text-gray-600 mx-auto" />
                    <p className="text-xs text-gray-400">Silver+ membership with verified KYC is required to sell on the marketplace.</p>
                    <Link
                      href="/tiers"
                      className="inline-block px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-medium mt-2"
                    >
                      Upgrade Tier
                    </Link>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[0.5rem] text-gray-500 uppercase tracking-wider mb-1.5 block">Select Avatar</label>
                      <select
                        value={listItemId}
                        onChange={e => setListItemId(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs p-2.5 focus:border-yellow-500/30 focus:outline-none transition-colors"
                      >
                        <option value="">Choose an avatar...</option>
                        {inventory.map(inv => {
                          const item = items.get(inv.itemId);
                          return (
                            <option key={inv.id} value={inv.itemId}>
                              {item?.name ?? inv.itemId} ({item?.rarity})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[0.5rem] text-gray-500 uppercase tracking-wider mb-1.5 block">Price (Gold Chips)</label>
                      <input
                        type="number"
                        value={listPrice}
                        onChange={e => setListPrice(e.target.value)}
                        min="1"
                        className="w-full rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs p-2.5 focus:border-yellow-500/30 focus:outline-none transition-colors"
                        placeholder="Enter price..."
                      />
                    </div>

                    {/* Fee breakdown */}
                    {listPrice && parseInt(listPrice) > 0 && (
                      <div className="rounded-lg bg-black/30 border border-white/[0.04] p-3 space-y-1.5">
                        <div className="flex justify-between text-[0.625rem]">
                          <span className="text-gray-400">Listing Price</span>
                          <span className="text-white">{parseInt(listPrice).toLocaleString()} Gold</span>
                        </div>
                        <div className="flex justify-between text-[0.625rem]">
                          <span className="text-gray-400">
                            Platform Fee ({feePercent}%{user?.tier === "platinum" ? " — Platinum rate" : ""})
                          </span>
                          <span className="text-red-400">
                            -{Math.max(1, Math.floor(parseInt(listPrice) * (feePercent / 100))).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t border-white/[0.06] pt-1.5 flex justify-between text-[0.625rem] font-bold">
                          <span className="text-white">You Receive</span>
                          <span style={{ color: "#d4af37" }}>
                            {(parseInt(listPrice) - Math.max(1, Math.floor(parseInt(listPrice) * (feePercent / 100)))).toLocaleString()} Gold
                          </span>
                        </div>
                      </div>
                    )}

                    {listError && (
                      <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{listError}</p>
                    )}
                    <button
                      onClick={handleList}
                      disabled={!listItemId || !listPrice || parseInt(listPrice) < 1}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-500 text-black text-xs font-bold hover:from-yellow-500 hover:to-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
                    >
                      List for Sale
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
