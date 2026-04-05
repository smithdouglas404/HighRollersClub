import { getDb, hasDatabase } from "./db";
import { users, playerStats, hrpTransactions, achievements, userAchievements, referrals, shopItems, userInventory, battlePasses, userBattlePasses, battlePassRewards } from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { storage } from "./storage";

// ─── Loyalty Level Definitions ──────────────────────────────────────────────
export const LOYALTY_LEVELS = [
  { level: 1, name: "Rookie", hrpRequired: 0, badge: "bronze-chip" },
  { level: 2, name: "Regular", hrpRequired: 500, badge: "silver-chip" },
  { level: 3, name: "Grinder", hrpRequired: 2000, badge: "gold-chip" },
  { level: 4, name: "Shark", hrpRequired: 5000, badge: "platinum-chip" },
  { level: 5, name: "High Roller", hrpRequired: 15000, badge: "diamond-chip" },
  { level: 6, name: "VIP", hrpRequired: 35000, badge: "ruby-chip" },
  { level: 7, name: "Elite", hrpRequired: 75000, badge: "sapphire-chip" },
  { level: 8, name: "Legend", hrpRequired: 150000, badge: "emerald-chip" },
  { level: 9, name: "Icon", hrpRequired: 300000, badge: "obsidian-chip" },
  { level: 10, name: "Immortal", hrpRequired: 500000, badge: "holographic-chip" },
];

// HRP multiplier by subscription tier
export const TIER_HRP_MULTIPLIER: Record<string, number> = {
  free: 1.0, bronze: 1.2, silver: 1.5, gold: 2.0, platinum: 3.0,
};

// Achievement definitions
export const ACHIEVEMENT_DEFINITIONS = [
  // Poker achievements
  { key: "first_blood", name: "First Blood", description: "Win your first hand", category: "poker", requirementType: "pots_won", requirementValue: 1, hrpReward: 100, chipReward: 0 },
  { key: "century", name: "Century", description: "Play 100 hands", category: "poker", requirementType: "hands_played", requirementValue: 100, hrpReward: 200, chipReward: 500 },
  { key: "millennium", name: "Millennium", description: "Play 1,000 hands", category: "poker", requirementType: "hands_played", requirementValue: 1000, hrpReward: 500, chipReward: 2000 },
  { key: "iron_player", name: "Iron Player", description: "Play 10,000 hands", category: "poker", requirementType: "hands_played", requirementValue: 10000, hrpReward: 2000, chipReward: 5000 },
  { key: "the_grind", name: "The Grind", description: "Play 100,000 hands", category: "poker", requirementType: "hands_played", requirementValue: 100000, hrpReward: 10000, chipReward: 25000 },
  { key: "royal_flush", name: "Royal Flush", description: "Hit a royal flush", category: "poker", requirementType: "royal_flush", requirementValue: 1, hrpReward: 1000, chipReward: 5000 },
  { key: "straight_flush", name: "Straight Flush", description: "Hit a straight flush", category: "poker", requirementType: "straight_flush", requirementValue: 1, hrpReward: 500, chipReward: 2000 },
  { key: "bluff_master", name: "Bluff Master", description: "Win 10 showdowns with bottom pair or worse", category: "poker", requirementType: "bluff_wins", requirementValue: 10, hrpReward: 750, chipReward: 1000 },
  { key: "win_streak_5", name: "Hot Streak", description: "Win 5 hands in a row", category: "poker", requirementType: "best_win_streak", requirementValue: 5, hrpReward: 300, chipReward: 500 },
  { key: "win_streak_10", name: "On Fire", description: "Win 10 hands in a row", category: "poker", requirementType: "best_win_streak", requirementValue: 10, hrpReward: 750, chipReward: 2000 },
  // Tournament achievements
  { key: "first_tournament", name: "Tournament Virgin", description: "Play your first tournament", category: "tournament", requirementType: "tournament_hands", requirementValue: 1, hrpReward: 100, chipReward: 0 },
  { key: "champion", name: "Champion", description: "Win a tournament", category: "tournament", requirementType: "sng_wins", requirementValue: 1, hrpReward: 1000, chipReward: 3000 },
  { key: "road_to_glory", name: "Road to Glory", description: "Win 10 tournaments", category: "tournament", requirementType: "sng_wins", requirementValue: 10, hrpReward: 5000, chipReward: 10000 },
  // Social achievements
  { key: "collector_10", name: "Collector", description: "Own 10 shop items", category: "collection", requirementType: "items_owned", requirementValue: 10, hrpReward: 200, chipReward: 0 },
  { key: "collector_25", name: "Curator", description: "Own 25 shop items", category: "collection", requirementType: "items_owned", requirementValue: 25, hrpReward: 500, chipReward: 0 },
  { key: "collector_50", name: "Hoarder", description: "Own 50 shop items", category: "collection", requirementType: "items_owned", requirementValue: 50, hrpReward: 1000, chipReward: 0 },
];

