// Pixel-perfect positions measured from the 512x512 Gemini table image
// Each position is the CENTER of a cyan square slot, as % of image dimensions
export const TABLE_SEATS = [
  { x: 50.0, y: 87.9, scale: 1.0 },  // 0: Hero (6 o'clock)
  { x: 20.5, y: 78.1, scale: 1.0 },  // 1: bottom-left (7 o'clock)
  { x: 7.4,  y: 50.0, scale: 1.0 },  // 2: left (9 o'clock)
  { x: 20.5, y: 21.5, scale: 1.0 },  // 3: top-left (11 o'clock)
  { x: 38.1, y: 8.2,  scale: 1.0 },  // 4: top-left-center
  { x: 50.0, y: 4.3,  scale: 1.0 },  // 5: top-center (12 o'clock)
  { x: 62.1, y: 8.2,  scale: 1.0 },  // 6: top-right-center
  { x: 79.7, y: 21.5, scale: 1.0 },  // 7: top-right (1 o'clock)
  { x: 92.8, y: 50.0, scale: 1.0 },  // 8: right (3 o'clock)
  { x: 79.7, y: 78.1, scale: 1.0 },  // 9: bottom-right (5 o'clock)
];

// Dealer button sits between the seat and the felt center
export const DEALER_POSITIONS = [
  { x: 50.0, y: 76 },
  { x: 29,   y: 70 },
  { x: 18,   y: 50 },
  { x: 29,   y: 30 },
  { x: 42,   y: 17 },
  { x: 50,   y: 14 },
  { x: 58,   y: 17 },
  { x: 71,   y: 30 },
  { x: 82,   y: 50 },
  { x: 71,   y: 70 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
