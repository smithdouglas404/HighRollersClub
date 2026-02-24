import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles, Star, Crown, Wallet, Gift,
  Tag, Zap, Gem, Coins, Clock, Loader2, ArrowUpRight, ArrowDownRight,
  Package, Check, ShoppingCart, X, Shield, Heart
} from "lucide-react";

const TABS = ["Avatars", "Table Themes", "Emotes", "Premium", "Wishlist", "Inventory"];

const TAB_CATEGORY_MAP: Record<string, string> = {
  Avatars: "avatar",
  "Table Themes": "table_theme",
  Emotes: "emote",
  Premium: "premium",
};

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface InventoryEntry {
  id: string;
  userId: string;
  itemId: string;
  equippedAt: string | null;
  purchasedAt: string;
  item: ShopItem | null;
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

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  legendary: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  epic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  rare: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  uncommon: "text-green-400 bg-green-500/10 border-green-500/20",
  common: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  // Also support capitalized keys for backward compatibility
  Mythic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  Legendary: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Epic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  Rare: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

const RARITY_GRADIENTS: Record<string, string> = {
  mythic: "from-purple-600/40 via-pink-500/30 to-purple-800/40",
  legendary: "from-amber-500/40 via-orange-500/30 to-amber-700/40",
  epic: "from-purple-500/40 via-indigo-500/30 to-purple-700/40",
  rare: "from-cyan-500/40 via-blue-500/30 to-cyan-700/40",
  uncommon: "from-green-500/40 via-emerald-500/30 to-green-700/40",
  common: "from-gray-500/40 via-slate-500/30 to-gray-700/40",
};

function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] || RARITY_COLORS[rarity.toLowerCase()] || RARITY_COLORS.common;
}

function getRarityGradient(rarity: string): string {
  return RARITY_GRADIENTS[rarity.toLowerCase()] || RARITY_GRADIENTS.common;
}

function ItemImage({ item, className = "" }: { item: ShopItem; className?: string }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`w-full h-full bg-gradient-to-br ${getRarityGradient(item.rarity)} flex items-center justify-center ${className}`}>
      <Gem className="w-8 h-8 text-white/30" />
    </div>
  );
}

function PurchaseModal({
  item,
  balance,
  onConfirm,
  onClose,
  purchasing,
}: {
  item: ShopItem;
  balance: number;
  onConfirm: () => void;
  onClose: () => void;
  purchasing: boolean;
}) {
  const canAfford = balance >= item.price;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-2xl border border-white/10 overflow-hidden w-full max-w-md mx-4"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Item Preview */}
        <div className="aspect-video relative overflow-hidden">
          <ItemImage item={item} className="group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border mb-2 ${getRarityColor(item.rarity)}`}>
              {item.rarity}
            </div>
            <h3 className="text-xl font-black text-white">{item.name}</h3>
            {item.description && (
              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
            )}
          </div>
        </div>

        {/* Purchase Details */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Price</div>
              <div className="text-lg font-black text-amber-400 flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                {item.price.toLocaleString()} {item.currency}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Your Balance</div>
              <div className={`text-lg font-black ${canAfford ? "text-green-400" : "text-red-400"}`}>
                {balance.toLocaleString()}
              </div>
            </div>
          </div>

          {!canAfford && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
              Insufficient chips. You need {(item.price - balance).toLocaleString()} more.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              Cancel
            </button>
            <motion.button
              whileHover={canAfford ? { scale: 1.02 } : {}}
              whileTap={canAfford ? { scale: 0.98 } : {}}
              onClick={onConfirm}
              disabled={!canAfford || purchasing}
              className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: canAfford
                  ? "linear-gradient(135deg, #00ff9d, #00d4aa)"
                  : "linear-gradient(135deg, #666, #555)",
                boxShadow: canAfford ? "0 0 20px rgba(0,255,157,0.2)" : "none",
              }}
            >
              {purchasing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShoppingCart className="w-3.5 h-3.5" />
              )}
              {purchasing ? "Processing..." : "Confirm Purchase"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SuccessToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 glass rounded-xl border border-green-500/20 px-5 py-3 flex items-center gap-3"
      style={{ boxShadow: "0 10px 40px rgba(0,255,157,0.15)" }}
    >
      <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center">
        <Check className="w-4 h-4 text-green-400" />
      </div>
      <span className="text-sm font-bold text-green-400">{message}</span>
    </motion.div>
  );
}