// Daily login reward cycle (7 days)
export const DAILY_LOGIN_REWARDS = [
  { day: 1, chips: 500, hrp: 25 },
  { day: 2, chips: 750, hrp: 25 },
  { day: 3, chips: 1000, hrp: 50 },
  { day: 4, chips: 1250, hrp: 50 },  // + random common cosmetic
  { day: 5, chips: 1500, hrp: 75 },
  { day: 6, chips: 2000, hrp: 75 },  // + random uncommon cosmetic
  { day: 7, chips: 3000, hrp: 150 }, // + random rare cosmetic
];

// Referral milestones
export const REFERRAL_MILESTONES = [
  { milestone: "signup", referrerHrp: 100, referrerChips: 0, referredHrp: 100, referredChips: 0 },
  { milestone: "100_hands", referrerHrp: 500, referrerChips: 2000, referredHrp: 0, referredChips: 1000 },
  { milestone: "first_deposit", referrerHrp: 1000, referrerChips: 5000, referredHrp: 0, referredChips: 2500 },
  { milestone: "level_3", referrerHrp: 2000, referrerChips: 0, referredHrp: 0, referredChips: 0 },
];

// ─── Helper: get stat value by requirement type ─────────────────────────────
function getStatValue(stats: any, requirementType: string, itemsOwned: number): number {
  switch (requirementType) {
    case "hands_played": return Number(stats.handsPlayed ?? 0);
    case "pots_won": return Number(stats.potsWon ?? 0);
    case "best_win_streak": return Number(stats.bestWinStreak ?? 0);
    case "bluff_wins": return Number(stats.bluffWins ?? 0);
    case "tournament_hands": return Number(stats.tournamentHands ?? 0);
    case "sng_wins": return Number(stats.sngWins ?? 0);
    case "items_owned": return itemsOwned;
    // These are tracked as special stat columns or via separate counters
    case "royal_flush": return 0; // tracked via separate event, not in playerStats
    case "straight_flush": return 0;
    default: return 0;
  }
}

// ─── Calculate loyalty level from total HRP ─────────────────────────────────
export function getLoyaltyLevel(totalHrp: number): typeof LOYALTY_LEVELS[0] {
  let result = LOYALTY_LEVELS[0];
  for (const level of LOYALTY_LEVELS) {
    if (totalHrp >= level.hrpRequired) {
      result = level;
    } else {
      break;
    }
  }
  return result;
}

