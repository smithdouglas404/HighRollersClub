import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AVATAR_OPTIONS, type AvatarOption } from "@/components/poker/AvatarSelect";
import { useAuth } from "@/lib/auth-context";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  User, Crown, Check, Save, ShoppingBag,
  Sparkles, Lock, ChevronRight, Shield, Sword,
  Star, Bookmark, Clock, Hand, Palette, Package,
  Layers, Zap, Eye
} from "lucide-react";

/* ── Tier styling ── */
const TIER_STYLES: Record<AvatarOption["tier"], { border: string; text: string; bg: string; glow: string; label: string }> = {
  legendary: { border: "border-amber-500/40", text: "text-amber-400", bg: "bg-amber-500/10", glow: "rgba(212,175,55,0.35)", label: "Legendary" },
  epic:      { border: "border-purple-500/40", text: "text-purple-400", bg: "bg-purple-500/10", glow: "rgba(168,85,247,0.3)", label: "Epic" },
  rare:      { border: "border-blue-500/40", text: "text-blue-400", bg: "bg-blue-500/10", glow: "rgba(59,130,246,0.25)", label: "Rare" },
  common:    { border: "border-gray-500/30", text: "text-gray-400", bg: "bg-gray-500/10", glow: "rgba(148,163,184,0.15)", label: "Common" },
};

const TIER_ORDER: AvatarOption["tier"][] = ["legendary", "epic", "rare", "common"];

/* ── Sidebar tabs ── */
const SIDEBAR_TABS = [
  { id: "overview", label: "Club Overview", icon: Layers, href: "/dashboard" },
  { id: "wardrobe", label: "Wardrobe", icon: User, href: "/wardrobe" },
  { id: "inventory", label: "Inventory", icon: Package, href: "/marketplace" },
  { id: "dye-shop", label: "Dye Shop", icon: Palette, href: "/dye-shop" },
] as const;

/* ── Owned items data ── */
const OWNED_ITEMS = [
  { id: "tactical-vest", name: "Tactical Vest", slot: "Body", equipped: true, tier: "epic" as const },
  { id: "zero-glove", name: "Zero Glove", slot: "Hands", equipped: false, tier: "rare" as const },
  { id: "spartan-cuber-suit", name: "Spartan Cuber Suit", slot: "Body", equipped: false, tier: "legendary" as const },
  { id: "golden-liner-belt", name: "Golden Liner Belt", slot: "Waist", equipped: true, tier: "epic" as const },
  { id: "phantom-boots", name: "Phantom Boots", slot: "Feet", equipped: false, tier: "rare" as const },
  { id: "neon-visor", name: "Neon Visor", slot: "Head", equipped: true, tier: "legendary" as const },
  { id: "shadow-cloak", name: "Shadow Cloak", slot: "Back", equipped: false, tier: "epic" as const },
  { id: "circuit-gauntlet", name: "Circuit Gauntlet", slot: "Hands", equipped: false, tier: "rare" as const },
];

/* ── Avatar Card ── */
function AvatarCard({
  avatar,
  isSelected,
  isEquipped,
  onClick,
  index,
}: {
  avatar: AvatarOption;
  isSelected: boolean;
  isEquipped: boolean;
  onClick: () => void;
  index: number;
}) {
  const style = TIER_STYLES[avatar.tier];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 + index * 0.02 }}
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border transition-all hover:scale-[1.04] ${
        isSelected
          ? `${style.border} ring-2 ring-amber-400/30`
          : isEquipped
          ? `${style.border} bg-surface-highest/60`
          : "border-white/[0.06] bg-surface-high/40 hover:border-white/15"
      }`}
      style={{
        boxShadow: isSelected ? `0 0 24px ${style.glow}` : undefined,
      }}
    >
      {/* Avatar image */}
      <div className="aspect-[3/4] relative overflow-hidden">
        <img
          src={avatar.image}
          alt={avatar.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Legendary premium indicator */}
        {avatar.tier === "legendary" && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 z-10" />
        )}

        {/* 3D badge */}
        {avatar.fullBodyImage && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[0.4375rem] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
            3D
          </div>
        )}

        {/* Tier badge */}
        <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[0.4375rem] font-bold uppercase tracking-wider ${style.bg} ${style.text} border ${style.border} backdrop-blur-sm`}>
          {style.label}
        </div>

        {/* Equipped checkmark */}
        {isEquipped && (
          <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500/80 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Name */}
      <div className="px-2 py-2 text-center">
        <div className="text-[0.6875rem] font-bold text-white truncate">{avatar.name}</div>
      </div>
    </motion.button>
  );
}

