// Collusion Detection — statistical pattern analysis for player pairs
import type { HandSummary } from "./engine";

interface PairStats {
  handsPlayedTogether: number;
  netChipTransfer: number; // positive = A gave to B
  softPlayCount: number; // both in pot, neither raised
  foldToSpecificPlayer: number; // times A folded when B was in pot
  totalFolds: number; // total times A folded
}

export interface CollusionAlert {
  player1: string;
  player2: string;
  reason: string;
  severity: "low" | "medium" | "high";
  details: string;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export class CollusionDetector {
  private pairStats = new Map<string, PairStats>();
  private playerFoldRates = new Map<string, { folds: number; hands: number }>();
  private handCount = 0;

  private ensurePair(a: string, b: string): PairStats {
    const key = pairKey(a, b);
    let stats = this.pairStats.get(key);
    if (!stats) {
      stats = {
        handsPlayedTogether: 0,
        netChipTransfer: 0,
        softPlayCount: 0,
        foldToSpecificPlayer: 0,
        totalFolds: 0,
      };
      this.pairStats.set(key, stats);
    }
    return stats;
  }

  recordHand(summary: HandSummary) {
    this.handCount++;
    const playerIds = summary.players.map(p => p.id).filter(id => !id.startsWith("bot-"));
    if (playerIds.length < 2) return;

    // Track fold rates
    for (const p of summary.players) {
      if (p.id.startsWith("bot-")) continue;
      const rate = this.playerFoldRates.get(p.id) || { folds: 0, hands: 0 };
      rate.hands++;
      const folded = summary.actions.some(a => a.playerId === p.id && a.action === "fold");
      if (folded) rate.folds++;
      this.playerFoldRates.set(p.id, rate);
    }

    // Determine who was in the pot (contributed voluntarily)
    const inPot = new Set<string>();
    const raisedPlayers = new Set<string>();
    const foldedPlayers = new Set<string>();

    for (const action of summary.actions) {
      if (action.action === "call" || action.action === "raise") {
        inPot.add(action.playerId);
      }
      if (action.action === "raise") {
        raisedPlayers.add(action.playerId);
      }
      if (action.action === "fold") {
        foldedPlayers.add(action.playerId);
      }
    }

    // Net chip transfer from winners
    const winnerMap = new Map<string, number>();
    for (const w of summary.winners) {
      winnerMap.set(w.playerId, w.amount);
    }

    // Update pair stats
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const a = playerIds[i];
        const b = playerIds[j];
        const stats = this.ensurePair(a, b);
        stats.handsPlayedTogether++;

        // Net chip transfer: positive means A gave chips to B
        const aWon = winnerMap.get(a) || 0;
        const bWon = winnerMap.get(b) || 0;
        // Simple approximation: winner gains, others lose proportionally
        if (aWon > 0 && inPot.has(b)) {
          stats.netChipTransfer -= aWon / (inPot.size || 1);
        }
        if (bWon > 0 && inPot.has(a)) {
          stats.netChipTransfer += bWon / (inPot.size || 1);
        }

        // Soft play: both in pot but neither raised
        if (inPot.has(a) && inPot.has(b) && !raisedPlayers.has(a) && !raisedPlayers.has(b)) {
          stats.softPlayCount++;
        }

        // Fold-to-specific-player tracking
        if (foldedPlayers.has(a) && inPot.has(b)) {
          stats.foldToSpecificPlayer++;
        }
        if (foldedPlayers.has(b) && inPot.has(a)) {
          stats.foldToSpecificPlayer++;
        }
        stats.totalFolds += (foldedPlayers.has(a) ? 1 : 0) + (foldedPlayers.has(b) ? 1 : 0);
      }
    }
  }

  checkAlerts(): CollusionAlert[] {
    const alerts: CollusionAlert[] = [];

    // Collect all net transfers for mean/stddev calculation
    const allTransfers: number[] = [];
    this.pairStats.forEach(stats => {
      if (stats.handsPlayedTogether >= 20) {
        allTransfers.push(stats.netChipTransfer);
      }
    });

    if (allTransfers.length < 2) return alerts;

    const mean = allTransfers.reduce((a, b) => a + b, 0) / allTransfers.length;
    const variance = allTransfers.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allTransfers.length;
    const stddev = Math.sqrt(variance);

    this.pairStats.forEach((stats, key) => {
      if (stats.handsPlayedTogether < 20) return; // minimum threshold

      const [p1, p2] = key.split(":");

      // Check 1: One-directional chip transfer > 3 standard deviations
      if (stddev > 0 && Math.abs(stats.netChipTransfer - mean) > 3 * stddev) {
        alerts.push({
          player1: p1,
          player2: p2,
          reason: "Unidirectional chip transfer",
          severity: "high",
          details: `Net transfer: ${Math.round(stats.netChipTransfer)} chips over ${stats.handsPlayedTogether} hands (${Math.round(Math.abs(stats.netChipTransfer - mean) / stddev)}σ from mean)`,
        });
      }

      // Check 2: Soft play rate > 60%
      const softPlayRate = stats.softPlayCount / stats.handsPlayedTogether;
      if (softPlayRate > 0.6) {
        alerts.push({
          player1: p1,
          player2: p2,
          reason: "Excessive soft play",
          severity: "medium",
          details: `Soft play rate: ${Math.round(softPlayRate * 100)}% (${stats.softPlayCount}/${stats.handsPlayedTogether} hands)`,
        });
      }

      // Check 3: Fold-to-specific-player rate > 2x average
      const p1FoldRate = this.playerFoldRates.get(p1);
      const p2FoldRate = this.playerFoldRates.get(p2);
      if (p1FoldRate && p2FoldRate) {
        const avgFoldRate = (p1FoldRate.folds / Math.max(1, p1FoldRate.hands) + p2FoldRate.folds / Math.max(1, p2FoldRate.hands)) / 2;
        const pairFoldRate = stats.foldToSpecificPlayer / (stats.handsPlayedTogether * 2);
        if (avgFoldRate > 0 && pairFoldRate > avgFoldRate * 2) {
          alerts.push({
            player1: p1,
            player2: p2,
            reason: "Suspicious fold-to-player rate",
            severity: "medium",
            details: `Fold rate to each other: ${Math.round(pairFoldRate * 100)}% vs avg fold rate ${Math.round(avgFoldRate * 100)}%`,
          });
        }
      }
    });

    return alerts;
  }
}
