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
    // Avatars
    { name: "Neon Viper", description: "Sleek cyberpunk snake avatar", category: "avatar", rarity: "common", price: 500, currency: "chips", imageUrl: null },
    { name: "Ice Queen", description: "Frost-covered royalty", category: "avatar", rarity: "uncommon", price: 1000, currency: "chips", imageUrl: null },
    { name: "Shadow King", description: "Dark and mysterious ruler", category: "avatar", rarity: "rare", price: 2500, currency: "chips", imageUrl: null },
    { name: "Gold Phantom", description: "Gilded spectral presence", category: "avatar", rarity: "epic", price: 5000, currency: "chips", imageUrl: null },
    { name: "Chrome Siren", description: "Metallic enchantress of the void", category: "avatar", rarity: "legendary", price: 10000, currency: "chips", imageUrl: null },
    { name: "Red Wolf", description: "Fierce crimson predator", category: "avatar", rarity: "uncommon", price: 1200, currency: "chips", imageUrl: null },
    { name: "Cyber Punk", description: "Classic cyberpunk rebel", category: "avatar", rarity: "common", price: 500, currency: "chips", imageUrl: null },
    { name: "Dark Ace", description: "Master of the shadows", category: "avatar", rarity: "rare", price: 3000, currency: "chips", imageUrl: null },

    // Table Themes
    { name: "Classic Green Felt", description: "Traditional poker table look", category: "table_theme", rarity: "common", price: 300, currency: "chips", imageUrl: null },
    { name: "Midnight Blue", description: "Deep ocean-blue felt with silver trim", category: "table_theme", rarity: "uncommon", price: 800, currency: "chips", imageUrl: null },
    { name: "Neon Grid", description: "Cyberpunk grid lines on dark surface", category: "table_theme", rarity: "rare", price: 2000, currency: "chips", imageUrl: null },
    { name: "Gold Royale", description: "Luxurious gold and black design", category: "table_theme", rarity: "epic", price: 4000, currency: "chips", imageUrl: null },
    { name: "Holographic", description: "Shimmering holographic surface", category: "table_theme", rarity: "legendary", price: 8000, currency: "chips", imageUrl: null },

    // Emotes
    { name: "GG", description: "Good game emote", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: null },
    { name: "Nice Hand", description: "Compliment a great play", category: "emote", rarity: "common", price: 200, currency: "chips", imageUrl: null },
    { name: "Bluff Master", description: "Show off your bluffing skills", category: "emote", rarity: "uncommon", price: 600, currency: "chips", imageUrl: null },
    { name: "All In!", description: "Dramatic all-in announcement", category: "emote", rarity: "rare", price: 1500, currency: "chips", imageUrl: null },
    { name: "Royal Flush", description: "Celebrate the ultimate hand", category: "emote", rarity: "epic", price: 3000, currency: "chips", imageUrl: null },

    // Premium
    { name: "Elite Player's Pass", description: "7-day premium access: 2x daily bonus, exclusive tables, priority support", category: "premium", rarity: "legendary", price: 5000, currency: "chips", imageUrl: null },
    { name: "VIP Chip Bundle", description: "Bonus 2,000 chips added to your balance", category: "premium", rarity: "epic", price: 1500, currency: "chips", imageUrl: null },
    { name: "Lucky Charm", description: "Cosmetic lucky charm shown at your seat", category: "premium", rarity: "rare", price: 2500, currency: "chips", imageUrl: null },
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