// ─── Award HRP to a user ────────────────────────────────────────────────────
export async function awardHRP(
  userId: string,
  baseAmount: number,
  source: string,
  description: string,
): Promise<{ hrpAwarded: number; newTotal: number; leveledUp: boolean; newLevel: number }> {
  if (!hasDatabase()) {
    return { hrpAwarded: 0, newTotal: 0, leveledUp: false, newLevel: 1 };
  }

  const db = getDb();

  // Get the user to determine tier multiplier and current points
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { hrpAwarded: 0, newTotal: 0, leveledUp: false, newLevel: 1 };
  }

  const multiplier = TIER_HRP_MULTIPLIER[user.tier] ?? 1.0;
  const hrpAwarded = Math.floor(baseAmount * multiplier);
  const oldTotal = Number(user.loyaltyPoints ?? 0);
  const newTotal = oldTotal + hrpAwarded;
  const oldLevel = getLoyaltyLevel(oldTotal);
  const newLevelObj = getLoyaltyLevel(newTotal);
  const leveledUp = newLevelObj.level > oldLevel.level;

  // Update user's loyalty points and level
  await db.update(users).set({
    loyaltyPoints: newTotal,
    loyaltyLevel: newLevelObj.level,
  }).where(eq(users.id, userId));

  // Log the HRP transaction
  await db.insert(hrpTransactions).values({
    userId,
    amount: hrpAwarded,
    source,
    description,
    balanceAfter: newTotal,
  });

  // If leveled up, award free items for the new level
  if (leveledUp) {
    // Award level-up bonus HRP transaction (informational)
    const levelUpBonus = newLevelObj.level * 100;
    const totalAfterBonus = newTotal + levelUpBonus;

    await db.update(users).set({
      loyaltyPoints: totalAfterBonus,
    }).where(eq(users.id, userId));

    await db.insert(hrpTransactions).values({
      userId,
      amount: levelUpBonus,
      source: "level_up",
      description: `Level up bonus for reaching ${newLevelObj.name} (level ${newLevelObj.level})`,
      balanceAfter: totalAfterBonus,
    });

    // Award free shop items that are earnable at this level
    try {
      const freeItems = await db
        .select()
        .from(shopItems)
        .where(eq(shopItems.earnableAtLevel, newLevelObj.level));

      for (const item of freeItems) {
        // Check if user already owns this item
        const [existing] = await db
          .select()
          .from(userInventory)
          .where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, item.id)))
          .limit(1);

        if (!existing) {
          await db.insert(userInventory).values({
            userId,
            itemId: item.id,
          });
        }
      }
    } catch (err) {
      console.error("[loyalty] Error awarding level-up items:", err);
    }

    return { hrpAwarded: hrpAwarded + levelUpBonus, newTotal: totalAfterBonus, leveledUp: true, newLevel: newLevelObj.level };
  }

  return { hrpAwarded, newTotal, leveledUp: false, newLevel: newLevelObj.level };
}

// ─── Process hand completion rewards ────────────────────────────────────────
export async function processHandRewards(
  userId: string,
  isTournament: boolean,
  wonPot: boolean,
): Promise<void> {
  if (!hasDatabase()) return;

  const baseHrp = isTournament ? 2 : 1;
  const potBonus = wonPot ? 2 : 0;
  const totalBase = baseHrp + potBonus;

  const desc = wonPot
    ? `Hand completed${isTournament ? " (tournament)" : ""} + pot win bonus`
    : `Hand completed${isTournament ? " (tournament)" : ""}`;

  await awardHRP(userId, totalBase, wonPot ? "pot_won" : "hand_played", desc);
}

// ─── Check and update achievement progress ──────────────────────────────────
export async function checkAchievements(userId: string): Promise<string[]> {
  if (!hasDatabase()) return [];

  const db = getDb();
  const newlyUnlocked: string[] = [];

  // Get player stats
  const [stats] = await db.select().from(playerStats).where(eq(playerStats.userId, userId)).limit(1);
  if (!stats) return [];

  // Count items owned for collection achievements
  const [inventoryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userInventory)
    .where(eq(userInventory.userId, userId));
  const itemsOwned = Number(inventoryCount?.count ?? 0);

  // Ensure all achievement definitions exist in the DB
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    try {
      const [existing] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.key, def.key))
        .limit(1);

      if (!existing) {
        await db.insert(achievements).values({
          key: def.key,
          name: def.name,
          description: def.description,
          category: def.category,
          requirementType: def.requirementType,
          requirementValue: def.requirementValue,
          hrpReward: def.hrpReward,
          chipReward: def.chipReward,
          isActive: true,
        });
      }
    } catch (err) {
      // Ignore duplicate key errors from race conditions
    }
  }

  // Get all active achievements
  const allAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.isActive, true));

  // Get user's existing achievement records
  const userAchievementRecords = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const achievementMap = new Map(userAchievementRecords.map(ua => [ua.achievementId, ua]));

  for (const achievement of allAchievements) {
    const currentProgress = getStatValue(stats, achievement.requirementType, itemsOwned);
    const userRecord = achievementMap.get(achievement.id);

    if (userRecord) {
      // Already unlocked - skip
      if (userRecord.unlockedAt) continue;

      // Update progress
      if (currentProgress !== userRecord.progress) {
        await db.update(userAchievements).set({
          progress: currentProgress,
          ...(currentProgress >= achievement.requirementValue ? { unlockedAt: new Date() } : {}),
        }).where(eq(userAchievements.id, userRecord.id));

        if (currentProgress >= achievement.requirementValue) {
          newlyUnlocked.push(achievement.key);
        }
      }
    } else {
      // Create new user achievement record
      const isUnlocked = currentProgress >= achievement.requirementValue;
      await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
        progress: currentProgress,
        unlockedAt: isUnlocked ? new Date() : null,
      });

      if (isUnlocked) {
        newlyUnlocked.push(achievement.key);
      }
    }
  }

  return newlyUnlocked;
}

