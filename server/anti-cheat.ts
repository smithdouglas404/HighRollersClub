import { storage } from "./storage";

export interface CollusionAlertData {
  tableId: string;
  player1Id: string;
  player2Id: string;
  alertType: string;
  severity: string;
  details: any;
  status: string;
}

interface ConnectionRecord {
  userId: string;
  ip: string;
  userAgent: string;
  fingerprint?: string;
  connectedAt: number;
  tableId?: string;
}

interface PlayerRiskEntry {
  score: number;
  reasons: string[];
  updatedAt: number;
}

interface HandData {
  id: string;
  tableId: string;
  winnerIds: string[] | null;
  potTotal: number;
  createdAt: Date;
  players: {
    userId: string;
    seatIndex: number;
    netResult: number;
    isWinner: boolean;
    finalAction: string | null;
    holeCards: any;
  }[];
}

export class AntiCheatEngine {
  private connections: Map<string, ConnectionRecord> = new Map();
  private riskScores: Map<string, PlayerRiskEntry> = new Map();
  // Track IP -> set of userIds
  private ipToUsers: Map<string, Set<string>> = new Map();

  /**
   * Track player connections
   */
  trackConnection(userId: string, ip: string, userAgent: string, fingerprint?: string): void {
    const record: ConnectionRecord = {
      userId,
      ip,
      userAgent,
      fingerprint,
      connectedAt: Date.now(),
    };
    this.connections.set(userId, record);

    // Track IP mapping
    if (!this.ipToUsers.has(ip)) {
      this.ipToUsers.set(ip, new Set());
    }
    this.ipToUsers.get(ip)!.add(userId);
  }

  /**
   * Update table association for a connected user
   */
  setPlayerTable(userId: string, tableId: string | null): void {
    const conn = this.connections.get(userId);
    if (conn) {
      conn.tableId = tableId ?? undefined;
    }
  }

  /**
   * Remove a disconnected player
   */
  removeConnection(userId: string): void {
    const conn = this.connections.get(userId);
    if (conn) {
      const ipSet = this.ipToUsers.get(conn.ip);
      if (ipSet) {
        ipSet.delete(userId);
        if (ipSet.size === 0) this.ipToUsers.delete(conn.ip);
      }
    }
    this.connections.delete(userId);
  }

