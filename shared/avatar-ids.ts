// Single source of truth for avatar IDs available in the platform
export const AVATAR_IDS = [
  "neon-viper", "chrome-siren", "gold-phantom", "shadow-king",
  "red-wolf", "ice-queen", "tech-monk", "cyber-punk",
  "steel-ghost", "neon-fox", "dark-ace", "bolt-runner",
] as const;

export type AvatarId = typeof AVATAR_IDS[number];

export function randomAvatarId(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}
