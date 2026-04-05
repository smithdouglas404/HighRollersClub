/**
 * Game Protocol — Shared message types between the API server and the Game Server.
 *
 * The API server publishes GameCommands to Redis `game:command`.
 * The Game Server publishes GameEvents to `game:state:{tableId}` and `game:results`.
 */

// ─── Commands (API Server → Game Server) ────────────────────────────────────

export type GameCommand =
  | {
      type: "create_table";
      tableId: string;
      config: {
        maxPlayers: number;
        smallBlind: number;
        bigBlind: number;
        minBuyIn: number;
        maxBuyIn: number;
        timeBankSeconds?: number;
        allowBots?: boolean;
        gameFormat?: string;
        blindSchedule?: any[];
        ante?: number;
        rakePercent?: number;
        rakeCap?: number;
        straddleEnabled?: boolean;
        bombPotFrequency?: number;
        bombPotAnte?: number;
        [key: string]: any;
      };
    }
  | {
      type: "join_table";
      tableId: string;
      userId: string;
      displayName: string;
      buyIn: number;
      seatIndex?: number;
    }
  | {
      type: "leave_table";
      tableId: string;
      userId: string;
    }
  | {
      type: "player_action";
      tableId: string;
      userId: string;
      action: "fold" | "check" | "call" | "raise";
      amount?: number;
      actionNumber?: number;
    }
  | {
      type: "start_hand";
      tableId: string;
    }
  | {
      type: "sit_out";
      tableId: string;
      userId: string;
    }
  | {
      type: "sit_in";
      tableId: string;
      userId: string;
    }
  | {
      type: "add_chips";
      tableId: string;
      userId: string;
      amount: number;
    }
  | {
      type: "shutdown";
    };

// ─── Events (Game Server → API Server / other consumers) ────────────────────

export type GameEvent =
  | {
      type: "state_update";
      tableId: string;
      state: any;
    }
  | {
      type: "hand_complete";
      tableId: string;
      handId: string;
      results: any;
    }
  | {
      type: "player_joined";
      tableId: string;
      userId: string;
      seatIndex: number;
    }
  | {
      type: "player_left";
      tableId: string;
      userId: string;
    }
  | {
      type: "error";
      tableId?: string;
      userId?: string;
      message: string;
    }
  | {
      type: "table_created";
      tableId: string;
    }
  | {
      type: "table_removed";
      tableId: string;
    };

// ─── Redis channel names ────────────────────────────────────────────────────

export const GAME_COMMAND_CHANNEL = "game:command";

export function gameStateChannel(tableId: string): string {
  return `game:state:${tableId}`;
}

export const GAME_RESULTS_CHANNEL = "game:results";
