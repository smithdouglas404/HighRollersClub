import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { handPlayers } from "@shared/schema";
import { sql as defaultSql } from "drizzle-orm";

export interface PlayerHelpers {
  hasDatabase: () => boolean;
  getDb: () => any;
  sql: typeof defaultSql;
}

export async function registerPlayerRoutes(
  app: Express,
  requireAuth: RequestHandler,
  helpers: PlayerHelpers,
) {
  const { hasDatabase, getDb, sql } = helpers;

  // ─── Profile Routes ──────────────────────��───────────────────────────────
  app.put("/api/profile/avatar", requireAuth, async (req, res, next) => {
    try {
      const { avatarId, displayName, tauntVoice } = req.body;
      const updates: Record<string, any> = {};
      if (avatarId && typeof avatarId === "string") updates.avatarId = avatarId;
      if (displayName && typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 50);
      if (tauntVoice && typeof tauntVoice === "string") updates.tauntVoice = tauntVoice.slice(0, 30);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "avatarId, displayName, or tauntVoice required" });
      }
      await storage.updateUser(req.user!.id, updates);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Stats Routes ──────────────────��───────────────────────────
  app.get("/api/stats/me", requireAuth, async (req, res, next) => {
    try {
      const stats = await storage.getPlayerStats(req.user!.id);
      if (!stats) {
        return res.json({
          handsPlayed: 0, potsWon: 0,
          bestWinStreak: 0, currentWinStreak: 0, totalWinnings: 0,
          vpip: 0, pfr: 0, showdownCount: 0, sngWins: 0,
        });
      }
      res.json({
        handsPlayed: stats.handsPlayed,
        potsWon: stats.potsWon,
        bestWinStreak: stats.bestWinStreak,
        currentWinStreak: stats.currentWinStreak,
        totalWinnings: stats.totalWinnings,
        vpip: stats.vpip,
        pfr: stats.pfr,
        showdownCount: stats.showdownCount,
        sngWins: stats.sngWins,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Military Rank System ──────────────────────────────────────────────
  const MILITARY_RANKS = [
    { id: "pvt",  label: "Private",             prefix: "Pvt.",  tier: "enlisted", minHands: 0,      minWinRate: 0,  minTournamentWins: 0 },
    { id: "pfc",  label: "Private First Class",  prefix: "PFC",   tier: "enlisted", minHands: 51,     minWinRate: 0,  minTournamentWins: 0 },
    { id: "cpl",  label: "Corporal",             prefix: "Cpl.",  tier: "enlisted", minHands: 201,    minWinRate: 40, minTournamentWins: 0 },
    { id: "sgt",  label: "Sergeant",             prefix: "Sgt.",  tier: "enlisted", minHands: 501,    minWinRate: 45, minTournamentWins: 0 },
    { id: "ssgt", label: "Staff Sergeant",       prefix: "SSgt.", tier: "enlisted", minHands: 1001,   minWinRate: 48, minTournamentWins: 0 },
    { id: "msgt", label: "Master Sergeant",      prefix: "MSgt.", tier: "enlisted", minHands: 2501,   minWinRate: 50, minTournamentWins: 1 },
    { id: "2lt",  label: "2nd Lieutenant",       prefix: "2LT",   tier: "officer",  minHands: 5001,   minWinRate: 52, minTournamentWins: 3 },
    { id: "1lt",  label: "1st Lieutenant",       prefix: "1LT",   tier: "officer",  minHands: 10001,  minWinRate: 54, minTournamentWins: 5 },
    { id: "cpt",  label: "Captain",              prefix: "CPT",   tier: "officer",  minHands: 25001,  minWinRate: 55, minTournamentWins: 10 },
    { id: "maj",  label: "Major",                prefix: "MAJ",   tier: "officer",  minHands: 50001,  minWinRate: 56, minTournamentWins: 20 },
    { id: "col",  label: "Colonel",              prefix: "COL",   tier: "officer",  minHands: 100001, minWinRate: 57, minTournamentWins: 50 },
    { id: "gen",  label: "General",              prefix: "GEN",   tier: "officer",  minHands: 250000, minWinRate: 58, minTournamentWins: 100 },
  ];

  function calculateMilitaryRank(handsPlayed: number, winRate: number, tournamentWins: number) {
    let rank = MILITARY_RANKS[0];
    for (const r of MILITARY_RANKS) {
      if (handsPlayed >= r.minHands && winRate >= r.minWinRate && tournamentWins >= r.minTournamentWins) {
        rank = r;
      }
    }
    return rank;
  }

  // Get any player's hover card — safe stats only (no VPIP, PFR, aggression)
  app.get("/api/players/:id/hover", async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Player not found" });

      const stats = await storage.getPlayerStats(user.id);
      const handsPlayed = stats?.handsPlayed ?? 0;
      const winRate = handsPlayed > 0 ? Math.round(((stats?.potsWon ?? 0) / handsPlayed) * 100 * 10) / 10 : 0;
      const tournamentWins = stats?.sngWins ?? 0;
      const rank = calculateMilitaryRank(handsPlayed, winRate, tournamentWins);

      // Find player's club
      const clubs = await storage.getUserClubs(user.id);
      const primaryClub = clubs.length > 0 ? clubs[0] : null;

      res.json({
        username: user.username,
        displayName: user.displayName,
        avatarId: user.avatarId,
        rank: {
          id: rank.id,
          label: rank.label,
          prefix: rank.prefix,
          tier: rank.tier,
        },
        // Safe stats only — no VPIP, PFR, aggression factor, or position stats
        stats: {
          handsPlayed,
          winRate,
          tournamentWins,
          bestStreak: stats?.bestWinStreak ?? 0,
        },
        memberSince: user.createdAt,
        club: primaryClub ? { id: primaryClub.id, name: primaryClub.name } : null,
      });
    } catch (err) { next(err); }
  });

  // Get military rank definitions
  app.get("/api/military-ranks", (_req, res) => {
    res.json(MILITARY_RANKS);
  });

  // ─── Stats Breakdown by Variant / Format ────────────────���──────────────
  app.get("/api/stats/me/breakdown", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        // In-memory fallback: return empty breakdown
        const emptyGroup = { handsPlayed: 0, potsWon: 0, winRate: 0, totalChipsWon: 0, totalChipsLost: 0, netResult: 0 };
        return res.json({
          byVariant: { nlhe: { ...emptyGroup }, plo: { ...emptyGroup }, plo5: { ...emptyGroup }, short_deck: { ...emptyGroup } },
          byFormat: { cash: { ...emptyGroup }, sng: { ...emptyGroup }, tournament: { ...emptyGroup } },
        });
      }

      const db = getDb();

      // Query hand_players joined with game_hands joined with tables to get variant and format
      const rows = await db.execute(sql`
        SELECT
          t.poker_variant AS variant,
          t.game_format AS format,
          hp.net_result,
          hp.is_winner
        FROM hand_players hp
        INNER JOIN game_hands gh ON gh.id = hp.hand_id
        INNER JOIN tables t ON t.id = gh.table_id
        WHERE hp.user_id = ${userId}
      `);

      const byVariant: Record<string, { handsPlayed: number; potsWon: number; totalChipsWon: number; totalChipsLost: number; netResult: number }> = {};
      const byFormat: Record<string, { handsPlayed: number; potsWon: number; totalChipsWon: number; totalChipsLost: number; netResult: number }> = {};

      const ensureGroup = (map: typeof byVariant, key: string) => {
        if (!map[key]) map[key] = { handsPlayed: 0, potsWon: 0, totalChipsWon: 0, totalChipsLost: 0, netResult: 0 };
        return map[key];
      };

      // Ensure all known variants/formats exist
      for (const v of ["nlhe", "plo", "plo5", "short_deck"]) ensureGroup(byVariant, v);
      for (const f of ["cash", "sng", "tournament"]) ensureGroup(byFormat, f);

      const resultRows = (rows as any).rows ?? rows;
      for (const row of resultRows) {
        const variant = (row.variant as string) || "nlhe";
        const rawFormat = (row.format as string) || "cash";
        // Normalize format: heads_up and bomb_pot count as cash, sng stays sng, tournament stays tournament
        const format = rawFormat === "tournament" ? "tournament" : rawFormat === "sng" ? "sng" : "cash";
        const net = Number(row.net_result) || 0;
        const won = row.is_winner === true || row.is_winner === "true";

        const vg = ensureGroup(byVariant, variant);
        vg.handsPlayed++;
        if (won) vg.potsWon++;
        if (net > 0) vg.totalChipsWon += net;
        else vg.totalChipsLost += Math.abs(net);
        vg.netResult += net;

        const fg = ensureGroup(byFormat, format);
        fg.handsPlayed++;
        if (won) fg.potsWon++;
        if (net > 0) fg.totalChipsWon += net;
        else fg.totalChipsLost += Math.abs(net);
        fg.netResult += net;
      }

      // Add winRate to each group
      const addWinRate = (map: typeof byVariant) => {
        const result: Record<string, any> = {};
        for (const [key, g] of Object.entries(map)) {
          result[key] = {
            ...g,
            winRate: g.handsPlayed > 0 ? Math.round((g.potsWon / g.handsPlayed) * 10000) / 100 : 0,
          };
        }
        return result;
      };

      res.json({
        byVariant: addWinRate(byVariant),
        byFormat: addWinRate(byFormat),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Head-to-Head Stats ──────────────��─────────────────────────────────
  app.get("/api/stats/head-to-head/top", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.json([]);
      }

      const db = getDb();

      const rows = await db.execute(sql`
        SELECT
          opp.user_id AS opponent_id,
          u.display_name AS opponent_name,
          u.username AS opponent_username,
          COUNT(*) AS hands_played,
          SUM(CASE WHEN me.is_winner THEN 1 ELSE 0 END) AS user_wins,
          SUM(CASE WHEN opp.is_winner THEN 1 ELSE 0 END) AS opponent_wins,
          SUM(CASE WHEN me.is_winner AND opp.is_winner THEN 1 ELSE 0 END) AS split_pots,
          SUM(me.net_result) AS user_net_chips,
          MAX(gh.created_at) AS last_played
        FROM hand_players me
        INNER JOIN hand_players opp ON opp.hand_id = me.hand_id AND opp.user_id != me.user_id
        INNER JOIN game_hands gh ON gh.id = me.hand_id
        INNER JOIN users u ON u.id = opp.user_id
        WHERE me.user_id = ${userId}
        GROUP BY opp.user_id, u.display_name, u.username
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `);

      const resultRows = (rows as any).rows ?? rows;
      const results = resultRows.map((row: any) => ({
        opponentId: row.opponent_id,
        opponentName: row.opponent_name || row.opponent_username || "Unknown",
        handsPlayedTogether: Number(row.hands_played) || 0,
        userWins: Number(row.user_wins) || 0,
        opponentWins: Number(row.opponent_wins) - Number(row.split_pots) || 0,
        splitPots: Number(row.split_pots) || 0,
        userNetChips: Number(row.user_net_chips) || 0,
        lastPlayed: row.last_played || null,
      }));

      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/stats/head-to-head/:opponentId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const opponentId = req.params.opponentId;

      if (!hasDatabase()) {
        return res.json({
          opponentId,
          opponentName: "Unknown",
          handsPlayedTogether: 0,
          userWins: 0,
          opponentWins: 0,
          splitPots: 0,
          userNetChips: 0,
          lastPlayed: null,
        });
      }

      const db = getDb();

      const oppRows = await db.execute(sql`
        SELECT display_name, username FROM users WHERE id = ${opponentId}
      `);
      const oppResultRows = (oppRows as any).rows ?? oppRows;
      const opponent = oppResultRows[0];
      if (!opponent) {
        return res.status(404).json({ message: "Opponent not found" });
      }

      const rows = await db.execute(sql`
        SELECT
          me.is_winner AS me_won,
          opp.is_winner AS opp_won,
          me.net_result AS my_net,
          gh.created_at
        FROM hand_players me
        INNER JOIN hand_players opp ON opp.hand_id = me.hand_id AND opp.user_id = ${opponentId}
        INNER JOIN game_hands gh ON gh.id = me.hand_id
        WHERE me.user_id = ${userId}
        ORDER BY gh.created_at DESC
      `);

      const resultRows = (rows as any).rows ?? rows;

      let userWins = 0;
      let opponentWins = 0;
      let splitPots = 0;
      let userNetChips = 0;
      let lastPlayed: string | null = null;

      for (const row of resultRows) {
        const meWon = row.me_won === true || row.me_won === "true";
        const oppWon = row.opp_won === true || row.opp_won === "true";
        const net = Number(row.my_net) || 0;

        if (meWon && oppWon) {
          splitPots++;
          userWins++;
        } else if (meWon) {
          userWins++;
        } else if (oppWon) {
          opponentWins++;
        }

        userNetChips += net;

        if (!lastPlayed && row.created_at) {
          lastPlayed = new Date(row.created_at).toISOString();
        }
      }

      res.json({
        opponentId,
        opponentName: opponent.display_name || opponent.username || "Unknown",
        handsPlayedTogether: resultRows.length,
        userWins,
        opponentWins,
        splitPots,
        userNetChips,
        lastPlayed,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Play Style Coach ───────────────────────────────────────────��─────
  app.get("/api/coaching/recommendations", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const stats = await storage.getPlayerStats(userId);

      const handsPlayed = stats?.handsPlayed ?? 0;
      const potsWon = stats?.potsWon ?? 0;
      const vpipCount = stats?.vpip ?? 0;
      const pfrCount = stats?.pfr ?? 0;
      const showdownCount = stats?.showdownCount ?? 0;

      const vpipPct = handsPlayed > 0 ? Math.round((vpipCount / handsPlayed) * 100) : 0;
      const pfrPct = handsPlayed > 0 ? Math.round((pfrCount / handsPlayed) * 100) : 0;
      const showdownPct = handsPlayed > 0 ? Math.round((showdownCount / handsPlayed) * 100) : 0;
      const winRate = handsPlayed > 0 ? Math.round((potsWon / handsPlayed) * 100) : 0;

      // Try to get additional data from handPlayers if DB is available
      let additionalHands = 0;
      if (hasDatabase()) {
        try {
          const db = getDb();
          const rows = await db.select({ count: sql<number>`count(*)` }).from(handPlayers).where(sql`${handPlayers.userId} = ${userId}`);
          additionalHands = Number(rows[0]?.count ?? 0);
        } catch (_) { /* ignore — use playerStats only */ }
      }

      const totalAnalyzed = Math.max(handsPlayed, additionalHands);

      const recommendations: { category: string; severity: string; title: string; detail: string }[] = [];

      // Minimum hands gate
      if (totalAnalyzed < 100) {
        recommendations.push({
          category: "General",
          severity: "warning",
          title: "Need More Data",
          detail: `Play more hands to get meaningful recommendations. We need at least 100 hands. You've played ${totalAnalyzed} so far.`,
        });
      }

      // VPIP analysis
      if (vpipPct > 35) {
        recommendations.push({
          category: "Preflop",
          severity: "critical",
          title: "Too Loose Preflop",
          detail: `Your VPIP is ${vpipPct}% — you're playing too many hands. Optimal range is 18-25% for full ring. Tighten up, especially from early position.`,
        });
      } else if (vpipPct < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Too Tight Preflop",
          detail: `Your VPIP is ${vpipPct}% — you're playing too tight. You're missing profitable spots. Open your range from late position.`,
        });
      } else if (vpipPct >= 18 && vpipPct <= 25) {
        recommendations.push({
          category: "Preflop",
          severity: "good",
          title: "Optimal VPIP",
          detail: `Your VPIP of ${vpipPct}% is in the optimal range. Keep it up.`,
        });
      }

      // PFR analysis
      if (handsPlayed >= 100 && pfrPct < vpipPct / 2) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Too Much Calling",
          detail: `Your PFR is ${pfrPct}% vs VPIP of ${vpipPct}% — you're calling too much preflop instead of raising. Raise or fold more, call less.`,
        });
      } else if (handsPlayed >= 100 && pfrPct > vpipPct * 0.8) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Raising Too Often",
          detail: `You're raising nearly every hand you play. Consider flatting more in position.`,
        });
      }

      // Showdown analysis
      if (showdownPct > 40) {
        recommendations.push({
          category: "Postflop",
          severity: "warning",
          title: "Too Many Showdowns",
          detail: `You're going to showdown ${showdownPct}% of the time — you might be calling too many rivers. Consider folding weak hands on the river.`,
        });
      } else if (showdownPct < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Postflop",
          severity: "warning",
          title: "Folding Too Often",
          detail: `You rarely go to showdown (${showdownPct}%) — opponents may be pushing you off hands. Stand your ground with medium-strength hands.`,
        });
      }

      // Win rate
      if (winRate < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Overall",
          severity: "critical",
          title: "Low Win Rate",
          detail: `Your win rate of ${winRate}% is below average. Focus on hand selection and position.`,
        });
      } else if (winRate > 40) {
        recommendations.push({
          category: "Overall",
          severity: "good",
          title: "Excellent Win Rate",
          detail: `Excellent win rate of ${winRate}%! You're playing well above average.`,
        });
      }

      // Determine play style
      const isLoose = vpipPct > 25;
      const isAggressive = pfrPct > 15;
      let overallRating: string;
      if (isLoose && isAggressive) overallRating = "Loose-Aggressive";
      else if (isLoose && !isAggressive) overallRating = "Loose-Passive";
      else if (!isLoose && isAggressive) overallRating = "Tight-Aggressive";
      else overallRating = "Tight-Passive";

      // Calculate a score (0-100)
      let score = 50;
      if (vpipPct >= 18 && vpipPct <= 25) score += 15;
      else if (vpipPct > 35 || vpipPct < 10) score -= 15;
      else score -= 5;
      if (pfrPct >= vpipPct * 0.5 && pfrPct <= vpipPct * 0.8) score += 10;
      else score -= 5;
      if (showdownPct >= 20 && showdownPct <= 35) score += 10;
      else if (showdownPct > 40 || showdownPct < 15) score -= 10;
      if (winRate > 40) score += 15;
      else if (winRate > 25) score += 5;
      else if (winRate < 15) score -= 10;
      score = Math.max(0, Math.min(100, score));

      res.json({
        handsAnalyzed: totalAnalyzed,
        overallRating,
        score,
        recommendations,
        stats: {
          vpip: vpipPct,
          pfr: pfrPct,
          showdownPct,
          winRate,
          handsPlayed: totalAnalyzed,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Leaderboard ─────────────────────────────────────────────────────
  app.get("/api/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const metric = (req.query.metric as string) || "chips";
      if (!["chips", "wins", "winRate"].includes(metric)) {
        return res.status(400).json({ error: "Invalid metric. Use chips, wins, or winRate" });
      }
      const period = (req.query.period as string) || "all";
      if (!["today", "week", "month", "all"].includes(period)) {
        return res.status(400).json({ error: "Invalid period. Use today, week, month, or all" });
      }

      const data = await storage.getLeaderboard(
        metric as "chips" | "wins" | "winRate",
        50,
        period as "today" | "week" | "month" | "all",
      );

      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ─── Missions Routes ──────────────��───────────────────────────────────

  // Helper: check if a mission period has expired and needs reset
  function isMissionPeriodStale(periodStart: Date | null, periodType: string): boolean {
    if (!periodStart) return true;
    const now = Date.now();
    const start = new Date(periodStart).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (periodType === "daily" && now - start > TWENTY_FOUR_HOURS) return true;
    if (periodType === "weekly" && now - start > SEVEN_DAYS) return true;
    return false;
  }

  // Helper: reset stale user missions and player stats for a given user.
  // Returns true if any missions were reset.
  async function resetStaleMissions(userId: string, allMissions: any[], userMs: any[]): Promise<boolean> {
    let didReset = false;
    let resetDaily = false;
    const stats = await storage.getPlayerStats(userId);

    const baselineFieldMap: Record<string, string> = {
      hands_played: "handsPlayed",
      pots_won: "potsWon",
      bluff_wins: "bluffWins",
      preflop_folds: "preflopFolds",
      big_pot_wins: "bigPotWins",
      plo_hands: "ploHands",
      tournament_hands: "tournamentHands",
      sng_win: "sngWins",
      vpip: "vpip",
      win_streak: "bestWinStreak",
      consecutive_wins: "currentWinStreak",
      bomb_pot: "bombPotsPlayed",
      heads_up_win: "headsUpWins",
    };

    for (const um of userMs) {
      const mission = allMissions.find((m: any) => m.id === um.missionId);
      if (!mission) continue;
      if (isMissionPeriodStale(um.periodStart, mission.periodType)) {
        const statField = baselineFieldMap[mission.type];
        const newBaseline = stats && statField && typeof (stats as any)[statField] === "number"
          ? (stats as any)[statField] as number
          : 0;
        await storage.updateUserMission(um.id, {
          progress: 0,
          claimedAt: null,
          completedAt: null,
          periodStart: new Date(),
          baselineValue: newBaseline,
        });
        didReset = true;
        if (mission.periodType === "daily") {
          resetDaily = true;
        }
      }
    }
    // Reset tracked stats only when a daily mission period has elapsed
    if (resetDaily) {
      await storage.resetDailyStats(userId);
    }
    return didReset;
  }

  app.get("/api/missions", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      let userMs = await storage.getUserMissions(req.user!.id);

      // Lazy reset: check for stale mission periods and reset them
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      // Re-fetch after reset so we have fresh data
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);

      const result = allMissions.map(m => {
        const userMission = userMs.find(um => um.missionId === m.id);
        const baseline = userMission?.baselineValue ?? 0;
        let progress = 0;
        if (stats) {
          switch (m.type) {
            case "hands_played": progress = Math.max(0, stats.handsPlayed - baseline); break;
            case "pots_won": progress = Math.max(0, stats.potsWon - baseline); break;
            case "win_streak": progress = Math.max(0, stats.bestWinStreak - baseline); break;
            case "consecutive_wins": progress = Math.max(0, stats.currentWinStreak - baseline); break;
            case "sng_win": progress = Math.max(0, ((stats as any).sngWins ?? 0) - baseline); break;
            case "bomb_pot": progress = Math.max(0, ((stats as any).bombPotsPlayed ?? 0) - baseline); break;
            case "heads_up_win": progress = Math.max(0, ((stats as any).headsUpWins ?? 0) - baseline); break;
            default: progress = userMission?.progress || 0;
          }
        }
        return {
          ...m,
          progress: Math.min(progress, m.target),
          completed: progress >= m.target,
          claimed: !!userMission?.claimedAt,
          userMissionId: userMission?.id,
        };
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/missions/:id/claim", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      const mission = allMissions.find(m => m.id === req.params.id);
      if (!mission) return res.status(404).json({ message: "Mission not found" });

      // Lazy reset: check all user missions for staleness before evaluating claim
      let userMs = await storage.getUserMissions(req.user!.id);
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);
      const userMission = userMs.find(um => um.missionId === mission.id);
      const baseline = userMission?.baselineValue ?? 0;
      let progress = 0;
      if (stats) {
        switch (mission.type) {
          case "hands_played": progress = Math.max(0, stats.handsPlayed - baseline); break;
          case "pots_won": progress = Math.max(0, stats.potsWon - baseline); break;
          case "win_streak": progress = Math.max(0, stats.bestWinStreak - baseline); break;
          case "consecutive_wins": progress = Math.max(0, stats.currentWinStreak - baseline); break;
          case "sng_win": progress = Math.max(0, ((stats as any).sngWins ?? 0) - baseline); break;
          case "bomb_pot": progress = Math.max(0, ((stats as any).bombPotsPlayed ?? 0) - baseline); break;
          case "heads_up_win": progress = Math.max(0, ((stats as any).headsUpWins ?? 0) - baseline); break;
        }
      }

      if (progress < mission.target) {
        return res.status(400).json({ message: "Mission not completed" });
      }

      // Check if already claimed
      const existing = userMs.find(um => um.missionId === mission.id && um.claimedAt);
      if (existing) {
        return res.status(400).json({ message: "Already claimed" });
      }

      // Create or update user mission
      if (userMission) {
        await storage.updateUserMission(userMission.id, {
          claimedAt: new Date(),
          completedAt: new Date(),
          progress,
        });
      } else {
        await storage.createUserMission({
          userId: req.user!.id,
          missionId: mission.id,
          progress,
          completedAt: new Date(),
          claimedAt: new Date(),
          periodStart: new Date(),
          baselineValue: baseline,
        });
      }

      // Credit reward to bonus wallet
      await storage.ensureWallets(req.user!.id);
      const { success: credited, newBalance } = await storage.atomicAddToWallet(req.user!.id, "bonus", mission.reward);
      if (credited) {
        await storage.createTransaction({
          userId: req.user!.id,
          type: "bonus",
          amount: mission.reward,
          balanceBefore: newBalance - mission.reward,
          balanceAfter: newBalance,
          tableId: null,
          description: `Mission reward: ${mission.label}`,
          walletType: "bonus",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });
      }

      // Award HRP for mission completion
      {
        const { HRP_EARN_RATES } = await import("../loyalty-config");
        const user = await storage.getUser(req.user!.id);
        const tier = user?.tier || "free";
        const isWeekly = mission.periodType === "weekly";
        const hrpAmount = isWeekly ? HRP_EARN_RATES.weeklyMission : HRP_EARN_RATES.dailyMission;
        const reason = isWeekly ? "weeklyMission" : "dailyMission";
        await storage.awardLoyaltyPoints(req.user!.id, hrpAmount, reason, tier);
      }

      res.json({ message: "Reward claimed", reward: mission.reward });
    } catch (err) {
      next(err);
    }
  });

  // ─── Loyalty (HRP) Routes ─────────────────────────────────────────────
  app.get("/api/loyalty/status", requireAuth, async (req, res, next) => {
    try {
      const { LOYALTY_LEVELS, getLoyaltyLevel } = await import("../loyalty-config");
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentLevel = getLoyaltyLevel(user.loyaltyPoints);
      const nextLevel = LOYALTY_LEVELS.find(l => l.level === currentLevel.level + 1) || null;

      res.json({
        hrp: user.loyaltyPoints,
        level: currentLevel.level,
        levelName: currentLevel.name,
        badge: currentLevel.badge,
        nextLevel: nextLevel ? {
          level: nextLevel.level,
          name: nextLevel.name,
          hrpRequired: nextLevel.hrpRequired,
          hrpRemaining: nextLevel.hrpRequired - user.loyaltyPoints,
          badge: nextLevel.badge,
        } : null,
        streakDays: user.loyaltyStreakDays,
        lastPlayDate: user.loyaltyLastPlayDate,
        tier: user.tier,
      });
    } catch (err) { next(err); }
  });

  app.get("/api/loyalty/levels", async (_req, res, next) => {
    try {
      const { LOYALTY_LEVELS } = await import("../loyalty-config");
      res.json(LOYALTY_LEVELS);
    } catch (err) { next(err); }
  });

  app.get("/api/loyalty/history", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const history = await storage.getLoyaltyHistory(req.user!.id, limit);
      res.json(history);
    } catch (err) { next(err); }
  });

  // ─── Player Notes ─────────────────���────────────────────────────────────

  app.get("/api/player-notes", requireAuth, async (req, res, next) => {
    try {
      const notes = await storage.getPlayerNotes(req.user!.id);
      res.json(notes);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const note = await storage.getPlayerNote(req.user!.id, req.params.targetId);
      res.json(note ?? null);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const { note, color } = req.body;
      if (!note || typeof note !== "string") {
        return res.status(400).json({ message: "Note text is required" });
      }
      const result = await storage.upsertPlayerNote(
        req.user!.id,
        req.params.targetId,
        note.slice(0, 500),
        color || "gray",
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      await storage.deletePlayerNote(req.user!.id, req.params.targetId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Account Actions (visible to player) ───────���──────────────────

  app.get("/api/account/actions", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const { accountActions: accountActionsTable } = await import("@shared/schema");
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const actions = await db.select().from(accountActionsTable)
        .where(sql`${accountActionsTable.userId} = ${req.user!.id}`)
        .orderBy(sql`${accountActionsTable.createdAt} DESC`)
        .limit(limit);
      res.json(actions);
    } catch (err) { next(err); }
  });
}