function ShopItemCard({
  item,
  onPurchase,
  owned,
  wishlisted,
  onToggleWishlist,
}: {
  item: ShopItem;
  onPurchase: (item: ShopItem) => void;
  owned: boolean;
  wishlisted?: boolean;
  onToggleWishlist?: (itemId: string) => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      className="glass rounded-xl overflow-hidden border border-white/5 hover:border-amber-500/20 transition-all cursor-pointer group"
      style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}
      onClick={() => !owned && onPurchase(item)}
    >
      <div className="aspect-square relative overflow-hidden">
        <ItemImage item={item} className="group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getRarityColor(item.rarity)}`}>
          {item.rarity}
        </div>
        {owned && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border bg-green-500/15 border-green-500/30 text-green-400">
            Owned
          </div>
        )}
        {/* Wishlist heart button */}
        {onToggleWishlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(item.id);
            }}
            className={`absolute ${owned ? "top-8 right-2 mt-1" : "top-2 right-2"} w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              wishlisted
                ? "bg-pink-500/20 border border-pink-500/40 hover:bg-pink-500/30"
                : "bg-black/40 border border-white/10 hover:bg-white/10 opacity-0 group-hover:opacity-100"
            } ${wishlisted ? "opacity-100" : ""}`}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                wishlisted ? "text-pink-400 fill-pink-400" : "text-white/60"
              }`}
            />
          </button>
        )}
      </div>
      <div className="p-3">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{item.category.replace("_", " ")}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        {item.description && (
          <div className="text-[9px] text-gray-600 truncate mt-0.5">{item.description}</div>
        )}
        <div className="flex items-center justify-between mt-2">
          {owned ? (
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
              <Check className="w-3 h-3" /> Purchased
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Coins className="w-3 h-3" /> {item.price.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InventoryItemCard({
  entry,
  onEquip,
  equipping,
}: {
  entry: InventoryEntry;
  onEquip: (inventoryId: string) => void;
  equipping: string | null;
}) {
  const item = entry.item;
  if (!item) return null;

  const isEquipped = !!entry.equippedAt;
  const isEquipping = equipping === entry.id;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass rounded-xl overflow-hidden border transition-all ${
        isEquipped ? "border-cyan-500/30" : "border-white/5 hover:border-white/10"
      }`}
      style={{ boxShadow: isEquipped ? "0 0 25px rgba(0,200,255,0.08)" : "0 10px 40px rgba(0,0,0,0.3)" }}
    >
      <div className="aspect-square relative overflow-hidden">
        <ItemImage item={item} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getRarityColor(item.rarity)}`}>
          {item.rarity}
        </div>
        {isEquipped && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Equipped
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{item.category.replace("_", " ")}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        <div className="text-[9px] text-gray-600 mt-0.5">
          Purchased {new Date(entry.purchasedAt).toLocaleDateString()}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onEquip(entry.id)}
          disabled={isEquipped || isEquipping}
          className={`w-full mt-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
            isEquipped
              ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 cursor-default"
              : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {isEquipping ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isEquipped ? (
            <>
              <Check className="w-3 h-3" /> Equipped
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" /> Equip
            </>
          )}
        </motion.button>
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

  // Shop state
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Wishlist state (localStorage-backed)
  const [wishlist, setWishlist] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("poker-wishlist");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleWishlist = useCallback((itemId: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      localStorage.setItem("poker-wishlist", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  // Fetch shop items
  const fetchShopItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/shop/items");
      if (res.ok) {
        const data = await res.json();
        setShopItems(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    fetchShopItems();
  }, [fetchShopItems]);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/shop/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Refresh balance helper
  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        if (data?.balance != null) setBalance(data.balance);
      }
    } catch {
      // silent
    }
  }, []);

  // Refresh transactions helper
  const refreshTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch {
      // silent
    }
  }, []);

  // Purchase handler
  const handlePurchase = async () => {
    if (!selectedItem || purchasing) return;
    setPurchasing(true);
    try {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id }),
      });
      if (res.ok) {
        showToast(`Successfully purchased ${selectedItem.name}!`);
        setSelectedItem(null);
        await Promise.all([refreshBalance(), refreshUser(), fetchInventory(), refreshTransactions()]);
      } else {
        const err = await res.json().catch(() => ({ message: "Purchase failed" }));
        showToast(err.message || "Purchase failed");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  // Equip handler
  const handleEquip = async (inventoryId: string) => {
    setEquipping(inventoryId);
    try {
      const res = await fetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      if (res.ok) {
        showToast("Item equipped!");
        await fetchInventory();
      } else {
        const err = await res.json().catch(() => ({ message: "Equip failed" }));
        showToast(err.message || "Equip failed");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setEquipping(null);
    }
  };

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
        await refreshTransactions();
        setTimeout(() => setClaimResult(null), 3000);
      }
    } catch {} finally {
      setClaiming(false);
    }
  };

  const displayBalance = balance ?? user?.chipBalance ?? 0;

  // Owned item IDs for quick lookup
  const ownedItemIds = new Set(inventory.map((inv) => inv.itemId));

  // Filter items by active tab category
  const activeCategory = TAB_CATEGORY_MAP[activeTab];
  const isWishlistTab = activeTab === "Wishlist";
  const isInventoryTab = activeTab === "Inventory";

  const filteredItems = isWishlistTab
    ? shopItems.filter((item) => wishlist.has(item.id))
    : activeCategory
      ? shopItems.filter((item) => item.category === activeCategory)
      : shopItems;

  // New Arrivals: items created within the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newArrivals = filteredItems.filter(
    (item) => new Date(item.createdAt).getTime() >= sevenDaysAgo
  );
  // For the "All Items" grid, exclude items already shown in Featured or New Arrivals
  const featuredCount = filteredItems.length >= 3 ? 3 : 0;
  const newArrivalIds = new Set(newArrivals.map((item) => item.id));
  const featuredIds = new Set(filteredItems.slice(0, featuredCount).map((item) => item.id));
  const remainingItems = filteredItems.filter(
    (item) => !featuredIds.has(item.id) && !newArrivalIds.has(item.id)
  );

  return (
    <DashboardLayout>
      <div className="px-8 pb-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white/[0.02] rounded-lg p-1 w-fit border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {tab === "Inventory" && <Package className="w-3.5 h-3.5" />}
              {tab === "Wishlist" && <Heart className={`w-3.5 h-3.5 ${activeTab === "Wishlist" ? "fill-pink-400 text-pink-400" : ""}`} />}
              {tab}
              {tab === "Wishlist" && wishlist.size > 0 && (
                <span className="ml-1 text-[9px] bg-pink-500/15 text-pink-400 px-1.5 py-0.5 rounded-full">
                  {wishlist.size}
                </span>
              )}
              {tab === "Inventory" && inventory.length > 0 && (
                <span className="ml-1 text-[9px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded-full">
                  {inventory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                {isInventoryTab ? (
                  <>
                    <Package className="w-5 h-5 text-cyan-400" />
                    Your Collection
                  </>
                ) : isWishlistTab ? (
                  <>
                    <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
                    Your Wishlist
                  </>
                ) : (
                  <>
                    <Gem className="w-5 h-5 text-purple-400" />
                    Ultra-Rare Customization Marketplace
                  </>
                )}
              </h2>
              {!isInventoryTab && (
                <p className="text-xs text-gray-600 mt-1">
                  {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} {isWishlistTab ? "wishlisted" : "available"}
                </p>
              )}
            </div>

            {/* Inventory Tab */}
            {isInventoryTab && (
              <>
                {loadingInventory ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                ) : inventory.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl border border-white/5 py-16 text-center"
                  >
                    <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">Your inventory is empty</p>
                    <p className="text-xs text-gray-600 mt-1">Purchase items from the shop to see them here.</p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab("Avatars")}
                      className="mt-4 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black"
                      style={{
                        background: "linear-gradient(135deg, #00ff9d, #00d4aa)",
                        boxShadow: "0 0 20px rgba(0,255,157,0.15)",
                      }}
                    >
                      Browse Shop
                    </motion.button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {inventory.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <InventoryItemCard
                          entry={entry}
                          onEquip={handleEquip}
                          equipping={equipping}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Shop / Wishlist Items Grid */}
            {!isInventoryTab && (
              <>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl border border-white/5 py-16 text-center"
                  >
                    {isWishlistTab ? (
                      <>
                        <Heart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">Your wishlist is empty</p>
                        <p className="text-xs text-gray-600 mt-1">Browse the shop and tap the heart icon to save items you love.</p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveTab("Avatars")}
                          className="mt-4 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black"
                          style={{
                            background: "linear-gradient(135deg, #ec4899, #f472b6)",
                            boxShadow: "0 0 20px rgba(236,72,153,0.15)",
                          }}
                        >
                          Browse Shop
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <Tag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">No items available yet</p>
                        <p className="text-xs text-gray-600 mt-1">Check back soon for new {activeTab.toLowerCase()}!</p>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Featured (first 3 items) - only on category tabs */}
                    {!isWishlistTab && filteredItems.length >= 3 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          Featured
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          {filteredItems.slice(0, 3).map((item, i) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                            >
                              <ShopItemCard
                                item={item}
                                onPurchase={setSelectedItem}
                                owned={ownedItemIds.has(item.id)}
                                wishlisted={wishlist.has(item.id)}
                                onToggleWishlist={toggleWishlist}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Arrivals - items from last 7 days, shown between Featured and All Items */}
                    {!isWishlistTab && newArrivals.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-green-400" />
                          New Arrivals
                          <span className="text-[9px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">
                            Last 7 days
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {newArrivals.map((item, i) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 + i * 0.05 }}
                            >
                              <ShopItemCard
                                item={item}
                                onPurchase={setSelectedItem}
                                owned={ownedItemIds.has(item.id)}
                                wishlisted={wishlist.has(item.id)}
                                onToggleWishlist={toggleWishlist}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Items (or Wishlist items) */}
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                        {isWishlistTab ? (
                          <>
                            <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
                            Saved Items
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            {filteredItems.length >= 3 ? "All Items" : activeTab}
                          </>
                        )}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {(isWishlistTab ? filteredItems : remainingItems).map((item, i) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + i * 0.05 }}
                          >
                            <ShopItemCard
                              item={item}
                              onPurchase={setSelectedItem}
                              owned={ownedItemIds.has(item.id)}
                              wishlisted={wishlist.has(item.id)}
                              onToggleWishlist={toggleWishlist}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

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

          {/* Right Sidebar */}
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

            {/* Limited Time Offer — Elite Player's Pass */}
            {(() => {
              const elitePass = shopItems.find(
                (item) => item.name.includes("Elite Player") && item.name.includes("Pass")
              );
              const eliteOwned = elitePass ? ownedItemIds.has(elitePass.id) : false;
              return (
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
                      <span className="text-amber-400/60 font-bold uppercase flex items-center gap-1">
                        <Coins className="w-3 h-3" /> 5,000 Chips
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {[Star, Crown, Zap].map((Icon, i) => (
                        <div key={i} className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                          <Icon className="w-3 h-3 text-amber-400" />
                        </div>
                      ))}
                    </div>
                    {eliteOwned ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-green-400 flex items-center justify-center gap-1.5"
                        style={{
                          background: "linear-gradient(135deg, rgba(0,255,157,0.1), rgba(0,212,170,0.1))",
                          border: "1px solid rgba(0,255,157,0.2)",
                        }}
                      >
                        <Check className="w-3.5 h-3.5" /> Purchased
                      </button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => elitePass && setSelectedItem(elitePass)}
                        disabled={!elitePass}
                        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{
                          background: "linear-gradient(135deg, #c9a84c, #e8c566)",
                          boxShadow: "0 0 20px rgba(201,168,76,0.2)",
                        }}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Buy Now — 5,000 Chips
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })()}

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

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {selectedItem && (
          <PurchaseModal
            item={selectedItem}
            balance={displayBalance}
            onConfirm={handlePurchase}
            onClose={() => !purchasing && setSelectedItem(null)}
            purchasing={purchasing}
          />
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {toast && <SuccessToast message={toast} />}
      </AnimatePresence>
    </DashboardLayout>
  );
}