/* ── Main Component ── */
export default function AvatarWardrobe() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [equippedId, setEquippedId] = useState<string>(user?.avatarId || AVATAR_OPTIONS[0].id);
  const [filterTier, setFilterTier] = useState<AvatarOption["tier"] | "all">("all");
  const [saved, setSaved] = useState(false);
  const [recentlyEquipped, setRecentlyEquipped] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recentlyEquipped") || "[]").slice(0, 4);
    } catch { return []; }
  });
  const [presetSaved, setPresetSaved] = useState(false);
  const [activeTab] = useState("wardrobe");

  // Equipment slots (visual placeholders)
  const equipmentSlots = [
    { name: "Head", icon: Crown, equipped: equippedId ? true : false },
    { name: "Body", icon: Shield, equipped: true },
    { name: "Hands", icon: Hand, equipped: false },
    { name: "Feet", icon: Sword, equipped: false },
  ];

  // Set initial equipped from user's current avatar
  useEffect(() => {
    if (user?.avatarId) {
      const match = AVATAR_OPTIONS.find(a => a.image === user.avatarId || a.id === user.avatarId);
      if (match) setEquippedId(match.id);
    }
  }, [user?.avatarId]);

  const selected = AVATAR_OPTIONS.find(a => a.id === selectedId);
  const equipped = AVATAR_OPTIONS.find(a => a.id === equippedId) || AVATAR_OPTIONS[0];

  // Calculated scores
  const equippedCount = equipmentSlots.filter(s => s.equipped).length;
  const armorRating = equippedCount * 25;
  const styleScore = Math.min(100, equippedCount * 20 + (equipped.tier === "legendary" ? 40 : equipped.tier === "epic" ? 25 : equipped.tier === "rare" ? 15 : 5));

  const filteredAvatars = filterTier === "all"
    ? AVATAR_OPTIONS
    : AVATAR_OPTIONS.filter(a => a.tier === filterTier);

  const handleEquip = () => {
    if (selectedId) {
      setEquippedId(selectedId);
      setSaved(false);
      setRecentlyEquipped(prev => {
        const updated = [selectedId, ...prev.filter(id => id !== selectedId)].slice(0, 4);
        localStorage.setItem("recentlyEquipped", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const handleSavePreset = () => {
    const preset = {
      avatarId: equippedId,
      equipmentSlots: equipmentSlots.map(s => ({ name: s.name, equipped: s.equipped })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("avatarPreset", JSON.stringify(preset));
    setPresetSaved(true);
    setTimeout(() => setPresetSaved(false), 2000);
  };

  const handleSave = async () => {
    try {
      await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: equipped.id }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent fail
    }
  };

  return (
    <DashboardLayout title="Avatar Wardrobe">
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left sidebar tabs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col w-56 shrink-0 border-r gold-border bg-black/20 p-4 space-y-1"
        >
          <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-bold mb-3 px-3">Navigation</div>
          {SIDEBAR_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <Link key={tab.id} href={tab.href}>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.75rem] font-semibold transition-all ${
                    isActive
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-gray-500"}`} />
                  {tab.label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              </Link>
            );
          })}

          {/* Quick stats in sidebar */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-3">
            <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-bold px-3">Quick Stats</div>
            <div className="px-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5"><Shield className="w-3 h-3 text-blue-400" /> Armor</span>
                <span className="text-[0.6875rem] font-black text-blue-400">{armorRating}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-purple-400" /> Style</span>
                <span className="text-[0.6875rem] font-black text-purple-400">{styleScore}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5"><Package className="w-3 h-3 text-green-400" /> Items</span>
                <span className="text-[0.6875rem] font-black text-green-400">{OWNED_ITEMS.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main content */}
        <div className="flex-1 px-4 md:px-8 pb-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between flex-wrap gap-4 pt-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-white tracking-tight">Avatar Wardrobe</h2>
                <p className="text-[0.625rem] text-muted-foreground">Choose and equip your avatar. Premium tiers have full-body 3D renders.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/avatar-customizer">
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-all">
                  <Zap className="w-3.5 h-3.5" />
                  AI Customizer
                </button>
              </Link>
              <Link href="/shop">
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-all">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Shop
                </button>
              </Link>
              <GoldButton onClick={handleSave} className="flex items-center gap-2 text-[0.625rem]">
                {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? "Saved!" : "Save"}
              </GoldButton>
            </div>
          </motion.div>

          {/* Top section: Full-body preview center + Owned items right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Full-body avatar preview (center panel) */}
            <GoldCard
              className="lg:col-span-1 flex flex-col items-center justify-center relative overflow-hidden"
              glow
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-purple-500/5 pointer-events-none" />

              <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-medium mb-3 relative z-10">Currently Equipped</div>
              <motion.div
                key={equippedId}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: [1, 1.02, 1], opacity: 1 }}
                transition={{ scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
                className="w-48 h-64 rounded-2xl overflow-hidden border-2 mb-4 relative z-10"
                style={{
                  borderColor: equipped.borderColor,
                  boxShadow: `0 0 40px ${equipped.glowColor}, 0 8px 32px rgba(0,0,0,0.5)`,
                }}
              >
                <img
                  src={equipped.fullBodyImage || equipped.image}
                  alt={equipped.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
              </motion.div>
              <div className="text-sm font-bold text-white relative z-10">{equipped.name}</div>
              <div className={`text-[0.625rem] font-bold uppercase tracking-wider mt-1 ${TIER_STYLES[equipped.tier].text} relative z-10`}>
                {TIER_STYLES[equipped.tier].label}
              </div>

              {/* Equipment slots under preview */}
              <div className="grid grid-cols-4 gap-2 mt-4 w-full relative z-10">
                {equipmentSlots.map((slot) => {
                  const SlotIcon = slot.icon;
                  return (
                    <div
                      key={slot.name}
                      className={`rounded-lg p-2 border text-center transition-all ${
                        slot.equipped
                          ? "gold-border bg-amber-500/10 shadow-[0_0_8px_rgba(212,175,55,0.15)]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <SlotIcon className={`w-4 h-4 mx-auto ${slot.equipped ? "text-amber-400" : "text-gray-600"}`} />
                      <div className="text-[0.5rem] font-bold text-white mt-1">{slot.name}</div>
                    </div>
                  );
                })}
              </div>
            </GoldCard>

            {/* Selected avatar detail / comparison */}
            <GoldCard className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col sm:flex-row gap-6 items-center"
                  >
                    {/* Large preview */}
                    <div
                      className="w-40 h-52 rounded-2xl overflow-hidden border-2 shrink-0 relative"
                      style={{
                        borderColor: selected.borderColor,
                        boxShadow: `0 0 30px ${selected.glowColor}`,
                      }}
                    >
                      <img
                        src={selected.fullBodyImage || selected.image}
                        alt={selected.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>

                    {/* Info + equip button */}
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-xl font-display font-bold text-white mb-1">{selected.name}</h3>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider ${TIER_STYLES[selected.tier].bg} ${TIER_STYLES[selected.tier].text} border ${TIER_STYLES[selected.tier].border} mb-4`}>
                        {selected.tier === "legendary" && <Crown className="w-3 h-3" />}
                        {selected.tier === "epic" && <Sparkles className="w-3 h-3" />}
                        {TIER_STYLES[selected.tier].label}
                      </div>
                      {selected.fullBodyImage && (
                        <p className="text-[0.6875rem] text-gray-400 mb-4">Full-body 3D render available -- shown in-game as your portrait card.</p>
                      )}
                      {selectedId !== equippedId ? (
                        <GoldButton onClick={handleEquip} className="text-[0.6875rem]">
                          Equip This Avatar
                        </GoldButton>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[0.6875rem] font-bold text-green-400 bg-green-500/10 border border-green-500/20">
                          <Check className="w-3.5 h-3.5" /> Currently Equipped
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <User className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500">Select an avatar below to preview</p>
                    <p className="text-[0.625rem] text-gray-600 mt-1">Click any avatar to see details and equip it</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GoldCard>
          </div>

          {/* Middle section: Owned Items + Stats + Recently Equipped */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Owned Items Grid */}
            <GoldCard className="lg:col-span-1" padding="p-5">
              <SectionHeader icon={Package} title="Owned Items" subtitle={`${OWNED_ITEMS.length} items`} className="mb-4" />
                <span className="text-[0.5625rem] text-gray-500 ml-auto">({OWNED_ITEMS.length})</span>
              </h3>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {OWNED_ITEMS.map((item) => {
                  const tierStyle = TIER_STYLES[item.tier];
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                        item.equipped
                          ? "gold-border bg-amber-500/5 shadow-[0_0_8px_rgba(212,175,55,0.1)]"
                          : "border-white/[0.06] hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        item.equipped ? "bg-amber-500/15 gold-border" : "bg-white/5 border border-white/10"
                      }`}>
                        <Shield className={`w-4 h-4 ${item.equipped ? "text-amber-400" : "text-gray-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.6875rem] font-bold text-white truncate">{item.name}</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[0.5625rem] font-bold uppercase tracking-wider ${tierStyle.text}`}>{tierStyle.label}</span>
                          <span className="text-[0.5rem] text-gray-600">{item.slot}</span>
                        </div>
                      </div>
                      {item.equipped && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                          <Check className="w-2.5 h-2.5 text-green-400" />
                          <span className="text-[0.5rem] font-bold text-green-400">Equipped</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </GoldCard>

            {/* Armor Rating + Style Score */}
            <GoldCard className="flex flex-col justify-between" padding="p-5" glow>
              <SectionHeader icon={Star} title="Quick Stats" className="mb-4" />
              <div className="space-y-5 flex-1 flex flex-col justify-center">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[0.6875rem] font-bold text-white flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-blue-400" /> Armor Rating</span>
                    <span className="text-sm font-black text-blue-400">{armorRating}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${armorRating}%` }}
                      transition={{ delay: 0.3, duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[0.6875rem] font-bold text-white flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" style={{ color: "#d4af37" }} /> Style Score</span>
                    <span className="text-sm font-black" style={{ color: "#d4af37" }}>{styleScore}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${styleScore}%` }}
                      transition={{ delay: 0.4, duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[0.6875rem] font-bold text-white flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-amber-400" /> Prestige Level</span>
                    <span className="text-sm font-black text-amber-400">{Math.floor(styleScore * 0.7)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${styleScore * 0.7}%` }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
                    />
                  </div>
                </div>
              </div>
            </GoldCard>

            {/* Recently Equipped */}
            <GoldCard className="flex flex-col" padding="p-5">
              <SectionHeader icon={Clock} title="Recently Equipped" className="mb-4" />
              {recentlyEquipped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                  <Clock className="w-8 h-8 text-gray-600 mb-2" />
                  <p className="text-[0.6875rem] text-gray-600">No recent items yet. Equip avatars to see them here.</p>
                </div>
              ) : (
                <div className="space-y-2.5 flex-1">
                  {recentlyEquipped.map((id) => {
                    const avatar = AVATAR_OPTIONS.find(a => a.id === id);
                    if (!avatar) return null;
                    const style = TIER_STYLES[avatar.tier];
                    return (
                      <button
                        key={id}
                        onClick={() => { setSelectedId(id); setEquippedId(id); }}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all hover:bg-white/5 ${
                          equippedId === id ? "gold-border bg-amber-500/5" : "border-white/[0.06]"
                        }`}
                      >
                        <img src={avatar.image} alt={avatar.name} className="w-10 h-10 rounded-lg object-cover" />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-[0.6875rem] font-bold text-white truncate">{avatar.name}</div>
                          <div className={`text-[0.5625rem] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</div>
                        </div>
                        {equippedId === id && <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </GoldCard>
          </div>

          {/* Action Buttons Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="flex flex-wrap items-center gap-4"
          >
            <GoldButton onClick={handleSavePreset} className="flex items-center gap-2 text-[0.6875rem]">
              {presetSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              {presetSaved ? "Preset Saved!" : "Save Preset"}
            </GoldButton>
            <GoldButton className="flex items-center gap-2 text-sm shadow-[0_0_30px_rgba(212,175,55,0.35)]">
              <Zap className="w-5 h-5" />
              NANO BANANA RENDER
            </GoldButton>
          </motion.div>

          {/* Avatar grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl overflow-hidden vault-card"
          >
            {/* Filter bar */}
            <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/70">
                  All Avatars
                </h3>
                <span className="text-[0.5625rem] text-gray-500 ml-1">({AVATAR_OPTIONS.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(["all", ...TIER_ORDER] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTier(t)}
                    className={`px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                      filterTier === t
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {t === "all" ? "All" : TIER_STYLES[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="p-5">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {filteredAvatars.map((avatar, i) => (
                  <AvatarCard
                    key={avatar.id}
                    avatar={avatar}
                    isSelected={selectedId === avatar.id}
                    isEquipped={equippedId === avatar.id}
                    onClick={() => setSelectedId(avatar.id)}
                    index={i}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
