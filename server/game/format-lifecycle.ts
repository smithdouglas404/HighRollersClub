import { getDefaultPayouts, type BlindLevel, type PayoutEntry } from "./blind-presets";

export type SNGStatus = "registering" | "playing" | "complete";

export interface EliminationInfo {
  playerId: string;
  displayName: string;
  finishPlace: number;
  prizeAmount: number;
}

export class SNGLifecycle {
  public status: SNGStatus = "registering";
  public registeredPlayers: Map<string, { userId: string; displayName: string; buyIn: number }> = new Map();
  public eliminationOrder: EliminationInfo[] = [];
  public prizePool = 0;

  constructor(
    public maxPlayers: number,
    public buyInAmount: number,
    public startingChips: number,
    public payoutStructure: PayoutEntry[] | null,
    public blindSchedule: BlindLevel[] | null,
  ) {}

  register(userId: string, displayName: string, buyIn: number): boolean {
    if (this.status !== "registering") return false;
    if (this.registeredPlayers.size >= this.maxPlayers) return false;
    if (this.registeredPlayers.has(userId)) return false;

    this.registeredPlayers.set(userId, { userId, displayName, buyIn });
    this.prizePool += buyIn;
    return true;
  }

  canStart(): boolean {
    return this.status === "registering" && this.registeredPlayers.size >= this.maxPlayers;
  }

  start(): void {
    this.status = "playing";
  }

  get playersRemaining(): number {
    return this.registeredPlayers.size - this.eliminationOrder.length;
  }

  handleElimination(playerId: string, displayName: string): EliminationInfo | null {
    if (this.status !== "playing") return null;

    // Already eliminated?
    if (this.eliminationOrder.some(e => e.playerId === playerId)) return null;

    const finishPlace = this.playersRemaining;
    const payouts = this.payoutStructure || getDefaultPayouts(this.registeredPlayers.size);
    const payoutEntry = payouts.find(p => p.place === finishPlace);
    const prizeAmount = payoutEntry ? Math.floor(this.prizePool * payoutEntry.percentage / 100) : 0;

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

  protected completeWithWinner(): void {
    this.status = "complete";

    // Find the winner (player not in elimination order)
    const eliminatedIds = new Set(this.eliminationOrder.map(e => e.playerId));
    for (const [userId, reg] of this.registeredPlayers) {
      if (!eliminatedIds.has(userId)) {
        const payouts = this.payoutStructure || getDefaultPayouts(this.registeredPlayers.size);
        const firstPlacePayout = payouts.find(p => p.place === 1);
        const prizeAmount = firstPlacePayout ? Math.floor(this.prizePool * firstPlacePayout.percentage / 100) : this.prizePool;

        this.eliminationOrder.push({
          playerId: userId,
          displayName: reg.displayName,
          finishPlace: 1,
          prizeAmount,
        });
        break;
      }
    }
  }

  getResults(): EliminationInfo[] {
    return [...this.eliminationOrder].sort((a, b) => a.finishPlace - b.finishPlace);
  }

  isComplete(): boolean {
    return this.status === "complete";
  }

  forfeit(playerId: string, displayName: string): EliminationInfo | null {
    return this.handleElimination(playerId, displayName);
  }
}
