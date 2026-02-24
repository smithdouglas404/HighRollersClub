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

// Default payout structures by player count
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

export function getBlindPreset(name: string): BlindLevel[] {
  switch (name) {
    case "turbo": return TURBO_SNG_SCHEDULE;
    case "mtt": return MTT_SCHEDULE;
    case "standard":
    default: return STANDARD_SNG_SCHEDULE;
  }
}