// ─── Claim daily login reward ───────────────────────────────────────────────
export async function claimDailyLogin(
  userId: string,
): Promise<{ chips: number; hrp: number; day: number; streakMultiplier: number } | null> {
  if (!hasDatabase()) return null;

  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const now = new Date();
  const lastReward = user.lastLoginRewardAt;

  // Check if already claimed today
  if (lastReward) {
    const lastDate = new Date(lastReward);
    const sameDay =
      lastDate.getUTCFullYear() === now.getUTCFullYear() &&
      lastDate.getUTCMonth() === now.getUTCMonth() &&
      lastDate.getUTCDate() === now.getUTCDate();

    if (sameDay) return null; // Already claimed today
  }

  // Determine streak: if last claim was yesterday, increment; otherwise reset to 1
  let streak = 1;
  if (lastReward) {
    const lastDate = new Date(lastReward);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const wasYesterday =
      lastDate.getUTCFullYear() === yesterday.getUTCFullYear() &&
      lastDate.getUTCMonth() === yesterday.getUTCMonth() &&
      lastDate.getUTCDate() === yesterday.getUTCDate();

    if (wasYesterday) {
      streak = (Number(user.dailyLoginStreak) || 0) + 1;
    }
  }

  // Determine which day in the 7-day cycle
  const dayIndex = ((streak - 1) % 7);
  const reward = DAILY_LOGIN_REWARDS[dayIndex];

  // Streak multiplier: +10% per consecutive week (max 2.0x)
  const weeksComplete = Math.floor((streak - 1) / 7);
  const streakMultiplier = Math.min(1.0 + weeksComplete * 0.1, 2.0);

  const chipReward = Math.floor(reward.chips * streakMultiplier);
  const hrpReward = Math.floor(reward.hrp * streakMultiplier);

  // Update user streak and last claim time
  await db.update(users).set({
    dailyLoginStreak: streak,
    lastLoginRewardAt: now,
  }).where(eq(users.id, userId));

  // Award chips
  try {
    await storage.ensureWallets(userId);
    await storage.atomicAddToWallet(userId, "bonus", chipReward);
    await storage.atomicAddChips(userId, chipReward);
  } catch (err) {
    console.error("[loyalty] Error awarding daily login chips:", err);
  }

  // Award HRP
  await awardHRP(userId, hrpReward, "daily_login", `Daily login reward (day ${dayIndex + 1}, streak ${streak})`);

  return {
    chips: chipReward,
    hrp: hrpReward,
    day: dayIndex + 1,
    streakMultiplier,
  };
}

// ─── Process referral milestone ─────────────────────────────────────────────
export async function checkReferralMilestone(
  referredUserId: string,
  milestone: string,
): Promise<void> {
  if (!hasDatabase()) return;

  const db = getDb();

  // Find the referred user to get their referrer
  const [referredUser] = await db.select().from(users).where(eq(users.id, referredUserId)).limit(1);
  if (!referredUser || !referredUser.referredBy) return;

  // Look up the referrer by referral code
  const [referrer] = await db
    .select()
    .from(users)
    .where(eq(users.referralCode, referredUser.referredBy))
    .limit(1);
  if (!referrer) return;

  // Find the milestone definition
  const milestoneDef = REFERRAL_MILESTONES.find(m => m.milestone === milestone);
  if (!milestoneDef) return;

  // Check if this milestone was already completed
  const [existingReferral] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrer.id),
        eq(referrals.referredId, referredUserId),
        eq(referrals.milestone, milestone),
      ),
    )
    .limit(1);

  if (existingReferral) return; // Already completed

  // Record the referral milestone
  await db.insert(referrals).values({
    referrerId: referrer.id,
    referredId: referredUserId,
    milestone,
    referrerHrpReward: milestoneDef.referrerHrp,
    referrerChipReward: milestoneDef.referrerChips,
    referredHrpReward: milestoneDef.referredHrp,
    referredChipReward: milestoneDef.referredChips,
    completedAt: new Date(),
  });

  // Award referrer HRP
  if (milestoneDef.referrerHrp > 0) {
    await awardHRP(referrer.id, milestoneDef.referrerHrp, "referral", `Referral milestone: ${milestone}`);
  }

  // Award referrer chips
  if (milestoneDef.referrerChips > 0) {
    try {
      await storage.ensureWallets(referrer.id);
      await storage.atomicAddToWallet(referrer.id, "bonus", milestoneDef.referrerChips);
      await storage.atomicAddChips(referrer.id, milestoneDef.referrerChips);
    } catch (err) {
      console.error("[loyalty] Error awarding referrer chips:", err);
    }
  }

  // Award referred user HRP
  if (milestoneDef.referredHrp > 0) {
    await awardHRP(referredUserId, milestoneDef.referredHrp, "referral", `Referral bonus: ${milestone}`);
  }

  // Award referred user chips
  if (milestoneDef.referredChips > 0) {
    try {
      await storage.ensureWallets(referredUserId);
      await storage.atomicAddToWallet(referredUserId, "bonus", milestoneDef.referredChips);
      await storage.atomicAddChips(referredUserId, milestoneDef.referredChips);
    } catch (err) {
      console.error("[loyalty] Error awarding referred user chips:", err);
    }
  }
}

