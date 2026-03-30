import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  User, Crown, Shirt, Sparkles,
  Check, Save, Wand2, Palette
} from "lucide-react";

/* ── Types & Mock Data ──────────────────────────────────────── */

type SlotType = "head" | "body" | "accessory";

interface WardrobeItem {
  id: string;
  name: string;
  slot: SlotType;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  emoji: string;
}

const OWNED_ITEMS: WardrobeItem[] = [
  { id: "h1", name: "Gold Crown",        slot: "head",      rarity: "legendary", emoji: "\uD83D\uDC51" },
  { id: "h2", name: "Neon Visor",        slot: "head",      rarity: "rare",      emoji: "\uD83D\uDD76\uFE0F" },
  { id: "h3", name: "Top Hat",           slot: "head",      rarity: "epic",      emoji: "\uD83C\uDFA9" },
  { id: "h4", name: "Headband",          slot: "head",      rarity: "common",    emoji: "\uD83E\uDD49" },
  { id: "b1", name: "Royal Suit",        slot: "body",      rarity: "legendary", emoji: "\uD83E\uDD35" },
  { id: "b2", name: "Cyberpunk Jacket",  slot: "body",      rarity: "epic",      emoji: "\uD83E\uDDE5" },
  { id: "b3", name: "Classic Tux",       slot: "body",      rarity: "rare",      emoji: "\uD83D\uDC54" },
  { id: "b4", name: "Hoodie",            slot: "body",      rarity: "uncommon",  emoji: "\uD83E\uDDE3" },
  { id: "a1", name: "Diamond Chain",     slot: "accessory", rarity: "legendary", emoji: "\uD83D\uDC8E" },
  { id: "a2", name: "Lucky Chip",        slot: "accessory", rarity: "rare",      emoji: "\uD83C\uDFB0" },
  { id: "a3", name: "Cigar",             slot: "accessory", rarity: "epic",      emoji: "\uD83D\uDEAC" },
  { id: "a4", name: "Watch",             slot: "accessory", rarity: "uncommon",  emoji: "\u231A" },
];

const RARITY_STYLES: Record<string, { border: string; text: string; bg: string }> = {
  legendary: { border: "border-amber-500/30",  text: "text-amber-400",  bg: "bg-amber-500/10" },
  epic:      { border: "border-purple-500/30", text: "text-purple-400", bg: "bg-purple-500/10" },
  rare:      { border: "border-cyan-500/30",   text: "text-primary",   bg: "bg-cyan-500/10" },
  uncommon:  { border: "border-green-500/30",  text: "text-green-400",  bg: "bg-green-500/10" },
  common:    { border: "border-gray-500/30",   text: "text-gray-400",   bg: "bg-gray-500/10" },
};

const SLOT_META: Record<SlotType, { label: string; icon: any }> = {
  head:      { label: "Head",      icon: Crown },
  body:      { label: "Body",      icon: Shirt },
  accessory: { label: "Accessory", icon: Sparkles },
};

/* ── Equipped Slot Display ──────────────────────────────────── */

