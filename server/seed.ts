import { storage } from "./storage";

/**
 * Seeds missions and shop items if they don't already exist.
 * Called once at server startup.
 */
export async function seedData() {
  await seedMissions();
  await seedShopItems();
  await seedTauntShopItems();
}

async function seedMissions() {
  const existing = await storage.getMissions();
  if (existing.length > 0) return; // Already seeded

  const missionDefs = [
    { type: "hands_played", label: "Play 50 Hands", description: "Play 50 hands in any game format", target: 50, reward: 200, periodType: "daily" },
    { type: "pots_won", label: "Win 20 Pots", description: "Win 20 pots in any game", target: 20, reward: 500, periodType: "daily" },
    { type: "win_streak", label: "Win Streak 5", description: "Achieve a 5-hand winning streak", target: 5, reward: 750, periodType: "daily" },
    { type: "hands_played", label: "Play 200 Hands", description: "Play 200 hands this week", target: 200, reward: 1000, periodType: "weekly" },
    { type: "pots_won", label: "Win 50 Pots", description: "Win 50 pots this week", target: 50, reward: 1500, periodType: "weekly" },
    { type: "win_streak", label: "Win Streak 10", description: "Achieve a 10-hand winning streak", target: 10, reward: 2000, periodType: "weekly" },
    { type: "sng_win", label: "Win a Sit & Go", description: "Finish 1st in a Sit & Go tournament", target: 1, reward: 1000, periodType: "daily" },
    { type: "bomb_pot", label: "Play 5 Bomb Pots", description: "Play 5 bomb pot hands", target: 5, reward: 300, periodType: "daily" },
    { type: "heads_up_win", label: "Win Heads-Up Match", description: "Win a heads-up format game", target: 1, reward: 500, periodType: "daily" },
    { type: "consecutive_wins", label: "Win 3 in a Row", description: "Win 3 consecutive hands", target: 3, reward: 400, periodType: "daily" },
  ];

  for (const def of missionDefs) {
    await storage.createMission({ ...def, isActive: true });
  }
  console.log(`[seed] Created ${missionDefs.length} missions`);
}

