export const TABLE_SEATS = [
  { x: 50.0, y: 90.0, scale: 1.0 },  // 0: Hero (6 o'clock — bottom center)
  { x: 22.0, y: 80.0, scale: 1.0 },  // 1: bottom-left (7 o'clock)
  { x: 10.0, y: 55.0, scale: 1.0 },  // 2: left (9 o'clock)
  { x: 18.0, y: 28.0, scale: 1.0 },  // 3: top-left (11 o'clock)
  { x: 35.0, y: 14.0, scale: 1.0 },  // 4: top-left-center
  { x: 50.0, y: 8.0,  scale: 1.0 },  // 5: top-center (12 o'clock)
  { x: 65.0, y: 14.0, scale: 1.0 },  // 6: top-right-center
  { x: 82.0, y: 28.0, scale: 1.0 },  // 7: top-right (1 o'clock)
  { x: 90.0, y: 55.0, scale: 1.0 },  // 8: right (3 o'clock)
  { x: 78.0, y: 80.0, scale: 1.0 },  // 9: bottom-right (5 o'clock)
];

export const DEALER_POSITIONS = [
  { x: 50.0, y: 78 },
  { x: 30,   y: 72 },
  { x: 20,   y: 52 },
  { x: 26,   y: 34 },
  { x: 40,   y: 22 },
  { x: 50,   y: 18 },
  { x: 60,   y: 22 },
  { x: 74,   y: 34 },
  { x: 80,   y: 52 },
  { x: 70,   y: 72 },
];

export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_CONFIG = {
  low: { shadows: false, particles: 0, antialias: false, shadowMapSize: 512, dpr: 1, bloom: false, ao: false },
  medium: { shadows: true, particles: 25, antialias: true, shadowMapSize: 1024, dpr: 1.5, bloom: true, ao: false },
  high: { shadows: true, particles: 50, antialias: true, shadowMapSize: 2048, dpr: 2, bloom: true, ao: true },
};
