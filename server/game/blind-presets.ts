// Blind schedule presets for SNG, Turbo, and MTT formats

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  durationSeconds: number;
}

export interface PayoutEntry {
  place: number;
  percentage: number;
}

// Standard SNG: 10 levels, 5 minutes each
export const STANDARD_SNG_SCHEDULE: BlindLevel[] = [
  { level: 1, sb: 10, bb: 20, ante: 0, durationSeconds: 300 },
  { level: 2, sb: 15, bb: 30, ante: 0, durationSeconds: 300 },
  { level: 3, sb: 25, bb: 50, ante: 5, durationSeconds: 300 },
  { level: 4, sb: 50, bb: 100, ante: 10, durationSeconds: 300 },
  { level: 5, sb: 75, bb: 150, ante: 15, durationSeconds: 300 },
  { level: 6, sb: 100, bb: 200, ante: 20, durationSeconds: 300 },
  { level: 7, sb: 150, bb: 300, ante: 30, durationSeconds: 300 },
  { level: 8, sb: 200, bb: 400, ante: 40, durationSeconds: 300 },
  { level: 9, sb: 300, bb: 600, ante: 60, durationSeconds: 300 },
  { level: 10, sb: 500, bb: 1000, ante: 100, durationSeconds: 300 },
];

// Turbo SNG: 10 levels, 3 minutes each
export const TURBO_SNG_SCHEDULE: BlindLevel[] = [
  { level: 1, sb: 10, bb: 20, ante: 0, durationSeconds: 180 },
  { level: 2, sb: 20, bb: 40, ante: 0, durationSeconds: 180 },
  { level: 3, sb: 30, bb: 60, ante: 5, durationSeconds: 180 },
  { level: 4, sb: 50, bb: 100, ante: 10, durationSeconds: 180 },
  { level: 5, sb: 75, bb: 150, ante: 15, durationSeconds: 180 },
  { level: 6, sb: 100, bb: 200, ante: 25, durationSeconds: 180 },
  { level: 7, sb: 200, bb: 400, ante: 40, durationSeconds: 180 },
  { level: 8, sb: 300, bb: 600, ante: 60, durationSeconds: 180 },
  { level: 9, sb: 500, bb: 1000, ante: 100, durationSeconds: 180 },
  { level: 10, sb: 1000, bb: 2000, ante: 200, durationSeconds: 180 },
];

// MTT: 15 levels, 10 minutes each
export const MTT_SCHEDULE: BlindLevel[] = [
  { level: 1, sb: 10, bb: 20, ante: 0, durationSeconds: 600 },
  { level: 2, sb: 15, bb: 30, ante: 0, durationSeconds: 600 },
  { level: 3, sb: 20, bb: 40, ante: 5, durationSeconds: 600 },
  { level: 4, sb: 25, bb: 50, ante: 5, durationSeconds: 600 },
  { level: 5, sb: 50, bb: 100, ante: 10, durationSeconds: 600 },
  { level: 6, sb: 75, bb: 150, ante: 15, durationSeconds: 600 },
  { level: 7, sb: 100, bb: 200, ante: 20, durationSeconds: 600 },
  { level: 8, sb: 150, bb: 300, ante: 30, durationSeconds: 600 },
  { level: 9, sb: 200, bb: 400, ante: 50, durationSeconds: 600 },
  { level: 10, sb: 300, bb: 600, ante: 60, durationSeconds: 600 },
  { level: 11, sb: 400, bb: 800, ante: 80, durationSeconds: 600 },
  { level: 12, sb: 500, bb: 1000, ante: 100, durationSeconds: 600 },
  { level: 13, sb: 750, bb: 1500, ante: 150, durationSeconds: 600 },
  { level: 14, sb: 1000, bb: 2000, ante: 200, durationSeconds: 600 },
  { level: 15, sb: 2000, bb: 4000, ante: 400, durationSeconds: 600 },
];

