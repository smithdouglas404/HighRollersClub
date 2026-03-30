import { Router, type IRouter } from "express";
import {
  GetGameStateParams,
  GetGameStateResponse,
  PerformActionParams,
  PerformActionBody,
  PerformActionResponse,
} from "@workspace/api-zod";

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

function seededCard(seed: number) {
  return {
    suit: SUITS[seed % 4],
    rank: RANKS[seed % 13],
  };
}

function generateMockPlayers(count: number, tableId: number) {
  const names = [
    { username: "ace_hunter", displayName: "Ace Hunter" },
    { username: "bluff_master", displayName: "Bluff Master" },
    { username: "chip_queen", displayName: "Chip Queen" },
    { username: "dealer_dan", displayName: "Dealer Dan" },
    { username: "pocket_rockets", displayName: "Pocket Rockets" },
    { username: "river_rat", displayName: "River Rat" },
    { username: "shark_88", displayName: "Shark 88" },
    { username: "lucky_draw", displayName: "Lucky Draw" },
    { username: "all_in_alice", displayName: "All-In Alice" },
  ];

  const chipAmounts = [12500, 8400, 15200, 9800, 11000, 7200, 18500, 6300, 14700];

  return Array.from({ length: count }, (_, i) => ({
    seatIndex: i,
    username: names[i].username,
    displayName: names[i].displayName,
    avatarUrl: undefined,
    chips: chipAmounts[(i + tableId) % chipAmounts.length],
    bet: i < 2 ? (i === 0 ? 1 : 2) : 0,
    status: "active" as const,
    isDealer: i === 0,
    isTurn: i === 2,
  }));
}

const router: IRouter = Router();

router.get("/tables/:tableId/game", (req, res) => {
  const { tableId } = GetGameStateParams.parse({ tableId: req.params.tableId });
  const players = generateMockPlayers(6, tableId);
  const communityCards = [seededCard(tableId * 7 + 3), seededCard(tableId * 7 + 11), seededCard(tableId * 7 + 5)];

  const state = GetGameStateResponse.parse({
    tableId,
    pot: 150,
    communityCards,
    currentPhase: "flop",
    currentPlayerIndex: 2,
    dealerIndex: 0,
    players,
    myCards: [seededCard(tableId * 13 + 1), seededCard(tableId * 13 + 9)],
    minRaise: 4,
    maxRaise: 20000,
  });

  res.json(state);
});

router.post("/tables/:tableId/action", (req, res) => {
  const { tableId } = PerformActionParams.parse({ tableId: req.params.tableId });
  const body = PerformActionBody.parse(req.body);

  const players = generateMockPlayers(6, tableId);
  if (body.action === "fold") {
    players[2].status = "folded";
  }

  const state = PerformActionResponse.parse({
    tableId,
    pot: body.action === "call" ? 154 : body.action === "raise" ? 150 + (body.amount ?? 10) : 150,
    communityCards: [seededCard(tableId * 7 + 3), seededCard(tableId * 7 + 11), seededCard(tableId * 7 + 5)],
    currentPhase: "flop",
    currentPlayerIndex: 3,
    dealerIndex: 0,
    players,
    myCards: [seededCard(tableId * 13 + 1), seededCard(tableId * 13 + 9)],
    minRaise: 4,
    maxRaise: 20000,
  });

  res.json(state);
});

export default router;