async function seedShopItems() {
  const existing = await storage.getShopItems();
  if (existing.length > 0) return; // Already seeded

  const items = [
    // ─── Avatars (wired to real images in /avatars/) ─────────────────────
    { name: "Neon Viper", description: "Sleek cyberpunk snake avatar", category: "avatar", rarity: "common", price: 500, currency: "chips", imageUrl: "/avatars/avatar_neon_viper.webp" },
    { name: "Ice Queen", description: "Frost-covered royalty", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_ice_queen.webp" },
    { name: "Shadow King", description: "Dark and mysterious ruler", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_shadow_king.webp" },
    { name: "Gold Phantom", description: "Gilded spectral presence", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Chrome Siren", description: "Metallic enchantress of the void", category: "avatar", rarity: "legendary", price: 10000, currency: "chips", imageUrl: "/avatars/avatar_chrome_siren.webp" },
    { name: "Red Wolf", description: "Fierce crimson predator", category: "avatar", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: "/avatars/avatar_red_wolf.webp" },
    { name: "Cyber Punk", description: "Classic cyberpunk rebel", category: "avatar", rarity: "common", price: 500, currency: "chips", imageUrl: "/avatars/avatar_cyber_punk.webp" },
    { name: "Dark Ace", description: "Master of the shadows", category: "avatar", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_dark_ace.webp" },
    { name: "Neon Fox", description: "Swift and cunning cyber fox", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_neon_fox.webp" },
    { name: "Void Witch", description: "Sorceress of the digital void", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_void_witch.webp" },
    { name: "Steel Ghost", description: "Invisible metallic phantom", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_steel_ghost.webp" },
    { name: "Tech Monk", description: "Zen master of technology", category: "avatar", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: "/avatars/avatar_tech_monk.webp" },
    { name: "Punk Duchess", description: "Rebel royalty with attitude", category: "avatar", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_punk_duchess.webp" },
    { name: "Oracle Seer", description: "All-seeing prophet of the cards", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_oracle_seer.webp" },
    { name: "Street Racer", description: "Speed demon of the underground", category: "avatar", rarity: "common", price: 500, currency: "chips", imageUrl: "/avatars/avatar_street_racer.webp" },
    { name: "Mech Pilot", description: "Armored battle suit operator", category: "avatar", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_mech_pilot.webp" },
    { name: "Bolt Runner", description: "Lightning-fast cyber courier", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_bolt_runner.webp" },
    { name: "Iron Bull", description: "Unstoppable cybernetic enforcer", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Ghost Sniper", description: "Silent long-range assassin", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_ghost_sniper.webp" },
    { name: "Neon Medic", description: "Cyberpunk battlefield healer", category: "avatar", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: "/avatars/avatar_neon_medic.webp" },
    { name: "Data Thief", description: "Master hacker and data pirate", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_data_thief.webp" },
    { name: "DJ Chrome", description: "Neon nightclub overlord", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_dj_chrome.webp" },
    { name: "Merchant Boss", description: "Black market kingpin", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_merchant_boss.webp" },
    { name: "Cyber Samurai", description: "Blade-wielding digital warrior", category: "avatar", rarity: "legendary", price: 10000, currency: "chips", imageUrl: "/avatars/avatar_cyber_samurai.webp" },

    // ─── Premium Mythic Avatars (Nano Banana generated, highest tier) ────
    { name: "Inferno Warlord", description: "Mythic — Forged in digital hellfire. 1/1 exclusive build.", category: "avatar", rarity: "mythic", price: 25000, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Quantum Empress", description: "Mythic — Exists in all timelines simultaneously.", category: "avatar", rarity: "mythic", price: 25000, currency: "chips", imageUrl: "/avatars/avatar_void_witch.webp" },
    { name: "Apex Predator", description: "Mythic — The final boss of the High Rollers Club.", category: "avatar", rarity: "mythic", price: 50000, currency: "chips", imageUrl: "/avatars/avatar_cyber_samurai.webp" },

    // ─── Weapons & Gear (displayed at table next to avatar) ──────────────
    { name: "Plasma Pistol", description: "Glowing sidearm — shows next to your avatar at the table", category: "avatar", rarity: "uncommon", price: 800, currency: "chips", imageUrl: "/avatars/avatar_ghost_sniper.webp" },
    { name: "Neon Katana", description: "Cyberpunk blade with LED edge glow", category: "avatar", rarity: "rare", price: 2000, currency: "chips", imageUrl: "/avatars/avatar_cyber_samurai.webp" },
    { name: "Golden Revolver", description: "Six-shooter plated in 24k digital gold", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Void Scythe", description: "Legendary death blade from the void dimension", category: "avatar", rarity: "legendary", price: 12000, currency: "chips", imageUrl: "/avatars/avatar_void_witch.webp" },
    { name: "Quantum Shield", description: "Energy barrier that shimmers at the table", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_steel_ghost.webp" },
    { name: "Mech Gauntlet", description: "Armored power fist with HUD display", category: "avatar", rarity: "epic", price: 4000, currency: "chips", imageUrl: "/avatars/avatar_mech_pilot.webp" },

    // ─── Clothing & Armor (premium cosmetics) ────────────────────────────
    { name: "Tactical Vest", description: "Armored vest with ammo pouches and LED strips", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_ghost_sniper.webp" },
    { name: "Cyber Trenchcoat", description: "Long black coat with neon circuit patterns", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_dark_ace.webp" },
    { name: "Golden Armor Set", description: "Full plate armor in metallic gold — ultimate flex", category: "avatar", rarity: "legendary", price: 15000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Holographic Hoodie", description: "Color-shifting hoodie with animated patterns", category: "avatar", rarity: "uncommon", price: 800, currency: "chips", imageUrl: "/avatars/avatar_street_racer.webp" },
    { name: "Shadow Cloak", description: "Wraith-like cloak that ripples with dark energy", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_shadow_king.webp" },
    { name: "Spartan Cuber Suit", description: "Full-body chrome battle suit with HUD visor", category: "avatar", rarity: "legendary", price: 12000, currency: "chips", imageUrl: "/avatars/avatar_steel_ghost.webp" },

    // ─── Table Themes ────────────────────────────────────────────────────
    { name: "Classic Green Felt", description: "Traditional poker table look", category: "table_theme", rarity: "common", price: 300, currency: "chips", imageUrl: "/avatars/avatar_merchant_boss.webp" },
    { name: "Midnight Blue", description: "Deep ocean-blue felt with silver trim", category: "table_theme", rarity: "uncommon", price: 800, currency: "chips", imageUrl: "/avatars/avatar_ice_queen.webp" },
    { name: "Neon Grid", description: "Cyberpunk grid lines on dark surface", category: "table_theme", rarity: "rare", price: 2000, currency: "chips", imageUrl: "/avatars/avatar_neon_fox.webp" },
    { name: "Gold Royale", description: "Luxurious gold and black design", category: "table_theme", rarity: "epic", price: 4000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Holographic", description: "Shimmering holographic surface", category: "table_theme", rarity: "legendary", price: 8000, currency: "chips", imageUrl: "/avatars/avatar_chrome_siren.webp" },

    // ─── Emotes ──────────────────────────────────────────────────────────
    { name: "GG", description: "Good game emote", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: "/avatars/avatar_tech_monk.webp" },
    { name: "Nice Hand", description: "Compliment a great play", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: "/avatars/avatar_neon_medic.webp" },
    { name: "Bluff Master", description: "Show off your bluffing skills", category: "emote", rarity: "uncommon", price: 600, currency: "chips", imageUrl: "/avatars/avatar_data_thief.webp" },
    { name: "All In!", description: "Dramatic all-in announcement", category: "emote", rarity: "rare", price: 1500, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Royal Flush", description: "Celebrate the ultimate hand", category: "emote", rarity: "epic", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_cyber_samurai.webp" },

    // ─── Premium Items ───────────────────────────────────────────────────
    { name: "Elite Player's Pass", description: "7-day premium access: 2x daily bonus, exclusive tables, priority support", category: "premium", rarity: "legendary", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "VIP Chip Bundle", description: "Bonus 2,000 chips added to your balance", category: "premium", rarity: "epic", price: 1500, currency: "chips", imageUrl: "/avatars/avatar_merchant_boss.webp" },
    { name: "Lucky Charm", description: "Cosmetic lucky charm shown at your seat", category: "premium", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_oracle_seer.webp" },

// Card Backs
    { name: "Classic Red", description: "Traditional red card back design", category: "card_back", rarity: "common", price: 0, currency: "chips", imageUrl: null },
    { name: "Midnight Black", description: "Sleek midnight black card back", category: "card_back", rarity: "common", price: 300, currency: "chips", imageUrl: null, earnableAtLevel: 2 },
    { name: "Royal Blue", description: "Elegant royal blue card back", category: "card_back", rarity: "uncommon", price: 800, currency: "chips", imageUrl: null },
    { name: "Gold Foil", description: "Luxurious gold foil card back", category: "card_back", rarity: "rare", price: 2500, currency: "chips", imageUrl: null },
    { name: "Carbon Fiber", description: "Modern carbon fiber card back", category: "card_back", rarity: "rare", price: 3000, currency: "chips", imageUrl: null, earnableAtLevel: 4 },
    { name: "Holographic Shimmer", description: "Shimmering holographic card back", category: "card_back", rarity: "epic", price: 5000, currency: "chips", imageUrl: null, earnableAtLevel: 6 },
    { name: "Animated Fire", description: "Blazing animated fire card back", category: "card_back", rarity: "epic", price: 7500, currency: "chips", imageUrl: null },
    { name: "Animated Lightning", description: "Electrifying animated lightning card back", category: "card_back", rarity: "legendary", price: 12000, currency: "chips", imageUrl: null },
    { name: "Animated Galaxy", description: "Mesmerizing animated galaxy card back", category: "card_back", rarity: "mythic", price: 25000, currency: "chips", imageUrl: null, earnableAtLevel: 9 },

    // Profile Frames
    { name: "Simple Silver", description: "Clean simple silver profile frame", category: "frame", rarity: "common", price: 200, currency: "chips", imageUrl: null },
    { name: "Bronze Laurel", description: "Classic bronze laurel wreath frame", category: "frame", rarity: "uncommon", price: 600, currency: "chips", imageUrl: null },
    { name: "Gold Crown", description: "Regal gold crown profile frame", category: "frame", rarity: "rare", price: 2000, currency: "chips", imageUrl: null },
    { name: "Diamond Ring", description: "Sparkling diamond ring profile frame", category: "frame", rarity: "epic", price: 4000, currency: "chips", imageUrl: null, earnableAtLevel: 5 },
    { name: "Animated Flame Ring", description: "Fiery animated flame ring frame", category: "frame", rarity: "legendary", price: 8000, currency: "chips", imageUrl: null },
    { name: "Animated Neon Pulse", description: "Pulsing neon animated profile frame", category: "frame", rarity: "legendary", price: 10000, currency: "chips", imageUrl: null, earnableAtLevel: 7 },
    { name: "Holographic Prism", description: "Stunning holographic prism profile frame", category: "frame", rarity: "mythic", price: 20000, currency: "chips", imageUrl: null, earnableAtLevel: 10 },

    // Seat Effects
    { name: "Subtle Glow", description: "A soft subtle glow around your seat", category: "seat_effect", rarity: "common", price: 500, currency: "chips", imageUrl: null, earnableAtLevel: 2 },
    { name: "Smoke Trail", description: "Wispy smoke trail seat effect", category: "seat_effect", rarity: "uncommon", price: 1500, currency: "chips", imageUrl: null },
    { name: "Electric Sparks", description: "Crackling electric sparks seat effect", category: "seat_effect", rarity: "rare", price: 3000, currency: "chips", imageUrl: null },
    { name: "Flame Aura", description: "Blazing flame aura around your seat", category: "seat_effect", rarity: "epic", price: 6000, currency: "chips", imageUrl: null },
    { name: "Ice Crystal", description: "Frozen ice crystal seat effect", category: "seat_effect", rarity: "epic", price: 6000, currency: "chips", imageUrl: null, earnableAtLevel: 6 },
    { name: "Golden Crown Glow", description: "Majestic golden crown glow seat effect", category: "seat_effect", rarity: "legendary", price: 15000, currency: "chips", imageUrl: null, earnableAtLevel: 8 },

    // Win Celebrations
    { name: "Confetti Burst", description: "Colorful confetti burst celebration", category: "win_celebration", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: null, earnableAtLevel: 3 },
    { name: "Gold Rain", description: "Shower of gold coins celebration", category: "win_celebration", rarity: "rare", price: 3000, currency: "chips", imageUrl: null },
    { name: "Fireworks", description: "Spectacular fireworks celebration", category: "win_celebration", rarity: "epic", price: 5000, currency: "chips", imageUrl: null },
    { name: "Lightning Strike", description: "Dramatic lightning strike celebration", category: "win_celebration", rarity: "legendary", price: 10000, currency: "chips", imageUrl: null, earnableAtLevel: 7 },
    { name: "Nuclear Explosion", description: "Over-the-top nuclear explosion celebration", category: "win_celebration", rarity: "mythic", price: 20000, currency: "chips", imageUrl: null },

    // Chat Effects
    { name: "Gold Text", description: "Messages appear in shimmering gold", category: "chat_effect", rarity: "uncommon", price: 800, currency: "chips", imageUrl: null, earnableAtLevel: 4 },
    { name: "Animated Border", description: "Animated border around your chat messages", category: "chat_effect", rarity: "rare", price: 2000, currency: "chips", imageUrl: null },
    { name: "Rainbow Text", description: "Messages cycle through rainbow colors", category: "chat_effect", rarity: "epic", price: 4000, currency: "chips", imageUrl: null, earnableAtLevel: 6 },
    { name: "Custom Chat Color", description: "Choose a custom color for your chat messages", category: "chat_effect", rarity: "legendary", price: 8000, currency: "chips", imageUrl: null, earnableAtLevel: 8 },

    // Entrance Animations
    { name: "Slide In", description: "Smooth slide-in entrance animation", category: "entrance_animation", rarity: "common", price: 300, currency: "chips", imageUrl: null },
    { name: "Smoke Appear", description: "Appear from a puff of smoke", category: "entrance_animation", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: null, earnableAtLevel: 3 },
    { name: "Portal Open", description: "Step through a portal entrance", category: "entrance_animation", rarity: "rare", price: 3500, currency: "chips", imageUrl: null },
    { name: "Lightning Strike Entry", description: "Arrive with a dramatic lightning strike", category: "entrance_animation", rarity: "epic", price: 7000, currency: "chips", imageUrl: null, earnableAtLevel: 7 },
    { name: "Holographic Materialize", description: "Materialize as a hologram", category: "entrance_animation", rarity: "mythic", price: 15000, currency: "chips", imageUrl: null, earnableAtLevel: 9 },

    // Additional Emotes
    { name: "Ship It", description: "Ship it emote", category: "emote", rarity: "uncommon", price: 400, currency: "chips", imageUrl: null },
    { name: "Slow Roll", description: "Slow roll taunt emote", category: "emote", rarity: "rare", price: 1500, currency: "chips", imageUrl: null, earnableAtLevel: 4 },
    { name: "Scared", description: "Scared reaction emote", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: null },
    { name: "Thinking", description: "Thinking face emote", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: null },
    { name: "On Tilt", description: "On tilt frustration emote", category: "emote", rarity: "rare", price: 1500, currency: "chips", imageUrl: null },
    { name: "Respect", description: "Show respect emote", category: "emote", rarity: "uncommon", price: 600, currency: "chips", imageUrl: null },
    { name: "Crying", description: "Crying reaction emote", category: "emote", rarity: "uncommon", price: 500, currency: "chips", imageUrl: null },
    { name: "Dancing", description: "Celebration dancing emote", category: "emote", rarity: "epic", price: 3000, currency: "chips", imageUrl: null, earnableAtLevel: 5 },
    { name: "Mic Drop", description: "Ultimate mic drop emote", category: "emote", rarity: "legendary", price: 8000, currency: "chips", imageUrl: null, earnableAtLevel: 8 },
// ─── Card Backs ──────────────────────────────────────────────────────
    { name: "Classic Red", description: "Traditional red card back design", category: "card_back", rarity: "common", price: 0, currency: "chips", imageUrl: "/avatars/avatar_red_wolf.webp" },
    { name: "Midnight Black", description: "Sleek black card back with subtle shimmer", category: "card_back", rarity: "common", price: 300, currency: "chips", imageUrl: "/avatars/avatar_dark_ace.webp" },
    { name: "Royal Blue", description: "Deep blue card back with royal crest", category: "card_back", rarity: "uncommon", price: 800, currency: "chips", imageUrl: "/avatars/avatar_ice_queen.webp" },
    { name: "Gold Foil", description: "Luxurious gold foil card back", category: "card_back", rarity: "rare", price: 2500, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Carbon Fiber", description: "Modern carbon fiber texture card back", category: "card_back", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_steel_ghost.webp" },
    { name: "Holographic", description: "Shimmering holographic card back", category: "card_back", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_chrome_siren.webp" },
    { name: "Animated Fire", description: "Card back with animated fire effect", category: "card_back", rarity: "epic", price: 7500, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Animated Lightning", description: "Card back with crackling lightning animation", category: "card_back", rarity: "legendary", price: 12000, currency: "chips", imageUrl: "/avatars/avatar_bolt_runner.webp" },
    { name: "Animated Galaxy", description: "Card back with swirling galaxy animation", category: "card_back", rarity: "mythic", price: 25000, currency: "chips", imageUrl: "/avatars/avatar_void_witch.webp" },
    // ─── Profile Frames ─────────────────────────────────────────────────
    { name: "Simple Silver", description: "Clean silver profile frame", category: "frame", rarity: "common", price: 200, currency: "chips", imageUrl: "/avatars/avatar_tech_monk.webp" },
    { name: "Bronze Laurel", description: "Bronze laurel wreath profile frame", category: "frame", rarity: "uncommon", price: 600, currency: "chips", imageUrl: "/avatars/avatar_mech_pilot.webp" },
    { name: "Gold Crown", description: "Regal gold crown profile frame", category: "frame", rarity: "rare", price: 2000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Diamond Ring", description: "Sparkling diamond ring profile frame", category: "frame", rarity: "epic", price: 4000, currency: "chips", imageUrl: "/avatars/avatar_chrome_siren.webp" },
    { name: "Animated Flame Ring", description: "Profile frame with animated flames", category: "frame", rarity: "legendary", price: 8000, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Animated Neon Pulse", description: "Pulsing neon profile frame", category: "frame", rarity: "legendary", price: 10000, currency: "chips", imageUrl: "/avatars/avatar_neon_viper.webp" },
    { name: "Holographic Prism", description: "Prismatic holographic profile frame", category: "frame", rarity: "mythic", price: 20000, currency: "chips", imageUrl: "/avatars/avatar_oracle_seer.webp" },
    // ─── Seat Effects ───────────────────────────────────────────────────
    { name: "Subtle Glow", description: "Soft ambient glow around your seat", category: "seat_effect", rarity: "common", price: 500, currency: "chips", imageUrl: "/avatars/avatar_neon_medic.webp" },
    { name: "Smoke Trail", description: "Wispy smoke effect around your seat", category: "seat_effect", rarity: "uncommon", price: 1500, currency: "chips", imageUrl: "/avatars/avatar_shadow_king.webp" },
    { name: "Electric Sparks", description: "Crackling electric sparks at your seat", category: "seat_effect", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_bolt_runner.webp" },
    { name: "Flame Aura", description: "Fiery aura surrounding your seat", category: "seat_effect", rarity: "epic", price: 6000, currency: "chips", imageUrl: "/avatars/avatar_iron_bull.webp" },
    { name: "Ice Crystal", description: "Frozen crystal effect at your seat", category: "seat_effect", rarity: "epic", price: 6000, currency: "chips", imageUrl: "/avatars/avatar_ice_queen.webp" },
    { name: "Golden Crown Glow", description: "Majestic golden crown glow effect", category: "seat_effect", rarity: "legendary", price: 15000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    // ─── Win Celebrations ───────────────────────────────────────────────
    { name: "Chip Cascade", description: "Chips cascade across the screen", category: "win_celebration", rarity: "common", price: 0, currency: "chips", imageUrl: "/avatars/avatar_merchant_boss.webp" },
    { name: "Confetti Burst", description: "Colorful confetti explosion", category: "win_celebration", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: "/avatars/avatar_punk_duchess.webp" },
    { name: "Gold Rain", description: "Golden coins rain from above", category: "win_celebration", rarity: "rare", price: 3000, currency: "chips", imageUrl: "/avatars/avatar_gold_phantom.webp" },
    { name: "Fireworks", description: "Spectacular fireworks display", category: "win_celebration", rarity: "epic", price: 5000, currency: "chips", imageUrl: "/avatars/avatar_neon_fox.webp" },
    { name: "Lightning Strike", description: "Dramatic lightning strike celebration", category: "win_celebration", rarity: "legendary", price: 10000, currency: "chips", imageUrl: "/avatars/avatar_bolt_runner.webp" },
    { name: "Nuclear Explosion", description: "Massive nuclear explosion effect", category: "win_celebration", rarity: "mythic", price: 20000, currency: "chips", imageUrl: "/avatars/avatar_cyber_samurai.webp" },
    // ─── Entrance Animations ────────────────────────────────────────────
    { name: "Slide In", description: "Smooth slide-in entrance animation", category: "entrance_animation", rarity: "common", price: 300, currency: "chips", imageUrl: "/avatars/avatar_street_racer.webp" },
    { name: "Smoke Appear", description: "Appear from a cloud of smoke", category: "entrance_animation", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: "/avatars/avatar_shadow_king.webp" },
    { name: "Portal Open", description: "Step through a glowing portal", category: "entrance_animation", rarity: "rare", price: 3500, currency: "chips", imageUrl: "/avatars/avatar_void_witch.webp" },
    { name: "Lightning Strike Entry", description: "Arrive with a bolt of lightning", category: "entrance_animation", rarity: "epic", price: 7000, currency: "chips", imageUrl: "/avatars/avatar_bolt_runner.webp" },
    { name: "Holographic Materialize", description: "Materialize as a hologram", category: "entrance_animation", rarity: "mythic", price: 15000, currency: "chips", imageUrl: "/avatars/avatar_chrome_siren.webp" },
  ];

  for (const item of items) {
    await storage.createShopItem({ ...item, isActive: true });
  }
  console.log(`[seed] Created ${items.length} shop items`);
}

async function seedTauntShopItems() {
  // Check if taunt items already exist
  const existing = await storage.getShopItems("taunt");
  if (existing.length > 0) return;

  const taunts = [
    { name: "Ship it!", description: "Taunt: ship-it — Gold chip cascade effect", category: "taunt", rarity: "uncommon", price: 500, currency: "chips", imageUrl: null },
    { name: "Easy money", description: "Taunt: easy-money — Dollar signs float effect", category: "taunt", rarity: "uncommon", price: 500, currency: "chips", imageUrl: null },
    { name: "Pay me.", description: "Taunt: pay-me — Chips slide animation", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
    { name: "I own this table", description: "Taunt: own-table — Crown appears above", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
    { name: "Read you like a book", description: "Taunt: read-you — Book flip animation", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
    { name: "You're drawing dead", description: "Taunt: drawing-dead — Skull & crossbones effect", category: "taunt", rarity: "epic", price: 2500, currency: "chips", imageUrl: null },
    { name: "Run it twice? I don't need to", description: "Taunt: run-it — Dice roll effect", category: "taunt", rarity: "epic", price: 2500, currency: "chips", imageUrl: null },
    { name: "The nuts, baby!", description: "Taunt: the-nuts — Nut emoji explosion", category: "taunt", rarity: "epic", price: 2500, currency: "chips", imageUrl: null },
    { name: "Call the clock!", description: "Taunt: call-clock — Timer animation", category: "taunt", rarity: "uncommon", price: 750, currency: "chips", imageUrl: null },
    { name: "That's a crying call", description: "Taunt: crying-call — Tear drop effect", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
    { name: "My grandma plays better", description: "Taunt: grandma — Grandma emoji effect", category: "taunt", rarity: "legendary", price: 5000, currency: "chips", imageUrl: null },
    { name: "Time to reload", description: "Taunt: reload — Bullet clip animation", category: "taunt", rarity: "uncommon", price: 500, currency: "chips", imageUrl: null },
    { name: "I did the math", description: "Taunt: math — Calculator animation", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
    { name: "Scared money don't make money", description: "Taunt: scared-money — Money wings effect", category: "taunt", rarity: "epic", price: 2500, currency: "chips", imageUrl: null },
    { name: "I can do this all day", description: "Taunt: all-day — Infinity symbol effect", category: "taunt", rarity: "legendary", price: 5000, currency: "chips", imageUrl: null },
    { name: "Respect the raise", description: "Taunt: respect — Bow animation", category: "taunt", rarity: "rare", price: 1000, currency: "chips", imageUrl: null },
  ];

  for (const taunt of taunts) {
    await storage.createShopItem({ ...taunt, isActive: true });
  }
  console.log(`[seed] Created ${taunts.length} premium taunt shop items`);
}
