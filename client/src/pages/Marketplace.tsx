import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ShoppingBag, Filter, ArrowUpDown, Plus, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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

const FILTER_PILLS = ["All", "avatar", "table_theme", "emote"] as const;
const SORT_OPTIONS = ["Newest", "Price Low", "Price High", "Rarity"] as const;
const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400 border-gray-500/30",
  uncommon: "text-green-400 border-green-500/30",
  rare: "text-blue-400 border-blue-500/30",
  epic: "text-purple-400 border-purple-500/30",
  legendary: "text-yellow-400 border-yellow-500/30",
};

export default function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [items, setItems] = useState<Map<string, ShopItem>>(new Map());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [sort, setSort] = useState<string>("Newest");
  const [listModal, setListModal] = useState(false);
  const [listItemId, setListItemId] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [confirmBuy, setConfirmBuy] = useState<Listing | null>(null);

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
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  let filtered = listings;
  if (filter !== "All") {
    filtered = filtered.filter(l => {
      const item = items.get(l.itemId);
      return item?.category === filter;
    });
  }

  filtered = [...filtered].sort((a, b) => {
    if (sort === "Newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "Price Low") return a.price - b.price;
    if (sort === "Price High") return b.price - a.price;
    if (sort === "Rarity") {
      const ra = RARITY_ORDER[items.get(a.itemId)?.rarity ?? "common"] ?? 0;
      const rb = RARITY_ORDER[items.get(b.itemId)?.rarity ?? "common"] ?? 0;
      return rb - ra;
    }
    return 0;
  });

  const handleList = async () => {
    if (!listItemId || !listPrice) return;
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

  const handleBuy = async (listing: Listing) => {
    try {
      const res = await fetch(`/api/marketplace/${listing.id}/buy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Purchase failed" }));
        alert(data.message || "Purchase failed");
        return;
      }
    } catch {
      alert("Network error — purchase failed");
      return;
    }
    setConfirmBuy(null);
    fetchData();
  };

  return (
    <DashboardLayout title="Marketplace">
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Avatar Marketplace</h2>
              <p className="text-xs text-gray-400">Buy and sell cosmetic items</p>
            </div>
          </div>
          <button
            onClick={() => setListModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
          >
            <Plus className="w-3 h-3" /> List Item
          </button>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-400" />
            {FILTER_PILLS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-[0.625rem] font-medium transition-colors ${
                  filter === f ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-high/50 text-gray-400 border border-white/[0.06] hover:text-white"
                }`}
              >
                {f === "All" ? "All" : f === "table_theme" ? "Frames" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <ArrowUpDown className="w-3 h-3 text-gray-400" />
            {SORT_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-2 py-1 rounded text-[0.625rem] font-medium transition-colors ${
                  sort === s ? "text-primary" : "text-gray-500 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">No listings found</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(listing => {
              const item = items.get(listing.itemId);
              const rarityClass = RARITY_COLORS[item?.rarity ?? "common"] ?? RARITY_COLORS.common;
              return (
                <div key={listing.id} className="rounded-xl bg-surface-high/50 border border-white/[0.06] overflow-hidden hover:border-primary/20 transition-colors">
                  <div className="aspect-square bg-surface-low/50 flex items-center justify-center p-4">
                    {item?.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <ShoppingBag className="w-12 h-12 text-gray-600" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="text-xs font-bold text-white truncate">{item?.name ?? "Unknown Item"}</div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[0.5rem] uppercase font-bold ${rarityClass}`}>
                        {item?.rarity ?? "common"}
                      </span>
                      <span className="text-[0.5rem] text-gray-500">{item?.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold" style={{ color: "#d4af37" }}>
                        {listing.price.toLocaleString()}
                      </span>
                      {listing.sellerId !== user?.id ? (
                        <button
                          onClick={() => setConfirmBuy(listing)}
                          className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-[0.625rem] font-medium hover:bg-primary/30 transition-colors"
                        >
                          Buy
                        </button>
                      ) : (
                        <span className="text-[0.625rem] text-gray-500">Your listing</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List Item Modal */}
        {listModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setListModal(false)}>
            <div className="bg-surface-high rounded-2xl border border-white/[0.1] p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">List an Item</h3>
                <button onClick={() => setListModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div>
                <label className="text-[0.625rem] text-gray-400 uppercase tracking-wider mb-1 block">Select Item</label>
                <select
                  value={listItemId}
                  onChange={e => setListItemId(e.target.value)}
                  className="w-full rounded-lg bg-surface-low border border-white/[0.06] text-white text-xs p-2"
                >
                  <option value="">Choose an item...</option>
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
                <label className="text-[0.625rem] text-gray-400 uppercase tracking-wider mb-1 block">Price (chips)</label>
                <input
                  type="number"
                  value={listPrice}
                  onChange={e => setListPrice(e.target.value)}
                  min="1"
                  className="w-full rounded-lg bg-surface-low border border-white/[0.06] text-white text-xs p-2"
                  placeholder="Enter price..."
                />
              </div>
              {listPrice && parseInt(listPrice) > 0 && (
                <div className="text-[0.625rem] text-gray-400 space-y-1">
                  <div className="flex justify-between"><span>Listing Price</span><span>{parseInt(listPrice).toLocaleString()} chips</span></div>
                  <div className="flex justify-between"><span>Platform Fee (10%)</span><span className="text-red-400">-{Math.floor(parseInt(listPrice) * 0.1).toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-white"><span>You Receive</span><span style={{ color: "#d4af37" }}>{(parseInt(listPrice) - Math.floor(parseInt(listPrice) * 0.1)).toLocaleString()}</span></div>
                </div>
              )}
              <button
                onClick={handleList}
                disabled={!listItemId || !listPrice || parseInt(listPrice) < 1}
                className="w-full py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                List for Sale
              </button>
            </div>
          </div>
        )}

        {/* Buy Confirmation Modal */}
        {confirmBuy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmBuy(null)}>
            <div className="bg-surface-high rounded-2xl border border-white/[0.1] p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-white">Confirm Purchase</h3>
              <div className="text-[0.625rem] text-gray-400 space-y-1">
                <div className="flex justify-between"><span>Item</span><span className="text-white">{items.get(confirmBuy.itemId)?.name}</span></div>
                <div className="flex justify-between"><span>Price</span><span style={{ color: "#d4af37" }}>{confirmBuy.price.toLocaleString()} chips</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmBuy(null)} className="flex-1 py-2 rounded-lg bg-surface-low border border-white/[0.06] text-gray-400 text-xs">Cancel</button>
                <button onClick={() => handleBuy(confirmBuy)} className="flex-1 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-bold">Buy Now</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
