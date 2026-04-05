/**
 * Ledger Engine — Session tracking, P&L calculations, settlement algorithm
 *
 * 3-Tier visibility:
 * 1. Player: own P&L per session/table
 * 2. Club Owner: all players' P&L, "who owes who" settlement
 * 3. Platform Admin: global financial overview
 */

// ─── Settlement Algorithm ───────────────────────────────────────────────────

export interface PlayerResult {
  userId: string;
  displayName: string;
  buyIn: number;
  cashOut: number;
  net: number; // cashOut - buyIn
}

export interface Settlement {
  from: string;       // userId of debtor
  fromName: string;
  to: string;         // userId of creditor
  toName: string;
  amount: number;
}

/**
 * Calculate minimum settlements to balance a game.
 * Uses greedy matching: biggest debtor pays biggest creditor first.
 * Minimizes the number of individual transfers needed.
 */
export function calculateSettlements(results: PlayerResult[]): Settlement[] {
  const settlements: Settlement[] = [];

  // Separate into debtors (lost money) and creditors (won money)
  const debtors = results
    .filter(r => r.net < 0)
    .map(r => ({ ...r, remaining: Math.abs(r.net) }))
    .sort((a, b) => b.remaining - a.remaining); // biggest debtor first

  const creditors = results
    .filter(r => r.net > 0)
    .map(r => ({ ...r, remaining: r.net }))
    .sort((a, b) => b.remaining - a.remaining); // biggest creditor first

  // Greedy matching
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];

    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0) {
      settlements.push({
        from: debtor.userId,
        fromName: debtor.displayName,
        to: creditor.userId,
        toName: creditor.displayName,
        amount: Math.round(amount),
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining <= 0) di++;
    if (creditor.remaining <= 0) ci++;
  }

  return settlements;
}

/**
 * Generate a summary from session data
 */
export function summarizeSessions(sessions: Array<{
  userId: string;
  displayName: string;
  buyInTotal: number;
  cashOutTotal: number;
  netResult: number;
  handsPlayed: number;
}>): {
  results: PlayerResult[];
  settlements: Settlement[];
  totalPot: number;
  totalRake: number;
  playerCount: number;
  handsPlayed: number;
} {
  // Aggregate by player (in case someone sat down multiple times)
  const byPlayer = new Map<string, PlayerResult>();
  let totalHands = 0;

  for (const s of sessions) {
    const existing = byPlayer.get(s.userId);
    if (existing) {
      existing.buyIn += s.buyInTotal;
      existing.cashOut += s.cashOutTotal;
      existing.net += s.netResult;
    } else {
      byPlayer.set(s.userId, {
        userId: s.userId,
        displayName: s.displayName,
        buyIn: s.buyInTotal,
        cashOut: s.cashOutTotal,
        net: s.netResult,
      });
    }
    totalHands += s.handsPlayed;
  }

  const results = Array.from(byPlayer.values()).sort((a, b) => b.net - a.net);
  const settlements = calculateSettlements(results);
  const totalBuyIn = results.reduce((sum, r) => sum + r.buyIn, 0);
  const totalCashOut = results.reduce((sum, r) => sum + r.cashOut, 0);
  const totalRake = totalBuyIn - totalCashOut; // difference is rake

  return {
    results,
    settlements,
    totalPot: totalBuyIn,
    totalRake: Math.max(0, totalRake),
    playerCount: results.length,
    handsPlayed: totalHands,
  };
}