  /**
   * Check for same-IP at same table
   */
  checkSameIPAtTable(tableId: string): CollusionAlertData[] {
    const alerts: CollusionAlertData[] = [];
    // Group players at this table by IP
    const ipGroups = new Map<string, string[]>();

    for (const [userId, conn] of this.connections) {
      if (conn.tableId === tableId) {
        if (!ipGroups.has(conn.ip)) {
          ipGroups.set(conn.ip, []);
        }
        ipGroups.get(conn.ip)!.push(userId);
      }
    }

    for (const [ip, userIds] of ipGroups) {
      if (userIds.length > 1) {
        // Create alerts for each pair
        for (let i = 0; i < userIds.length; i++) {
          for (let j = i + 1; j < userIds.length; j++) {
            alerts.push({
              tableId,
              player1Id: userIds[i],
              player2Id: userIds[j],
              alertType: "same_ip",
              severity: "high",
              details: {
                ip,
                description: `Players ${userIds[i]} and ${userIds[j]} are connected from the same IP address at table ${tableId}`,
              },
              status: "pending",
            });
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Detect chip dumping (player consistently loses to same opponent with weak hands)
   */
  detectChipDumping(tableId: string, recentHands: HandData[]): CollusionAlertData[] {
    const alerts: CollusionAlertData[] = [];

    // Track transfers between player pairs: {p1->p2: totalChips, handCount}
    const transfers = new Map<string, { total: number; count: number; weakHandCount: number }>();

    for (const hand of recentHands) {
      if (!hand.players || hand.players.length < 2) continue;

      const losers = hand.players.filter(p => p.netResult < 0);
      const winners = hand.players.filter(p => p.netResult > 0 && p.isWinner);

      for (const loser of losers) {
        for (const winner of winners) {
          const key = `${loser.userId}->${winner.userId}`;
          const existing = transfers.get(key) || { total: 0, count: 0, weakHandCount: 0 };
          existing.total += Math.abs(loser.netResult);
          existing.count++;

          // Check if loser had weak hole cards (approximate check)
          const isWeakHand = this.isWeakHand(loser.holeCards);
          if (isWeakHand && loser.finalAction !== "fold") {
            existing.weakHandCount++;
          }

          transfers.set(key, existing);
        }
      }
    }

    // Flag pairs where one player consistently loses to another
    for (const [key, data] of transfers) {
      const [fromId, toId] = key.split("->");
      if (data.count >= 5 && data.weakHandCount >= 3) {
        // Check if the reverse transfer is significantly lower
        const reverseKey = `${toId}->${fromId}`;
        const reverseData = transfers.get(reverseKey);
        const reverseTotal = reverseData?.total ?? 0;

        if (data.total > reverseTotal * 3 && data.total >= 1000) {
          alerts.push({
            tableId,
            player1Id: fromId,
            player2Id: toId,
            alertType: "chip_dumping",
            severity: data.total >= 5000 ? "high" : "medium",
            details: {
              chipsTransferred: data.total,
              handsInvolved: data.count,
              weakHandsPlayed: data.weakHandCount,
              reverseTransfer: reverseTotal,
              description: `Player ${fromId} lost ${data.total} chips to ${toId} across ${data.count} hands, with ${data.weakHandCount} weak hands played`,
            },
            status: "pending",
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Detect soft play (two players never bet against each other)
   */
  detectSoftPlay(handHistory: HandData[]): CollusionAlertData[] {
    const alerts: CollusionAlertData[] = [];

    if (handHistory.length < 10) return alerts;

    const tableId = handHistory[0]?.tableId ?? "";

    // Track which pairs appear together and how often one folds to other's aggression
    const pairStats = new Map<string, { together: number; bothInPot: number; noContest: number }>();

    for (const hand of handHistory) {
      if (!hand.players || hand.players.length < 2) continue;

      const activePlayers = hand.players.filter(p => p.finalAction !== "fold" || p.netResult !== 0);

      // All pairs that were at the table
      for (let i = 0; i < hand.players.length; i++) {
        for (let j = i + 1; j < hand.players.length; j++) {
          const p1 = hand.players[i].userId;
          const p2 = hand.players[j].userId;
          const key = [p1, p2].sort().join(":");
          const stats = pairStats.get(key) || { together: 0, bothInPot: 0, noContest: 0 };
          stats.together++;

          // Both stayed in the pot (didn't fold preflop)
          const p1Active = activePlayers.some(p => p.userId === p1);
          const p2Active = activePlayers.some(p => p.userId === p2);

          if (p1Active && p2Active) {
            stats.bothInPot++;
            // Check if one always folds when the other bets
            const p1Folded = hand.players[i].finalAction === "fold";
            const p2Folded = hand.players[j].finalAction === "fold";
            if (p1Folded || p2Folded) {
              stats.noContest++;
            }
          }

          pairStats.set(key, stats);
        }
      }
    }

    // Flag pairs with suspiciously high no-contest rate
    for (const [key, stats] of pairStats) {
      if (stats.together >= 8 && stats.bothInPot >= 4) {
        const contestRate = stats.noContest / stats.bothInPot;
        if (contestRate >= 0.8) {
          const [p1, p2] = key.split(":");
          alerts.push({
            tableId,
            player1Id: p1,
            player2Id: p2,
            alertType: "soft_play",
            severity: contestRate >= 0.9 ? "high" : "medium",
            details: {
              handsTogether: stats.together,
              bothInPot: stats.bothInPot,
              noContestRate: Math.round(contestRate * 100),
              description: `Players ${p1} and ${p2} avoid contesting pots ${Math.round(contestRate * 100)}% of the time (${stats.noContest}/${stats.bothInPot} hands)`,
            },
            status: "pending",
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Get player risk score (0-100)
   */
  getPlayerRiskScore(userId: string): number {
    return this.riskScores.get(userId)?.score ?? 0;
  }

  /**
   * Get all risk scores above threshold
   */
  getActiveRiskFlags(threshold: number = 20): { userId: string; score: number; reasons: string[] }[] {
    const flags: { userId: string; score: number; reasons: string[] }[] = [];
    for (const [userId, entry] of this.riskScores) {
      if (entry.score >= threshold) {
        flags.push({ userId, score: entry.score, reasons: entry.reasons });
      }
    }
    return flags.sort((a, b) => b.score - a.score);
  }

  /**
   * Process alerts and update risk scores
   */
  async processAlerts(alerts: CollusionAlertData[]): Promise<void> {
    for (const alert of alerts) {
      // Save to storage
      try {
        await storage.saveCollusionAlert(alert);
      } catch (e) {
        console.error("[anti-cheat] Failed to save alert:", e);
      }

      // Update risk scores for both players
      const severityWeight = alert.severity === "high" ? 30 : alert.severity === "medium" ? 20 : 10;
      for (const playerId of [alert.player1Id, alert.player2Id]) {
        const existing = this.riskScores.get(playerId) || { score: 0, reasons: [], updatedAt: 0 };
        existing.score = Math.min(100, existing.score + severityWeight);
        existing.reasons.push(`${alert.alertType}: ${alert.details?.description ?? ""}`);
        // Cap at 5 most recent reasons
        if (existing.reasons.length > 5) existing.reasons = existing.reasons.slice(-5);
        existing.updatedAt = Date.now();
        this.riskScores.set(playerId, existing);
      }
    }
  }

  /**
   * Run all checks after a hand completes
   */
  async runPostHandChecks(tableId: string, recentHands: HandData[]): Promise<CollusionAlertData[]> {
    const allAlerts: CollusionAlertData[] = [];

    // Check same IP
    const ipAlerts = this.checkSameIPAtTable(tableId);
    allAlerts.push(...ipAlerts);

    // Check chip dumping
    if (recentHands.length >= 5) {
      const dumpAlerts = this.detectChipDumping(tableId, recentHands);
      allAlerts.push(...dumpAlerts);
    }

    // Check soft play
    if (recentHands.length >= 10) {
      const softAlerts = this.detectSoftPlay(recentHands);
      allAlerts.push(...softAlerts);
    }

    if (allAlerts.length > 0) {
      await this.processAlerts(allAlerts);
    }

    return allAlerts;
  }

  /**
   * Check if hole cards represent a weak hand
   */
  private isWeakHand(holeCards: any): boolean {
    if (!holeCards || !Array.isArray(holeCards) || holeCards.length < 2) return false;

    const ranks = holeCards.map((c: any) => {
      if (typeof c === "string") {
        const r = c.replace(/[shdc]/i, "");
        return this.rankValue(r);
      }
      if (c?.rank) return this.rankValue(c.rank);
      return 0;
    });

    const highCard = Math.max(...ranks);
    const lowCard = Math.min(...ranks);
    const gap = highCard - lowCard;

    // Weak: both cards below 9, or big gap with low card
    if (highCard < 9 && lowCard < 7) return true;
    if (gap >= 5 && lowCard < 8) return true;

    return false;
  }

  private rankValue(rank: string): number {
    const map: Record<string, number> = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
      "9": 9, "10": 10, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
    };
    return map[rank] ?? 0;
  }
}

// Singleton instance
export const antiCheatEngine = new AntiCheatEngine();
