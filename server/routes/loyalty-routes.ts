import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { sql as defaultSql, eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  users,
  achievements,
  userAchievements,
  hrpTransactions,
  battlePasses,
  battlePassRewards,
  userBattlePasses,
  referrals,
  userInventory,
} from "@shared/schema";
import {
  LOYALTY_LEVELS,
  ACHIEVEMENT_DEFINITIONS,
  DAILY_LOGIN_REWARDS,
  REFERRAL_MILESTONES,
  getLoyaltyLevel,
  getLoyaltyProfile,
  claimDailyLogin,
  awardHRP,
  checkAchievements,
  checkReferralMilestone,
} from "../loyalty-engine";

export interface LoyaltyHelpers {
  hasDatabase: () => boolean;
  getDb: () => any;
  sql: typeof defaultSql;
}

export async function registerLoyaltyRoutes(
  app: Express,
  requireAuth: RequestHandler,
  helpers: LoyaltyHelpers,
) {
  const { hasDatabase, getDb, sql } = helpers;

  // ─── GET /api/loyalty/profile ─────────────────────────────────────────────
  // Get full loyalty profile (HRP, level, achievements, etc.)
  app.get("/api/loyalty/profile", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const profile = await getLoyaltyProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/loyalty/achievements ────────────────────────────────────────
  // Get all achievements with user's progress
  app.get("/api/loyalty/achievements", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        // Return achievement definitions with zero progress
        return res.json(
          ACHIEVEMENT_DEFINITIONS.map(def => ({
            ...def,
            progress: 0,
            unlocked: false,
            claimed: false,
          })),
        );
      }

      const db = getDb();

      // Ensure achievements exist in DB
      await checkAchievements(userId);

      // Fetch all achievements with user progress
      const allAchievements = await db.select().from(achievements).where(eq(achievements.isActive, true));

      const userRecords = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId));

      const userMap = new Map(userRecords.map((r: any) => [r.achievementId, r]));

      const result = allAchievements.map((ach: any) => {
        const userRecord = userMap.get(ach.id);
        return {
          id: ach.id,
          key: ach.key,
          name: ach.name,
          description: ach.description,
          category: ach.category,
          requirementType: ach.requirementType,
          requirementValue: ach.requirementValue,
          hrpReward: ach.hrpReward,
          chipReward: ach.chipReward,
          badgeImageUrl: ach.badgeImageUrl,
          rarity: ach.rarity,
          progress: userRecord?.progress ?? 0,
          unlocked: !!userRecord?.unlockedAt,
          unlockedAt: userRecord?.unlockedAt ?? null,
          claimed: !!userRecord?.claimedAt,
          claimedAt: userRecord?.claimedAt ?? null,
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /api/loyalty/achievements/:id/claim ────────────────────────────
  // Claim an unlocked achievement reward
  app.post("/api/loyalty/achievements/:id/claim", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const achievementId = req.params.id;

      if (!hasDatabase()) {
        return res.status(400).json({ message: "Database not available" });
      }

      const db = getDb();

      // Get the user achievement record
      const [userAch] = await db
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, userId),
            eq(userAchievements.achievementId, achievementId),
          ),
        )
        .limit(1);

      if (!userAch) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      if (!userAch.unlockedAt) {
        return res.status(400).json({ message: "Achievement not yet unlocked" });
      }

      if (userAch.claimedAt) {
        return res.status(400).json({ message: "Achievement reward already claimed" });
      }

      // Get the achievement definition
      const [ach] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, achievementId))
        .limit(1);

      if (!ach) {
        return res.status(404).json({ message: "Achievement definition not found" });
      }

      // Mark as claimed
      await db.update(userAchievements).set({
        claimedAt: new Date(),
      }).where(eq(userAchievements.id, userAch.id));

      // Award HRP
      let hrpResult = { hrpAwarded: 0, newTotal: 0, leveledUp: false, newLevel: 1 };
      if (ach.hrpReward > 0) {
        hrpResult = await awardHRP(userId, ach.hrpReward, "achievement", `Achievement: ${ach.name}`);
      }

      // Award chips
      if (ach.chipReward > 0) {
        try {
          await storage.ensureWallets(userId);
          await storage.atomicAddToWallet(userId, "bonus", ach.chipReward);
          await storage.atomicAddChips(userId, ach.chipReward);
        } catch (err) {
          console.error("[loyalty] Error awarding achievement chips:", err);
        }
      }

      res.json({
        message: `Achievement "${ach.name}" reward claimed!`,
        hrpAwarded: hrpResult.hrpAwarded,
        chipsAwarded: ach.chipReward,
        leveledUp: hrpResult.leveledUp,
        newLevel: hrpResult.newLevel,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /api/loyalty/daily-login ────────────────────────────────────────
  // Claim daily login reward
  app.post("/api/loyalty/daily-login", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const result = await claimDailyLogin(userId);

      if (!result) {
        return res.status(400).json({
          message: "Daily login reward already claimed today",
          canClaim: false,
        });
      }

      res.json({
        message: `Day ${result.day} reward claimed!`,
        ...result,
        canClaim: false,
        nextClaimAt: new Date(new Date().setUTCHours(24, 0, 0, 0)),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/loyalty/hrp-history ─────────────────────────────────────────
  // Get recent HRP transactions (last 50)
  app.get("/api/loyalty/hrp-history", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.json([]);
      }

      const db = getDb();
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const rows = await db
        .select()
        .from(hrpTransactions)
        .where(eq(hrpTransactions.userId, userId))
        .orderBy(desc(hrpTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/loyalty/levels ──────────────────────────────────────────────
  // Get all loyalty level definitions
  app.get("/api/loyalty/levels", requireAuth, async (_req, res, next) => {
    try {
      res.json(LOYALTY_LEVELS);
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/loyalty/referral-code ───────────────────────────────────────
  // Get or generate user's referral code
  app.get("/api/loyalty/referral-code", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.json({ referralCode: null, referralCount: 0 });
      }

      const db = getDb();

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(404).json({ message: "User not found" });

      let referralCode = user.referralCode;

      // Generate a referral code if user doesn't have one
      if (!referralCode) {
        // Generate a unique 8-character code
        const prefix = (user.username || "HR").slice(0, 4).toUpperCase();
        const suffix = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
        referralCode = `${prefix}-${suffix}`;

        try {
          await db.update(users).set({ referralCode }).where(eq(users.id, userId));
        } catch (err: any) {
          // If collision, generate a fully random one
          referralCode = `HR-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
          await db.update(users).set({ referralCode }).where(eq(users.id, userId));
        }
      }

      // Count referrals
      const [refCount] = await db
        .select({ count: sql<number>`count(distinct ${referrals.referredId})` })
        .from(referrals)
        .where(eq(referrals.referrerId, userId));

      // Get referral milestones completed
      const completedReferrals = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerId, userId))
        .orderBy(desc(referrals.createdAt));

      res.json({
        referralCode,
        referralCount: Number(refCount?.count ?? 0),
        milestones: REFERRAL_MILESTONES,
        completedReferrals,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /api/loyalty/referral ───────────────────────────────────────────
  // Apply a referral code (for new users)
  app.post("/api/loyalty/referral", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { code } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Referral code is required" });
      }

      if (!hasDatabase()) {
        return res.status(400).json({ message: "Database not available" });
      }

      const db = getDb();

      // Get current user
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if user already has a referrer
      if (user.referredBy) {
        return res.status(400).json({ message: "You have already used a referral code" });
      }

      // Cannot refer yourself
      if (user.referralCode === code.trim()) {
        return res.status(400).json({ message: "You cannot use your own referral code" });
      }

      // Find the referrer by code
      const [referrer] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, code.trim()))
        .limit(1);

      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }

      // Set the referred_by field
      await db.update(users).set({
        referredBy: code.trim(),
      }).where(eq(users.id, userId));

      // Process the signup milestone
      await checkReferralMilestone(userId, "signup");

      res.json({
        message: "Referral code applied successfully!",
        referrerUsername: referrer.username,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── GET /api/loyalty/battle-pass ─────────────────────────────────────────
  // Get current battle pass status
  app.get("/api/loyalty/battle-pass", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.json({
          activeBattlePass: null,
          userProgress: null,
          rewards: [],
        });
      }

      const db = getDb();

      // Find the current active battle pass
      const now = new Date();
      const [activeBp] = await db
        .select()
        .from(battlePasses)
        .where(
          and(
            eq(battlePasses.isActive, true),
            sql`${battlePasses.startsAt} <= ${now}`,
            sql`${battlePasses.endsAt} >= ${now}`,
          ),
        )
        .limit(1);

      if (!activeBp) {
        return res.json({
          activeBattlePass: null,
          userProgress: null,
          rewards: [],
        });
      }

      // Get or create user's battle pass progress
      let [userBp] = await db
        .select()
        .from(userBattlePasses)
        .where(
          and(
            eq(userBattlePasses.userId, userId),
            eq(userBattlePasses.battlePassId, activeBp.id),
          ),
        )
        .limit(1);

      if (!userBp) {
        // Auto-enroll user in the free track
        const [inserted] = await db.insert(userBattlePasses).values({
          userId,
          battlePassId: activeBp.id,
          currentLevel: 0,
          hrpEarnedThisSeason: 0,
          isPremium: false,
        }).returning();
        userBp = inserted;
      }

      // Get all rewards for this battle pass
      const bpRewards = await db
        .select()
        .from(battlePassRewards)
        .where(eq(battlePassRewards.battlePassId, activeBp.id))
        .orderBy(battlePassRewards.level);

      // Calculate HRP needed per level (linear scaling)
      const hrpPerLevel = 100; // base HRP per battle pass level
      const currentLevelHrp = userBp.hrpEarnedThisSeason % hrpPerLevel;
      const hrpToNextLevel = hrpPerLevel - currentLevelHrp;

      // Determine which rewards are claimable
      const rewardsWithStatus = bpRewards.map((reward: any) => ({
        ...reward,
        claimable: reward.level <= userBp!.currentLevel && (reward.track === "free" || userBp!.isPremium),
        locked: reward.track === "premium" && !userBp!.isPremium,
      }));

      const daysRemaining = Math.max(0, Math.ceil((activeBp.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      res.json({
        activeBattlePass: {
          id: activeBp.id,
          name: activeBp.name,
          seasonNumber: activeBp.seasonNumber,
          startsAt: activeBp.startsAt,
          endsAt: activeBp.endsAt,
          maxLevel: activeBp.maxLevel,
          premiumPriceChips: activeBp.premiumPriceChips,
          premiumPriceUsd: activeBp.premiumPriceUsd,
          daysRemaining,
        },
        userProgress: {
          currentLevel: userBp.currentLevel,
          hrpEarnedThisSeason: userBp.hrpEarnedThisSeason,
          isPremium: userBp.isPremium,
          premiumPurchasedAt: userBp.premiumPurchasedAt,
          currentLevelHrp,
          hrpToNextLevel,
          hrpPerLevel,
        },
        rewards: rewardsWithStatus,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /api/loyalty/battle-pass/premium ────────────────────────────────
  // Purchase premium battle pass track
  app.post("/api/loyalty/battle-pass/premium", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.status(400).json({ message: "Database not available" });
      }

      const db = getDb();
      const now = new Date();

      // Find active battle pass
      const [activeBp] = await db
        .select()
        .from(battlePasses)
        .where(
          and(
            eq(battlePasses.isActive, true),
            sql`${battlePasses.startsAt} <= ${now}`,
            sql`${battlePasses.endsAt} >= ${now}`,
          ),
        )
        .limit(1);

      if (!activeBp) {
        return res.status(404).json({ message: "No active battle pass found" });
      }

      // Get user's battle pass record
      let [userBp] = await db
        .select()
        .from(userBattlePasses)
        .where(
          and(
            eq(userBattlePasses.userId, userId),
            eq(userBattlePasses.battlePassId, activeBp.id),
          ),
        )
        .limit(1);

      if (!userBp) {
        // Create if not exists
        const [inserted] = await db.insert(userBattlePasses).values({
          userId,
          battlePassId: activeBp.id,
          currentLevel: 0,
          hrpEarnedThisSeason: 0,
          isPremium: false,
        }).returning();
        userBp = inserted;
      }

      if (userBp.isPremium) {
        return res.status(400).json({ message: "You already have the premium battle pass" });
      }

      // Deduct chips from main wallet
      const price = activeBp.premiumPriceChips;

      await storage.ensureWallets(userId);
      const walletResult = await storage.atomicAddToWallet(userId, "main", -price);

      if (!walletResult.success) {
        return res.status(400).json({
          message: `Insufficient chips. You need ${price.toLocaleString()} chips in your main wallet.`,
          required: price,
        });
      }

      // Also deduct from legacy balance
      await storage.atomicAddChips(userId, -price);

      // Upgrade to premium
      await db.update(userBattlePasses).set({
        isPremium: true,
        premiumPurchasedAt: now,
      }).where(eq(userBattlePasses.id, userBp.id));

      res.json({
        message: "Premium battle pass unlocked!",
        isPremium: true,
        premiumPurchasedAt: now,
        chipsDeducted: price,
        newBalance: walletResult.newBalance,
      });
    } catch (err) {
      next(err);
    }
  });
}
