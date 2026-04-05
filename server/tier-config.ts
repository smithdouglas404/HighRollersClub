// ─── Central Tier Configuration ─────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all tier data across the entire platform.
// Every file that needs tier values MUST import from here.

export const TIER_ORDER = ["free", "bronze", "silver", "gold", "platinum"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface TierDefinition {
  id: string;
  name: string;
  monthlyPrice: number;           // cents
  annualPrice: number;            // cents
  kycLevel: string;
  depositLimitDaily: number;      // cents (0 = no deposits)
  withdrawLimitWeekly: number;    // cents
  maxBigBlind: number;            // 0 = play chips only for free, 0 = unlimited for platinum
  tournamentBuyInMax: number;     // 0 = freerolls only for free, 0 = unlimited for gold+
  rakebackPercent: number;
  dailyBonus: number;             // chips
  clubCreateLimit: number;        // 0 = can't create, -1 = unlimited
  clubMemberLimit: number;        // 0 = can't create, -1 = unlimited
  multiTableLimit: number;
  marketplaceFeePercent: number;  // 0.029 = 2.9%
  benefits: string[];
}

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: "free", name: "Free", monthlyPrice: 0, annualPrice: 0,
    kycLevel: "email",
    depositLimitDaily: 0,
    withdrawLimitWeekly: 0,
    maxBigBlind: 0,
    tournamentBuyInMax: 0,
    rakebackPercent: 0,
    dailyBonus: 500,
    clubCreateLimit: 0,
    clubMemberLimit: 0,
    multiTableLimit: 1,
    marketplaceFeePercent: 0.029,
    benefits: [
      "Play-chip tables only",
      "Email verification",
      "Daily bonus: 500 chips",
      "Basic statistics",
      "Freeroll tournaments only",
      "Join clubs (cannot create)",
      "1 table at a time",
    ],
  },
  {
    id: "bronze", name: "Bronze", monthlyPrice: 499, annualPrice: 4799,
    kycLevel: "basic",
    depositLimitDaily: 20000,
    withdrawLimitWeekly: 50000,
    maxBigBlind: 10,
    tournamentBuyInMax: 2500,
    rakebackPercent: 0,
    dailyBonus: 1000,
    clubCreateLimit: 1,
    clubMemberLimit: 25,
    multiTableLimit: 1,
    marketplaceFeePercent: 0.029,
    benefits: [
      "Real-money micro stakes (up to 5/10)",
      "Passive liveness + face match KYC",
      "$200/day deposit, $500/week withdraw",
      "Daily bonus: 1,000 chips",
      "Tournament buy-ins up to $25",
      "Create 1 club (25 members max)",
      "1 table at a time",
      "Everything in Free",
    ],
  },
  {
    id: "silver", name: "Silver", monthlyPrice: 1499, annualPrice: 14399,
    kycLevel: "standard",
    depositLimitDaily: 100000,
    withdrawLimitWeekly: 250000,
    maxBigBlind: 50,
    tournamentBuyInMax: 20000,
    rakebackPercent: 10,
    dailyBonus: 2500,
    clubCreateLimit: 3,
    clubMemberLimit: 100,
    multiTableLimit: 4,
    marketplaceFeePercent: 0.029,
    benefits: [
      "Mid stakes (up to 25/50)",
      "Phone + age estimation KYC",
      "$1,000/day deposit, $2,500/week withdraw",
      "10% rakeback",
      "Daily bonus: 2,500 chips",
      "Tournament buy-ins up to $200",
      "Create up to 3 clubs (100 members each)",
      "Multi-table up to 4 tables",
      "Everything in Bronze",
    ],
  },
  {
    id: "gold", name: "Gold", monthlyPrice: 2999, annualPrice: 28799,
    kycLevel: "full",
    depositLimitDaily: 500000,
    withdrawLimitWeekly: 1000000,
    maxBigBlind: 400,
    tournamentBuyInMax: 0,
    rakebackPercent: 20,
    dailyBonus: 5000,
    clubCreateLimit: 5,
    clubMemberLimit: 500,
    multiTableLimit: 4,
    marketplaceFeePercent: 0.029,
    benefits: [
      "High stakes (up to 200/400)",
      "Full ID + address + AML verification",
      "$5,000/day deposit, $10,000/week withdraw",
      "20% rakeback",
      "Daily bonus: 5,000 chips",
      "Unlimited tournament buy-ins",
      "Create up to 5 clubs (500 members each)",
      "Multi-table up to 4 tables",
      "Everything in Silver",
    ],
  },
  {
    id: "platinum", name: "Platinum", monthlyPrice: 7999, annualPrice: 76799,
    kycLevel: "enhanced",
    depositLimitDaily: 2500000,
    withdrawLimitWeekly: 5000000,
    maxBigBlind: 0,
    tournamentBuyInMax: 0,
    rakebackPercent: 30,
    dailyBonus: 10000,
    clubCreateLimit: -1,
    clubMemberLimit: -1,
    multiTableLimit: 8,
    marketplaceFeePercent: 0.02,
    benefits: [
      "Unlimited stakes",
      "NFC + biometric + database KYC",
      "$25,000/day deposit, $50,000/week withdraw",
      "30% rakeback",
      "Daily bonus: 10,000 chips",
      "Unlimited tournament buy-ins",
      "Unlimited clubs & members",
      "Multi-table up to 8 tables",
      "Priority table seating",
      "Everything in Gold",
    ],
  },
];

/** Look up a tier definition by id. Returns the free tier if not found. */
export function getTierDef(tierId: string): TierDefinition {
  return TIER_DEFINITIONS.find(t => t.id === tierId) || TIER_DEFINITIONS[0];
}

/** Return the numeric rank of a tier (0 = free, 4 = platinum). */
export function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier as Tier);
  return idx >= 0 ? idx : 0;
}
