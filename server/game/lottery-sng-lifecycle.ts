import { randomInt } from "crypto";
import { SNGLifecycle, type EliminationInfo } from "./format-lifecycle";
import { HYPER_TURBO_SCHEDULE, type BlindLevel, type PayoutEntry } from "./blind-presets";

// Multiplier distribution (weighted random):
// 2x   - 75% chance (common)
// 3x   - 12% chance
// 5x   - 8% chance
// 10x  - 3% chance
// 25x  - 1.5% chance
// 100x - 0.4% chance
// 1000x - 0.1% chance (jackpot!)

export const MULTIPLIER_TABLE = [
  { multiplier: 2, weight: 7500 },
  { multiplier: 3, weight: 1200 },
  { multiplier: 5, weight: 800 },
  { multiplier: 10, weight: 300 },
  { multiplier: 25, weight: 150 },
  { multiplier: 100, weight: 40 },
  { multiplier: 1000, weight: 10 },
] as const;

const TOTAL_WEIGHT = MULTIPLIER_TABLE.reduce((sum, entry) => sum + entry.weight, 0);

// Available buy-in tiers for Lottery SNG
export const LOTTERY_BUY_IN_TIERS = [100, 250, 500, 1000, 2500, 5000] as const;

// Winner-takes-all payout structure
const WINNER_TAKES_ALL: PayoutEntry[] = [{ place: 1, percentage: 100 }];

export class LotterySNGLifecycle extends SNGLifecycle {
  public multiplier: number = 0;
  public basePrize: number = 0;
  public isSpinning: boolean = false;
  public spinComplete: boolean = false;

  constructor(buyInAmount: number) {
    // 3-player only, 500 starting chips, winner-takes-all, hyper-turbo blinds
    super(
      3,
      buyInAmount,
      500,
      WINNER_TAKES_ALL,
      HYPER_TURBO_SCHEDULE,
    );
  }

  /**
   * Spin the multiplier using cryptographically secure randomness.
   * Returns the selected multiplier.
   */
  spinMultiplier(): number {
    if (this.spinComplete) return this.multiplier;

    this.isSpinning = true;

    // Use crypto.randomInt for fair selection
    const roll = randomInt(0, TOTAL_WEIGHT);

    let cumulative = 0;
    for (const entry of MULTIPLIER_TABLE) {
      cumulative += entry.weight;
      if (roll < cumulative) {
        this.multiplier = entry.multiplier;
        break;
      }
    }

    // Calculate the prize pool: buy-in * 3 players * multiplier
    this.basePrize = this.buyInAmount * 3;
    this.prizePool = this.basePrize * this.multiplier;

    this.isSpinning = false;
    this.spinComplete = true;

    return this.multiplier;
  }

  override canStart(): boolean {
    return this.status === "registering" && this.registeredPlayers.size >= 3;
  }

  override start(): void {
    if (!this.spinComplete) {
      this.spinMultiplier();
    }
    this.status = "playing";
  }

  override handleElimination(playerId: string, displayName: string): EliminationInfo | null {
    if (this.status !== "playing") return null;

    // Already eliminated?
    if (this.eliminationOrder.some(e => e.playerId === playerId)) return null;

    const finishPlace = this.playersRemaining;

    // Only 1st place gets prizes (winner takes all)
    const prizeAmount = finishPlace === 1 ? this.prizePool : 0;

    const info: EliminationInfo = {
      playerId,
      displayName,
      finishPlace,
      prizeAmount,
    };
    this.eliminationOrder.push(info);

    // Check if tournament is complete (only 1 player remaining)
    if (this.playersRemaining <= 1) {
      this.completeWithWinner();
    }

    return info;
  }

  protected override completeWithWinner(): void {
    this.status = "complete";

    // Find the winner (player not in elimination order)
    const eliminatedIds = new Set(this.eliminationOrder.map(e => e.playerId));
    for (const [userId, reg] of this.registeredPlayers) {
      if (!eliminatedIds.has(userId)) {
        this.eliminationOrder.push({
          playerId: userId,
          displayName: reg.displayName,
          finishPlace: 1,
          prizeAmount: this.prizePool,
        });
        break;
      }
    }
  }

  override getResults(): EliminationInfo[] {
    return [...this.eliminationOrder].sort((a, b) => a.finishPlace - b.finishPlace);
  }

  /**
   * Get the multiplier info for display purposes.
   */
  getMultiplierInfo(): {
    multiplier: number;
    prizePool: number;
    basePrize: number;
    buyIn: number;
    spinComplete: boolean;
  } {
    return {
      multiplier: this.multiplier,
      prizePool: this.prizePool,
      basePrize: this.basePrize,
      buyIn: this.buyInAmount,
      spinComplete: this.spinComplete,
    };
  }
}
