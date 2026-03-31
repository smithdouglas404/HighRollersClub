// Positions mapped to the 10 cyan square slots on the circular table image
// The image is 1:1 square with slots arranged clockwise from bottom-center
export const TABLE_SEATS = [
  { x: 50, y: 90, scale: 1.0 },  // 0: Hero (bottom center - 6 o'clock)
  { x: 18, y: 78, scale: 1.0 },  // 1: bottom-left (7-8 o'clock)
  { x: 4,  y: 50, scale: 1.0 },  // 2: left (9 o'clock)
  { x: 18, y: 22, scale: 1.0 },  // 3: top-left (10-11 o'clock)
  { x: 36, y: 6,  scale: 1.0 },  // 4: top-left-center (11 o'clock)
  { x: 50, y: 2,  scale: 1.0 },  // 5: top-center (12 o'clock)
  { x: 64, y: 6,  scale: 1.0 },  // 6: top-right-center (1 o'clock)
  { x: 82, y: 22, scale: 1.0 },  // 7: top-right (1-2 o'clock)
  { x: 96, y: 50, scale: 1.0 },  // 8: right (3 o'clock)
  { x: 82, y: 78, scale: 1.0 },  // 9: bottom-right (4-5 o'clock)
];

export const DEALER_POSITIONS = [
  { x: 50, y: 78 },
  { x: 28, y: 70 },
  { x: 16, y: 50 },
  { x: 28, y: 30 },
  { x: 42, y: 18 },
  { x: 52, y: 15 },
  { x: 58, y: 18 },
  { x: 72, y: 30 },
  { x: 84, y: 50 },
  { x: 72, y: 70 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