// ─── Get user's full loyalty profile ────────────────────────────────────────
export async function getLoyaltyProfile(userId: string): Promise<{
  points: number;
  level: number;
  levelName: string;
  nextLevel: typeof LOYALTY_LEVELS[0] | null;
  pointsToNextLevel: number;
  progressPercent: number;
  multiplier: number;
  dailyStreak: number;
  achievements: any[];
  recentHrp: any[];
}> {
  const defaults = {
    points: 0,
    level: 1,
    levelName: "Rookie",
    nextLevel: LOYALTY_LEVELS[1],
    pointsToNextLevel: 500,
    progressPercent: 0,
    multiplier: 1.0,
    dailyStreak: 0,
    achievements: [],
    recentHrp: [],
  };

  if (!hasDatabase()) return defaults;

  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return defaults;

  const totalHrp = Number(user.loyaltyPoints ?? 0);
  const currentLevel = getLoyaltyLevel(totalHrp);
  const nextLevelIdx = LOYALTY_LEVELS.findIndex(l => l.level === currentLevel.level + 1);
  const nextLevel = nextLevelIdx >= 0 ? LOYALTY_LEVELS[nextLevelIdx] : null;

  const pointsToNextLevel = nextLevel ? nextLevel.hrpRequired - totalHrp : 0;
  let progressPercent = 0;
  if (nextLevel) {
    const rangeStart = currentLevel.hrpRequired;
    const rangeEnd = nextLevel.hrpRequired;
    const rangeSize = rangeEnd - rangeStart;
    progressPercent = rangeSize > 0 ? Math.floor(((totalHrp - rangeStart) / rangeSize) * 100) : 100;
  } else {
    progressPercent = 100; // Max level
  }

  const multiplier = TIER_HRP_MULTIPLIER[user.tier] ?? 1.0;

  // Get user achievements with definitions
  const userAchievementRows = await db
    .select({
      id: userAchievements.id,
      achievementId: userAchievements.achievementId,
      progress: userAchievements.progress,
      unlockedAt: userAchievements.unlockedAt,
      claimedAt: userAchievements.claimedAt,
      key: achievements.key,
      name: achievements.name,
      description: achievements.description,
      category: achievements.category,
      requirementType: achievements.requirementType,
      requirementValue: achievements.requirementValue,
      hrpReward: achievements.hrpReward,
      chipReward: achievements.chipReward,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId));

  // Get recent HRP transactions
  const recentHrp = await db
    .select()
    .from(hrpTransactions)
    .where(eq(hrpTransactions.userId, userId))
    .orderBy(desc(hrpTransactions.createdAt))
    .limit(20);

  return {
    points: totalHrp,
    level: currentLevel.level,
    levelName: currentLevel.name,
    nextLevel,
    pointsToNextLevel: Math.max(0, pointsToNextLevel),
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    multiplier,
    dailyStreak: Number(user.dailyLoginStreak ?? 0),
    achievements: userAchievementRows,
    recentHrp,
  };
}
