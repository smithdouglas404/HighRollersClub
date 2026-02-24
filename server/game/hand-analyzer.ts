/**
 * Hand analysis engine — evaluates hole cards, community cards, pot size,
 * and table position to produce an analysis result compatible with the
 * AIAnalysisPanel's AnalysisResult interface on the client.
 */

export interface Card {
  rank: string;
  suit: string;
}

export interface EvByAction {
  action: string;
  ev: number;
}

export interface HandAnalysisResult {
  rating: "OPTIMAL" | "SUBOPTIMAL";
  overallScore: number;
  evByAction: EvByAction[];
  leaks: string[];
  recommendations: string[];
}

export function analyzeHand(
  holeCards: Card[],
  communityCards: Card[],
  pot: number,
  position: string,
): HandAnalysisResult {
  const highCards = ["A", "K", "Q", "J"];
  const ranks = holeCards.map((c) => c.rank);
  const suits = holeCards.map((c) => c.suit);

  let rating: "OPTIMAL" | "SUBOPTIMAL" = "SUBOPTIMAL";
  let baseEv = 0;
  const leaks: string[] = [];
  const recommendations: string[] = [];

  // Premium hands
  const isPair = ranks[0] === ranks[1];
  const isSuited = suits[0] === suits[1];
  const hasHighCard = ranks.some((r: string) => highCards.includes(r));
  const hasTwoHighCards = ranks.every((r: string) => highCards.includes(r));

  if (isPair && highCards.includes(ranks[0])) {
    rating = "OPTIMAL";
    baseEv = 15;
    recommendations.push("Strong pair - raise from any position");
  } else if (hasTwoHighCards && isSuited) {
    rating = "OPTIMAL";
    baseEv = 10;
    recommendations.push("Strong suited connectors - raise or call");
  } else if (hasTwoHighCards) {
    rating = "OPTIMAL";
    baseEv = 7;
    recommendations.push("Good high cards - raise from late position");
  } else if (isPair) {
    rating = "OPTIMAL";
    baseEv = 5;
    recommendations.push("Medium pair - call, set mine on flop");
  } else if (hasHighCard && isSuited) {
    baseEv = 3;
    recommendations.push("Suited with high card - call from late position");
  } else {
    baseEv = -2;
    leaks.push("Weak starting hand");
    recommendations.push("Consider folding from early/middle position");
  }

  // Position adjustment
  if (position === "late" || position === "button") {
    baseEv += 2;
    recommendations.push("Late position advantage - wider range is acceptable");
  } else if (position === "early") {
    baseEv -= 1;
    if (rating !== "OPTIMAL") {
      leaks.push("Playing marginal hand from early position");
    }
  }

  // Compute overallScore (0-100 scale)
  const overallScore = Math.max(0, Math.min(100, Math.round(50 + baseEv * 3)));

  // Compute EV by action (fold, check/call, raise)
  const evByAction: EvByAction[] = [
    { action: "Fold", ev: 0 },
    { action: "Check/Call", ev: parseFloat((baseEv * 0.8).toFixed(2)) },
    { action: "Raise", ev: parseFloat((baseEv * 1.2).toFixed(2)) },
  ];

  // For weak hands, raising is bad and folding is best
  if (rating === "SUBOPTIMAL") {
    evByAction[0].ev = parseFloat((Math.abs(baseEv) * 0.5).toFixed(2)); // Fold saves chips
    evByAction[2].ev = parseFloat((baseEv * 1.5).toFixed(2)); // Raising weak hand is worse
  }

  return { rating, overallScore, evByAction, leaks, recommendations };
}