function EquippedSlot({
  slot,
  item,
  onClear,
}: {
  slot: SlotType;
  item: WardrobeItem | null;
  onClear: () => void;
}) {
  const meta = SLOT_META[slot];
  const Icon = meta.icon;
  const style = item ? RARITY_STYLES[item.rarity] : null;

  return (
    <div
      className={`relative rounded-xl p-4 border transition-all ${
        item
          ? `${style!.border} bg-surface-high/60`
          : "border-white/[0.06] bg-surface-high/30 border-dashed"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          item ? style!.bg : "bg-white/5"
        }`}>
          {item ? (
            <span className="text-xl">{item.emoji}</span>
          ) : (
            <Icon className="w-5 h-5 text-gray-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider font-medium">
            {meta.label}
          </div>
          {item ? (
            <div className="text-xs font-bold text-white truncate">{item.name}</div>
          ) : (
            <div className="text-xs text-gray-600 italic">Empty</div>
          )}
        </div>
        {item && (
          <button
            onClick={onClear}
            className="text-[0.5625rem] text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            Remove
          </button>
        )}
      </div>
      {item && (
        <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider ${style!.bg} ${style!.text} border ${style!.border}`}>
          {item.rarity}
        </span>
      )}
    </div>
  );
}

/* ── Item Grid Card ─────────────────────────────────────────── */

function ItemCard({
  item,
  isEquipped,
  onClick,
  index,
}: {
  item: WardrobeItem;
  isEquipped: boolean;
  onClick: () => void;
  index: number;
}) {
  const style = RARITY_STYLES[item.rarity];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.03 }}
      onClick={onClick}
      className={`relative rounded-xl p-4 border text-left transition-all hover:scale-[1.03] ${
        isEquipped
          ? `${style.border} bg-surface-highest/60 ring-1 ring-primary/30`
          : `border-white/[0.06] bg-surface-high/40 hover:border-white/15`
      }`}
    >
      {/* Emoji avatar */}
      <div className={`w-12 h-12 rounded-lg ${style.bg} flex items-center justify-center mb-3 mx-auto`}>
        <span className="text-2xl">{item.emoji}</span>
      </div>

      {/* Item info */}
      <div className="text-xs font-bold text-white text-center truncate">{item.name}</div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <span className={`text-[0.5rem] font-bold uppercase tracking-wider ${style.text}`}>
          {item.rarity}
        </span>
        <span className="text-[0.5rem] text-gray-600">|</span>
        <span className="text-[0.5rem] text-gray-500 uppercase tracking-wider">
          {SLOT_META[item.slot].label}
        </span>
      </div>

      {/* Equipped badge */}
      {isEquipped && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Check className="w-3 h-3 text-primary" />
        </div>
      )}
    </motion.button>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function AvatarWardrobe() {
  const [equipped, setEquipped] = useState<Record<SlotType, string | null>>({
    head: "h1",
    body: "b1",
    accessory: "a1",
  });

  const [filterSlot, setFilterSlot] = useState<SlotType | "all">("all");

  const getEquippedItem = (slot: SlotType): WardrobeItem | null => {
    const id = equipped[slot];
    return id ? OWNED_ITEMS.find((i) => i.id === id) ?? null : null;
  };

  const handleEquip = (item: WardrobeItem) => {
    setEquipped((prev) => ({
      ...prev,
      [item.slot]: prev[item.slot] === item.id ? null : item.id,
    }));
  };

  const handleClearSlot = (slot: SlotType) => {
    setEquipped((prev) => ({ ...prev, [slot]: null }));
  };

  const isEquipped = (item: WardrobeItem) => equipped[item.slot] === item.id;

  const filteredItems =
    filterSlot === "all"
      ? OWNED_ITEMS
      : OWNED_ITEMS.filter((i) => i.slot === filterSlot);

  const handleSavePreset = () => {
    // UI-only placeholder
  };

  return (
    <DashboardLayout title="Avatar Wardrobe">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/15 border border-primary/20 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white tracking-tight">
                Wardrobe
              </h2>
              <p className="text-[0.625rem] text-muted-foreground">
                Equip items and customize your avatar appearance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Create New Avatar button */}
            <Link href="/avatar-customizer">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all">
                <Wand2 className="w-3.5 h-3.5" />
                Create New Avatar
              </button>
            </Link>

            {/* Dye Shop button */}
            <Link href="/dye-shop">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-all">
                <Palette className="w-3.5 h-3.5" />
                Dye Shop
              </button>
            </Link>

            {/* Save Preset button */}
            <button
              onClick={handleSavePreset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider gradient-gold text-black border border-[#c9a84c]/40 hover:opacity-90 transition-all shadow-[0_0_15px_rgba(212,168,67,0.2)]"
            >
              <Save className="w-3.5 h-3.5" />
              Save Preset
            </button>
          </div>
        </motion.div>

        {/* Main avatar preview + equipped slots */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Large Avatar Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1 flex flex-col items-center justify-center rounded-xl p-8 bg-surface-high/50 backdrop-blur-xl border border-primary/15"
          >
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 flex items-center justify-center mb-4 relative">
              {/* Composite display of equipped items */}
              <div className="text-center">
                <span className="text-5xl block mb-1">
                  {getEquippedItem("head")?.emoji || "\uD83D\uDC64"}
                </span>
              </div>
              {/* Ambient glow */}
              <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl -z-10" />
            </div>
            <div className="text-sm font-bold text-white mb-1">Your Avatar</div>
            <div className="text-[0.5625rem] text-gray-500">
              {Object.values(equipped).filter(Boolean).length} / 3 slots equipped
            </div>
          </motion.div>

          {/* Equipped Gear Slots */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#c9a84c]/70" />
              Equipped Gear
            </h3>
            <EquippedSlot
              slot="head"
              item={getEquippedItem("head")}
              onClear={() => handleClearSlot("head")}
            />
            <EquippedSlot
              slot="body"
              item={getEquippedItem("body")}
              onClear={() => handleClearSlot("body")}
            />
            <EquippedSlot
              slot="accessory"
              item={getEquippedItem("accessory")}
              onClear={() => handleClearSlot("accessory")}
            />
          </motion.div>
        </div>

        {/* Owned Items Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-white/[0.06]"
        >
          <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary/70">
                Owned Items
              </h3>
              <span className="text-[0.5625rem] text-gray-500 ml-1">
                ({OWNED_ITEMS.length} items)
              </span>
            </div>

            {/* Slot filter pills */}
            <div className="flex items-center gap-1.5">
              {(["all", "head", "body", "accessory"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSlot(s)}
                  className={`px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                    filterSlot === s
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {s === "all" ? "All" : SLOT_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredItems.map((item, i) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isEquipped={isEquipped(item)}
                  onClick={() => handleEquip(item)}
                  index={i}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-xs text-gray-500">No items in this category.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
