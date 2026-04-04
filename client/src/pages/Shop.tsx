import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { useWallet, type Transaction } from "@/lib/wallet-context";
import {
  Sparkles, Star, Crown, Wallet, Gift,
  Tag, Zap, Gem, Coins, Clock, Loader2, ArrowUpRight, ArrowDownRight,
  Package, Check, ShoppingCart, X, Shield, Heart
} from "lucide-react";
import chipPile from "@assets/generated_images/chip_stack_gold_pile.webp";

const TABS = ["Avatars", "Table Themes", "Frames", "Emotes", "Taunts", "Premium", "Wishlist", "Inventory"];

const TAB_CATEGORY_MAP: Record<string, string> = {
  Avatars: "avatar",
  "Table Themes": "table_theme",
  Frames: "frame",
  Emotes: "emote",
  Taunts: "taunt",
  Premium: "premium",
};

const FRAME_IMAGES: Record<string, string> = {
  bronze: "/frames/frame_bronze.webp",
  silver: "/frames/frame_silver.webp",
  gold: "/frames/frame_gold.webp",
  platinum: "/frames/frame_platinum.webp",
  diamond: "/frames/frame_diamond.webp",
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

const RARITY_COLORS: Record<string, string> = {
  mythic: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  legendary: "text-primary bg-amber-500/10 border-amber-500/20",
  epic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  rare: "text-primary bg-amber-500/10 border-amber-500/20",
  uncommon: "text-green-400 bg-green-500/10 border-green-500/20",
  common: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  // Also support capitalized keys for backward compatibility
  Mythic: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  Legendary: "text-primary bg-amber-500/10 border-amber-500/20",
  Epic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  Rare: "text-primary bg-amber-500/10 border-amber-500/20",
};

const RARITY_GRADIENTS: Record<string, string> = {
  mythic: "from-fuchsia-600/40 via-pink-500/30 to-fuchsia-800/40",
  legendary: "from-amber-500/40 via-orange-500/30 to-amber-700/40",
  epic: "from-purple-500/40 via-indigo-500/30 to-purple-700/40",
  rare: "from-amber-500/40 via-blue-500/30 to-amber-700/40",
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
  // For frame items, show frame image overlaid around an avatar silhouette
  if (item.category === "frame") {
    const frameKey = item.name.toLowerCase().replace(/\s+/g, "_").replace("frame_", "").replace("_frame", "");
    const frameUrl = item.imageUrl || FRAME_IMAGES[frameKey] || Object.values(FRAME_IMAGES).find(u => u.includes(frameKey));
    return (
      <div className={`w-full h-full bg-gradient-to-br ${getRarityGradient(item.rarity)} flex items-center justify-center relative ${className}`}>
        {/* Avatar placeholder */}
        <div className="w-16 h-16 rounded-full bg-white/10 border border-white/5 flex items-center justify-center">
          <Shield className="w-7 h-7 text-white/20" />
        </div>
        {/* Frame overlay */}
        {frameUrl && (
          <img
            src={frameUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
        )}
      </div>
    );
  }
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
            <div className={`inline-block px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider border mb-2 ${getRarityColor(item.rarity)}`}>
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
              <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider">Price</div>
              <div className="text-lg font-black flex items-center gap-1.5" style={{ color: "#d4af37" }}>
                <Coins className="w-4 h-4" />
                {item.price.toLocaleString()} {item.currency}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider">Your Balance</div>
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
              className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 border border-white/10 hover:border-white/15 hover:text-white transition-all"
            >
              Cancel
            </button>
            <motion.button
              whileHover={canAfford ? { scale: 1.02 } : {}}
              whileTap={canAfford ? { scale: 0.98 } : {}}
              onClick={onConfirm}
              disabled={!canAfford || purchasing}
              aria-label={`Purchase ${item.name}`}
              className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-gold ${
                canAfford ? "text-black" : "bg-gray-600 text-gray-300"
              }`}
              style={canAfford ? { background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)" } : undefined}
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
    >
      <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center">
        <Check className="w-4 h-4 text-green-400" />
      </div>
      <span className="text-sm font-bold text-green-400">{message}</span>
    </motion.div>
  );
}

function PurchaseSuccessOverlay({
  item,
  onViewInventory,
  onContinue,
}: {
  item: ShopItem;
  onViewInventory: () => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onContinue}
    >
      {/* Gold sparkle particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            opacity: 0,
            scale: 0,
            x: 0,
            y: 0,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
          }}
          transition={{
            duration: 2,
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "45%",
            width: `${4 + Math.random() * 6}px`,
            height: `${4 + Math.random() * 6}px`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            background: `linear-gradient(135deg, #f3e2ad, #d4af37)`,
            boxShadow: "0 0 6px rgba(212,175,55,0.6)",
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative glass rounded-2xl border overflow-hidden w-full max-w-sm mx-4 text-center"
        style={{
          borderColor: "rgba(201,168,76,0.3)",
          boxShadow: "0 0 40px rgba(212,175,55,0.15), 0 0 80px rgba(212,175,55,0.05)",
        }}
      >
        {/* Glow bar at top */}
        <div
          className="h-1"
          style={{
            background: "linear-gradient(90deg, transparent, #d4af37, #f3e2ad, #d4af37, transparent)",
          }}
        />

        <div className="p-6 space-y-4">
          {/* Animated check icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2, damping: 12, stiffness: 200 }}
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(243,226,173,0.1))",
              border: "2px solid rgba(212,175,55,0.4)",
              boxShadow: "0 0 20px rgba(212,175,55,0.2)",
            }}
          >
            <Check className="w-8 h-8 text-[#d4af37]" />
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-black uppercase tracking-wider"
            style={{
              background: "linear-gradient(135deg, #f3e2ad 0%, #d4af37 50%, #f3e2ad 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Purchase Successful!
          </motion.h2>

          {/* Item name */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider mb-0.5">You acquired</div>
            <div className="text-base font-bold text-white">{item.name}</div>
            <div className={`inline-block px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider border mt-1.5 ${getRarityColor(item.rarity)}`}>
              {item.rarity}
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3 pt-2"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onViewInventory}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black"
              style={{
                background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)",
              }}
            >
              View Inventory
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onContinue}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              Continue Shopping
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
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
      className="rounded-xl overflow-hidden transition-all cursor-pointer group card-hover"
      style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
      onClick={() => !owned && onPurchase(item)}
      role="button"
      aria-label={owned ? `${item.name} - owned` : `Purchase ${item.name}`}
    >
      <div className="aspect-square relative overflow-hidden">
        <ItemImage item={item} className="group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider border ${getRarityColor(item.rarity)}`}>
          {item.rarity}
        </div>
        {owned && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider border bg-green-500/15 border-green-500/30 text-green-400">
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
        <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{item.category.replace("_", " ")}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        {item.description && (
          <div className="text-[0.5625rem] text-gray-600 truncate mt-0.5">{item.description}</div>
        )}
        <div className="flex items-center justify-between mt-2">
          {owned ? (
            <span className="text-[0.625rem] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
              <Check className="w-3 h-3" /> Purchased
            </span>
          ) : (
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#d4af37" }}>
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
      className={`rounded-xl overflow-hidden transition-all ${
        isEquipped ? "" : ""
      }`}
      style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: isEquipped ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(212,175,55,0.12)" }}
    >
      <div className="aspect-square relative overflow-hidden">
        <ItemImage item={item} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider border ${getRarityColor(item.rarity)}`}>
          {item.rarity}
        </div>
        {isEquipped && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider bg-primary/15 border border-primary/30 text-primary flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Equipped
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider">{item.category.replace("_", " ")}</div>
        <div className="text-sm font-bold text-white truncate">{item.name}</div>
        <div className="text-[0.5625rem] text-gray-600 mt-0.5">
          Purchased {new Date(entry.purchasedAt).toLocaleDateString()}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onEquip(entry.id)}
          disabled={isEquipped || isEquipping}
          className={`w-full mt-2 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
            isEquipped
              ? "bg-primary/10 border border-primary/20 text-primary cursor-default"
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
  const [, navigate] = useLocation();
  const [claimResult, setClaimResult] = useState<{ bonus: number } | null>(null);

  const {
    balance, canClaim, claiming, timeLeft,
    claimDailyBonus, transactions, loadingTransactions: loadingTx,
    hasMore, loadMore, refreshTransactions, refreshBalance,
  } = useWallet();

  // Shop state
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ item: ShopItem } | null>(null);

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
        const purchasedItem = selectedItem;
        setSelectedItem(null);
        setPurchaseSuccess({ item: purchasedItem });
        setTimeout(() => setPurchaseSuccess(null), 3000);
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
    setClaimResult(null);
    const result = await claimDailyBonus();
    if (result.success) {
      setClaimResult({ bonus: result.bonus! });
      await refreshUser();
      setTimeout(() => setClaimResult(null), 3000);
    } else {
      showToast("Daily bonus already claimed — check the timer!");
    }
  };

  const displayBalance = balance;

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
      <PageBackground image="/images/generated/avatar-marketplace-bg.png" />
      <div className="px-8 pb-8 relative z-10">
        {/* Shop banner with chip pile accent */}
        <div className="relative mb-6 overflow-hidden rounded-xl glass border border-primary/10 p-5">
          <img
            src={chipPile}
            alt=""
            loading="lazy"
            className="absolute -right-4 -bottom-4 w-44 h-32 object-contain opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-lg font-black font-display tracking-[0.12em] uppercase flex items-center gap-2" style={{ background: "linear-gradient(135deg, #f3e2ad 0%, #d4af37 50%, #f3e2ad 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              <ShoppingCart className="w-5 h-5" style={{ color: "#d4af37" }} />
              Shop
            </h2>
            <p className="text-xs text-gray-400 mt-1">Premium avatars, table themes, emotes and more</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white/[0.02] rounded-lg p-1 w-fit border border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border border-transparent"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
              style={activeTab === tab ? { background: "rgba(212,175,55,0.15)", color: "#d4af37", borderColor: "rgba(212,175,55,0.25)" } : undefined}
            >
              {tab === "Inventory" && <Package className="w-3.5 h-3.5" />}
              {tab === "Wishlist" && <Heart className={`w-3.5 h-3.5 ${activeTab === "Wishlist" ? "fill-pink-400 text-pink-400" : ""}`} />}
              {tab}
              {tab === "Wishlist" && wishlist.size > 0 && (
                <span className="ml-1 text-[0.5625rem] bg-pink-500/15 text-pink-400 px-1.5 py-0.5 rounded-full">
                  {wishlist.size}
                </span>
              )}
              {tab === "Inventory" && inventory.length > 0 && (
                <span className="ml-1 text-[0.5625rem] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
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
              <h2 className="text-lg font-black font-display uppercase tracking-wider text-white flex items-center gap-2">
                {isInventoryTab ? (
                  <>
                    <Package className="w-5 h-5 text-primary" />
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
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-muted-foreground tracking-wider uppercase">Loading inventory...</p>
                  </div>
                ) : inventory.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                      <Package className="w-7 h-7 text-primary/40" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Items Yet</h3>
                    <p className="text-xs text-muted-foreground/60 max-w-xs">Purchase items from the shop to see them here.</p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab("Avatars")}
                      className="mt-4 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-primary text-black"
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
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary/40 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-muted-foreground tracking-wider uppercase">Loading shop...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    {isWishlistTab ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                          <Heart className="w-7 h-7 text-primary/40" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Wishlist Items Yet</h3>
                        <p className="text-xs text-muted-foreground/60 max-w-xs">Browse the shop and tap the heart icon to save items you love.</p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveTab("Avatars")}
                          className="mt-4 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-pink-500 text-black"
                        >
                          Browse Shop
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                          <Package className="w-7 h-7 text-primary/40" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Items Yet</h3>
                        <p className="text-xs text-muted-foreground/60 max-w-xs">Check back soon for new {activeTab.toLowerCase()}!</p>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Featured (first 3 items) - only on category tabs */}
                    {!isWishlistTab && filteredItems.length >= 3 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          Featured
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          <span className="text-[0.5625rem] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">
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
                            <Sparkles className="w-4 h-4 text-primary" />
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
                <span className="text-[0.5625rem] text-gray-600">{transactions.length} transactions</span>
              </div>
              {loadingTx ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-[0.6875rem] text-gray-600">No transactions yet. Claim your daily bonus to get started!</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-white/[0.03]">
                    {transactions.map((tx) => (
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
                          <div className="text-[0.5625rem] text-gray-600">{tx.description || tx.type}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                          </div>
                          <div className="text-[0.5625rem] text-gray-600">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <button
                      onClick={loadMore}
                      className="w-full py-2.5 text-[0.625rem] font-bold uppercase tracking-wider text-primary hover:text-white transition-colors border-t border-white/[0.03]"
                    >
                      Load More
                    </button>
                  )}
                </>
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
              className="glass rounded-xl p-4 border border-primary/15"
            >
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-primary" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Your Balance</span>
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: "#d4af37" }}>
                {displayBalance.toLocaleString()}
              </div>
              <div className="text-[0.5625rem] text-gray-600 uppercase">chips</div>
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
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-green-400">Daily Bonus</span>
                </div>
                <p className="text-[0.625rem] text-gray-500 mb-3">
                  {!canClaim
                    ? "Come back when the timer expires!"
                    : "Claim your free chips every 24 hours!"}
                </p>
                {!canClaim && timeLeft && (
                  <div className="flex items-center justify-center gap-2 mb-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-mono font-bold text-primary tabular-nums">{timeLeft}</span>
                  </div>
                )}
                <motion.button
                  whileHover={canClaim ? { scale: 1.02 } : {}}
                  whileTap={canClaim ? { scale: 0.98 } : {}}
                  onClick={handleClaimDaily}
                  disabled={claiming || !canClaim}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 ${
                    !canClaim ? "bg-white/[0.05] text-gray-400" : "text-black btn-gold"
                  }`}
                  style={canClaim ? { background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)" } : undefined}
                >
                  {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                  {!canClaim ? "Already Claimed" : "Claim Daily Bonus"}
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
                (item) => item.category === "premium" && item.rarity === "legendary"
              );
              const eliteOwned = elitePass ? ownedItemIds.has(elitePass.id) : false;
              return (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass rounded-xl p-4 border border-primary/15 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 blur-3xl rounded-full" />
                  <div className="relative">
                    <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-primary mb-1">
                      Limited-Time Offer:
                    </div>
                    <div className="text-sm font-black text-white uppercase tracking-wider mb-1">
                      Elite Player's Pass
                    </div>
                    <div className="text-[0.5625rem] text-gray-600 mb-3">
                      <span className="text-primary/60 font-bold uppercase flex items-center gap-1">
                        <Coins className="w-3 h-3" /> {elitePass?.price.toLocaleString() ?? "5,000"} Chips
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {[Star, Crown, Zap].map((Icon, i) => (
                        <div key={i} className="w-6 h-6 rounded bg-primary/10 border border-primary/15 flex items-center justify-center">
                          <Icon className="w-3 h-3 text-primary" />
                        </div>
                      ))}
                    </div>
                    {eliteOwned ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-green-400 flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/20"
                      >
                        <Check className="w-3.5 h-3.5" /> Purchased
                      </button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => elitePass && setSelectedItem(elitePass)}
                        disabled={!elitePass}
                        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50 flex items-center justify-center gap-1.5 btn-gold"
                        style={{ background: "linear-gradient(135deg, #9a7b2c 0%, #d4af37 50%, #f3e2ad 100%)" }}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Buy Now — {elitePass?.price.toLocaleString() ?? "5,000"} Chips
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {/* Wallet Actions */}
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 glass rounded-lg py-2.5 text-[0.625rem] font-bold uppercase tracking-wider text-gray-500 border border-white/5 opacity-50 cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-3 h-3" />
                Deposit (Soon)
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

      {/* Purchase Success Overlay */}
      <AnimatePresence>
        {purchaseSuccess && (
          <PurchaseSuccessOverlay
            item={purchaseSuccess.item}
            onViewInventory={() => {
              setPurchaseSuccess(null);
              setActiveTab("Inventory");
            }}
            onContinue={() => setPurchaseSuccess(null)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
