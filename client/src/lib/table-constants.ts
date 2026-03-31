// Positions locked to the 10 cyan square slots on the circular table image
// Image is 1:1 square. Positions are % of the table container.
export const TABLE_SEATS = [
  { x: 50, y: 88, scale: 1.0 },  // 0: Hero (6 o'clock)
  { x: 20, y: 80, scale: 1.0 },  // 1: bottom-left (7 o'clock)
  { x: 6,  y: 50, scale: 1.0 },  // 2: left (9 o'clock)
  { x: 20, y: 20, scale: 1.0 },  // 3: top-left (11 o'clock)
  { x: 38, y: 7,  scale: 1.0 },  // 4: top-left-center (10 o'clock)
  { x: 50, y: 3,  scale: 1.0 },  // 5: top-center (12 o'clock)
  { x: 62, y: 7,  scale: 1.0 },  // 6: top-right-center (2 o'clock)
  { x: 80, y: 20, scale: 1.0 },  // 7: top-right (1 o'clock)
  { x: 94, y: 50, scale: 1.0 },  // 8: right (3 o'clock)
  { x: 80, y: 80, scale: 1.0 },  // 9: bottom-right (5 o'clock)
];

export const DEALER_POSITIONS = [
  { x: 50, y: 76 },
  { x: 30, y: 72 },
  { x: 18, y: 50 },
  { x: 30, y: 28 },
  { x: 44, y: 18 },
  { x: 52, y: 15 },
  { x: 56, y: 18 },
  { x: 70, y: 28 },
  { x: 82, y: 50 },
  { x: 70, y: 72 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