// Default payout structures by player count (small fields, <= 18 players)
export function getDefaultPayouts(playerCount: number): PayoutEntry[] {
  if (playerCount <= 2) {
    return [{ place: 1, percentage: 100 }];
  }
  if (playerCount <= 4) {
    return [
      { place: 1, percentage: 65 },
      { place: 2, percentage: 35 },
    ];
  }
  if (playerCount <= 6) {
    return [
      { place: 1, percentage: 50 },
      { place: 2, percentage: 30 },
      { place: 3, percentage: 20 },
    ];
  }
  return [
    { place: 1, percentage: 50 },
    { place: 2, percentage: 30 },
    { place: 3, percentage: 20 },
  ];
}

// Large field payout structure (MTTs with > 18 players)
// Pays top ~15% of the field with a smooth payout curve
export function getLargeFieldPayouts(playerCount: number): PayoutEntry[] {
  const paidPlaces = Math.max(3, Math.floor(playerCount * 0.15));

  // Base payout percentages — top-heavy curve inspired by real MTT structures
  // 1st gets the largest share, decaying smoothly toward min-cash
  if (paidPlaces <= 3) {
    return [
      { place: 1, percentage: 50 },
      { place: 2, percentage: 30 },
      { place: 3, percentage: 20 },
    ];
  }

  if (paidPlaces <= 5) {
    return [
      { place: 1, percentage: 40 },
      { place: 2, percentage: 25 },
      { place: 3, percentage: 17 },
      { place: 4, percentage: 11 },
      { place: 5, percentage: 7 },
    ].slice(0, paidPlaces);
  }

  if (paidPlaces <= 9) {
    const base: PayoutEntry[] = [
      { place: 1, percentage: 30 },
      { place: 2, percentage: 20 },
      { place: 3, percentage: 14 },
      { place: 4, percentage: 10.5 },
      { place: 5, percentage: 8 },
      { place: 6, percentage: 6 },
      { place: 7, percentage: 4.5 },
      { place: 8, percentage: 3.8 },
      { place: 9, percentage: 3.2 },
    ];
    return base.slice(0, paidPlaces);
  }

  // For larger fields (10+ paid places), generate a smooth curve
  // Top 3 get fixed shares, rest follows a geometric decay
  const payouts: PayoutEntry[] = [];
  const topFixed = [
    { place: 1, pct: 25 },
    { place: 2, pct: 16 },
    { place: 3, pct: 11 },
  ];

  let remaining = 100 - topFixed.reduce((s, e) => s + e.pct, 0); // 48%
  const decayPlaces = paidPlaces - topFixed.length;

  // Geometric decay: each place gets ratio * previous place
  // Sum of geometric series: a * (1 - r^n) / (1 - r) = remaining
  // We pick r = 0.75 and solve for a
  const ratio = 0.75;
  const geoSum = (1 - Math.pow(ratio, decayPlaces)) / (1 - ratio);
  const firstPct = remaining / geoSum;

  for (const f of topFixed) {
    payouts.push({ place: f.place, percentage: Math.round(f.pct * 100) / 100 });
  }

  for (let i = 0; i < decayPlaces; i++) {
    const pct = firstPct * Math.pow(ratio, i);
    payouts.push({
      place: topFixed.length + 1 + i,
      percentage: Math.round(pct * 100) / 100,
    });
  }

  // Normalize to exactly 100%
  const total = payouts.reduce((s, p) => s + p.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    const diff = 100 - total;
    // Adjust 1st place to absorb rounding error
    payouts[0].percentage = Math.round((payouts[0].percentage + diff) * 100) / 100;
  }

  return payouts;
}

export function getBlindPreset(name: string): BlindLevel[] {
  switch (name) {
    case "turbo": return TURBO_SNG_SCHEDULE;
    case "mtt": return MTT_SCHEDULE;
    case "standard":
    default: return STANDARD_SNG_SCHEDULE;
  }
}
