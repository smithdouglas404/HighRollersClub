// ─── High Roller Points (HRP) Loyalty Program ─────────────────────────────────

export const LOYALTY_LEVELS = [
  { level: 1, name: "Rookie", hrpRequired: 0, badge: "Bronze chip" },
  { level: 2, name: "Regular", hrpRequired: 500, badge: "Silver chip" },
  { level: 3, name: "Grinder", hrpRequired: 2000, badge: "Gold chip" },
  { level: 4, name: "Shark", hrpRequired: 5000, badge: "Platinum chip" },
  { level: 5, name: "High Roller", hrpRequired: 15000, badge: "Diamond chip" },
  { level: 6, name: "VIP", hrpRequired: 35000, badge: "Ruby chip" },
  { level: 7, name: "Elite", hrpRequired: 75000, badge: "Sapphire chip" },
  { level: 8, name: "Legend", hrpRequired: 150000, badge: "Emerald chip" },
  { level: 9, name: "Icon", hrpRequired: 300000, badge: "Obsidian chip" },
  { level: 10, name: "Immortal", hrpRequired: 500000, badge: "Holographic chip" },
];

export const HRP_EARN_RATES = {
  handPlayed: 1,
  potWon: 2,
  tournamentHand: 2,
  tournamentFinish: { min: 10, max: 100 }, // scaled by placement
  dailyMission: 25,
  weeklyMission: 100,
  grinderBonus: 50, // 100 hands in a day
  streakBonus: 200, // 7 consecutive days
  referral: 500,
  firstDeposit: 250,
};

export const TIER_HRP_MULTIPLIER: Record<string, number> = {
  free: 1.0, bronze: 1.2, silver: 1.5, gold: 2.0, platinum: 3.0,
};

/**
 * Given a total HRP amount, return the matching loyalty level definition.
 */
export function getLoyaltyLevel(hrp: number) {
  let result = LOYALTY_LEVELS[0];
  for (const lvl of LOYALTY_LEVELS) {
    if (hrp >= lvl.hrpRequired) {
      result = lvl;
    }
  }
  return result;
}

/**
 * Calculate HRP to award after applying the tier multiplier.
 * Returns the final amount (rounded down).
 */
export function calculateHRP(baseAmount: number, tier: string): number {
  const multiplier = TIER_HRP_MULTIPLIER[tier] ?? 1.0;
  return Math.floor(baseAmount * multiplier);
}
