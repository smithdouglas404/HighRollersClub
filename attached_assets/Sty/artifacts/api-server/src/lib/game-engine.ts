import { db } from "@workspace/db";
import {
  gameSessionsTable,
  gamePlayersTable,
  handHistoryTable,
  pokerTablesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { createDeck, shuffleDeck, serializeDeck, deserializeDeck, type Card } from "./deck";
import { evaluateHand, type HandResult } from "./hand-evaluator";
import { creditChips, debitChips, getBalance } from "./wallet";

export type GamePhase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "finished";
export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";

interface ActionRecord {
  seat: number;
  userId: number;
  action: PlayerAction;
  amount: number;
  phase: string;
  timestamp: number;
}

export async function getOrCreateSession(tableId: number) {
  const [existing] = await db
    .select()
    .from(gameSessionsTable)
    .where(and(eq(gameSessionsTable.tableId, tableId), eq(gameSessionsTable.isActive, true)));

  if (existing) return existing;

  const [session] = await db.insert(gameSessionsTable).values({
    tableId,
    phase: "waiting",
    pot: 0,
    dealerSeat: 0,
    handNumber: 1,
  }).returning();

  return session;
}

export async function joinTable(tableId: number, userId: number, seatIndex: number, buyIn: number) {
  const session = await getOrCreateSession(tableId);

  const existingPlayers = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));

  const seatTaken = existingPlayers.some(p => p.seatIndex === seatIndex);
  if (seatTaken) throw new Error("Seat is taken");

  const alreadySeated = existingPlayers.some(p => p.userId === userId);
  if (alreadySeated) throw new Error("Already seated at this table");

  const [table] = await db.select().from(pokerTablesTable).where(eq(pokerTablesTable.id, tableId));
  if (!table) throw new Error("Table not found");
  if (existingPlayers.length >= table.maxPlayers) throw new Error("Table is full");

  if (table.minBuyIn && buyIn < table.minBuyIn) throw new Error(`Minimum buy-in is ${table.minBuyIn}`);
  if (table.maxBuyIn && buyIn > table.maxBuyIn) throw new Error(`Maximum buy-in is ${table.maxBuyIn}`);

  await debitChips(userId, buyIn, "buy_in", `Buy-in at table ${table.name}`, "table", tableId);

  const [player] = await db.insert(gamePlayersTable).values({
    sessionId: session.id,
    userId,
    seatIndex,
    chips: buyIn,
    status: "waiting",
  }).returning();

  await db.update(pokerTablesTable)
    .set({ currentPlayers: existingPlayers.length + 1 })
    .where(eq(pokerTablesTable.id, tableId));

  return player;
}

export async function leaveTable(tableId: number, userId: number) {
  const session = await getOrCreateSession(tableId);
  const [player] = await db.select().from(gamePlayersTable)
    .where(and(
      eq(gamePlayersTable.sessionId, session.id),
      eq(gamePlayersTable.userId, userId),
    ));

  if (!player) throw new Error("Not seated at this table");
  if (player.status === "active") throw new Error("Cannot leave during active hand");

  if (player.chips > 0) {
    await creditChips(userId, player.chips, "cash_out", `Cash out from table`, "table", tableId);
  }

  await db.delete(gamePlayersTable).where(eq(gamePlayersTable.id, player.id));

  const remaining = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));
  await db.update(pokerTablesTable)
    .set({ currentPlayers: remaining.length })
    .where(eq(pokerTablesTable.id, tableId));
}

export async function startHand(tableId: number) {
  const session = await getOrCreateSession(tableId);
  const players = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));

  const activePlayers = players.filter(p => p.chips > 0);
  if (activePlayers.length < 2) throw new Error("Need at least 2 players");

  const [table] = await db.select().from(pokerTablesTable).where(eq(pokerTablesTable.id, tableId));
  if (!table) throw new Error("Table not found");

  const deck = shuffleDeck(createDeck());
  let deckIndex = 0;

  const sortedPlayers = activePlayers.sort((a, b) => a.seatIndex - b.seatIndex);
  const dealerSeat = sortedPlayers[session.handNumber % sortedPlayers.length].seatIndex;

  const seatOrder = sortedPlayers.map(p => p.seatIndex);
  const dealerIdx = seatOrder.indexOf(dealerSeat);

  const sbIdx = (dealerIdx + 1) % seatOrder.length;
  const bbIdx = (dealerIdx + 2) % seatOrder.length;

  const sb = table.smallBlind;
  const bb = table.bigBlind;

  for (const p of sortedPlayers) {
    const holeCards: Card[] = [deck[deckIndex++], deck[deckIndex++]];
    let currentBet = 0;
    let chips = p.chips;

    if (p.seatIndex === seatOrder[sbIdx]) {
      const sbAmount = Math.min(sb, chips);
      currentBet = sbAmount;
      chips -= sbAmount;
    } else if (p.seatIndex === seatOrder[bbIdx]) {
      const bbAmount = Math.min(bb, chips);
      currentBet = bbAmount;
      chips -= bbAmount;
    }

    await db.update(gamePlayersTable).set({
      holeCards: holeCards as any,
      status: "active",
      currentBet,
      chips,
      isDealer: p.seatIndex === dealerSeat,
      lastAction: null,
      lastActionAmount: null,
    }).where(eq(gamePlayersTable.id, p.id));
  }

  const totalBlinds = Math.min(sb, sortedPlayers.find(p => p.seatIndex === seatOrder[sbIdx])!.chips) +
    Math.min(bb, sortedPlayers.find(p => p.seatIndex === seatOrder[bbIdx])!.chips);

  const firstToAct = seatOrder[(bbIdx + 1) % seatOrder.length];

  const remainingDeck = deck.slice(deckIndex);

  await db.update(gameSessionsTable).set({
    phase: "preflop",
    pot: totalBlinds,
    dealerSeat,
    currentSeat: firstToAct,
    communityCards: [],
    deckState: serializeDeck(remainingDeck),
    updatedAt: new Date(),
  }).where(eq(gameSessionsTable.id, session.id));

  await db.update(pokerTablesTable)
    .set({ status: "in_progress" })
    .where(eq(pokerTablesTable.id, tableId));

  return getGameState(tableId, null);
}

export async function performAction(
  tableId: number,
  userId: number,
  action: PlayerAction,
  amount?: number,
): Promise<any> {
  const session = await getOrCreateSession(tableId);
  if (session.phase === "waiting" || session.phase === "finished") {
    throw new Error("No active hand");
  }

  const players = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));

  const player = players.find(p => p.userId === userId);
  if (!player) throw new Error("Not seated at this table");
  if (player.seatIndex !== session.currentSeat) throw new Error("Not your turn");
  if (player.status !== "active") throw new Error("You cannot act");

  const [table] = await db.select().from(pokerTablesTable).where(eq(pokerTablesTable.id, tableId));
  if (!table) throw new Error("Table not found");

  const activePlayers = players.filter(p => p.status === "active");
  const maxBet = Math.max(...activePlayers.map(p => p.currentBet));
  const toCall = maxBet - player.currentBet;

  let newBet = player.currentBet;
  let newChips = player.chips;
  let newStatus = player.status;
  let pot = session.pot;

  const actions = (session.communityCards as any)?.actions || [];
  const actionRecord: ActionRecord = {
    seat: player.seatIndex,
    userId,
    action,
    amount: 0,
    phase: session.phase,
    timestamp: Date.now(),
  };

  switch (action) {
    case "fold":
      newStatus = "folded";
      break;

    case "check":
      if (toCall > 0) throw new Error("Cannot check — must call or raise");
      break;

    case "call": {
      const callAmount = Math.min(toCall, newChips);
      newChips -= callAmount;
      newBet += callAmount;
      pot += callAmount;
      actionRecord.amount = callAmount;
      if (newChips === 0) newStatus = "all_in";
      break;
    }

    case "raise": {
      if (!amount) throw new Error("Raise amount required");
      const totalRaise = amount;
      if (totalRaise < maxBet + table.bigBlind && totalRaise < player.chips + player.currentBet) {
        throw new Error(`Minimum raise is ${maxBet + table.bigBlind}`);
      }
      const raiseChips = totalRaise - player.currentBet;
      if (raiseChips > newChips) throw new Error("Not enough chips");
      newChips -= raiseChips;
      pot += raiseChips;
      newBet = totalRaise;
      actionRecord.amount = totalRaise;
      if (newChips === 0) newStatus = "all_in";
      break;
    }

    case "all_in": {
      const allInAmount = newChips;
      pot += allInAmount;
      newBet += allInAmount;
      newChips = 0;
      newStatus = "all_in";
      actionRecord.amount = allInAmount;
      break;
    }
  }

  await db.update(gamePlayersTable).set({
    chips: newChips,
    currentBet: newBet,
    status: newStatus,
    lastAction: action,
    lastActionAmount: actionRecord.amount,
  }).where(eq(gamePlayersTable.id, player.id));

  const updatedPlayers = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));

  const stillActive = updatedPlayers.filter(p => p.status === "active" || p.status === "all_in");
  const canAct = updatedPlayers.filter(p => p.status === "active");

  if (stillActive.length <= 1) {
    return resolveHand(tableId, session.id, pot);
  }

  const betsSettled = canAct.every(p => p.currentBet === Math.max(...stillActive.map(sp => sp.currentBet))) || canAct.length <= 1;

  const seatOrder = updatedPlayers
    .filter(p => p.status === "active")
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map(p => p.seatIndex);

  const currentIdx = seatOrder.indexOf(player.seatIndex);
  let nextSeat = seatOrder[(currentIdx + 1) % seatOrder.length];

  if (betsSettled && nextSeat <= player.seatIndex || (betsSettled && canAct.length <= 1)) {
    return advancePhase(tableId, session.id, pot);
  }

  await db.update(gameSessionsTable).set({
    pot,
    currentSeat: nextSeat,
    updatedAt: new Date(),
  }).where(eq(gameSessionsTable.id, session.id));

  return getGameState(tableId, userId);
}

async function advancePhase(tableId: number, sessionId: number, pot: number) {
  const [session] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.id, sessionId));
  const deck = deserializeDeck(session.deckState!);
  let community = (session.communityCards as Card[]) || [];
  let deckIndex = 0;

  let nextPhase: GamePhase;

  switch (session.phase) {
    case "preflop":
      community = [deck[deckIndex++], deck[deckIndex++], deck[deckIndex++]];
      nextPhase = "flop";
      break;
    case "flop":
      community = [...community, deck[deckIndex++]];
      nextPhase = "turn";
      break;
    case "turn":
      community = [...community, deck[deckIndex++]];
      nextPhase = "river";
      break;
    case "river":
      return resolveHand(tableId, sessionId, pot);
    default:
      throw new Error(`Cannot advance from phase ${session.phase}`);
  }

  const players = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, sessionId));

  for (const p of players.filter(pp => pp.status === "active")) {
    await db.update(gamePlayersTable).set({ currentBet: 0 }).where(eq(gamePlayersTable.id, p.id));
  }

  const activePlayers = players.filter(p => p.status === "active").sort((a, b) => a.seatIndex - b.seatIndex);
  const dealerIdx = activePlayers.findIndex(p => p.isDealer);
  const firstToAct = activePlayers[(dealerIdx + 1) % activePlayers.length]?.seatIndex ?? activePlayers[0].seatIndex;

  const remainingDeck = deck.slice(deckIndex);

  await db.update(gameSessionsTable).set({
    phase: nextPhase,
    pot,
    communityCards: community,
    deckState: serializeDeck(remainingDeck),
    currentSeat: firstToAct,
    updatedAt: new Date(),
  }).where(eq(gameSessionsTable.id, sessionId));

  return getGameState(tableId, null);
}

async function resolveHand(tableId: number, sessionId: number, pot: number) {
  const [session] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.id, sessionId));
  const players = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, sessionId));

  const eligible = players.filter(p => p.status === "active" || p.status === "all_in");
  let community = (session.communityCards as Card[]) || [];

  if (community.length < 5 && eligible.length > 1) {
    const deck = deserializeDeck(session.deckState!);
    let idx = 0;
    while (community.length < 5) {
      community.push(deck[idx++]);
    }
  }

  let winnerId: number;
  let winnerHand = "Last Standing";

  if (eligible.length === 1) {
    winnerId = eligible[0].userId;
  } else {
    const results = eligible.map(p => ({
      player: p,
      hand: evaluateHand(p.holeCards as Card[], community),
    }));
    results.sort((a, b) => b.hand.score - a.hand.score);
    winnerId = results[0].player.userId;
    winnerHand = results[0].hand.name;
  }

  const winner = players.find(p => p.userId === winnerId)!;
  await db.update(gamePlayersTable).set({
    chips: winner.chips + pot,
  }).where(eq(gamePlayersTable.id, winner.id));

  const actionLog = players.map(p => ({
    seat: p.seatIndex,
    userId: p.userId,
    finalStatus: p.status,
    lastAction: p.lastAction,
  }));

  await db.insert(handHistoryTable).values({
    sessionId,
    tableId,
    handNumber: session.handNumber,
    actions: actionLog,
    communityCards: community,
    potTotal: pot,
    winnerId,
    winnerHand,
  });

  for (const p of players) {
    await db.update(gamePlayersTable).set({
      status: p.chips > 0 || p.userId === winnerId ? "waiting" : "busted",
      currentBet: 0,
      holeCards: null,
      lastAction: null,
      lastActionAmount: null,
      isDealer: false,
    }).where(eq(gamePlayersTable.id, p.id));
  }

  await db.update(gameSessionsTable).set({
    phase: "showdown",
    pot: 0,
    communityCards: community,
    currentSeat: null,
    handNumber: session.handNumber + 1,
    updatedAt: new Date(),
  }).where(eq(gameSessionsTable.id, sessionId));

  await db.update(usersTable).set({
    gamesPlayed: (await db.select().from(usersTable).where(eq(usersTable.id, winnerId)))[0].gamesPlayed + 1,
    gamesWon: (await db.select().from(usersTable).where(eq(usersTable.id, winnerId)))[0].gamesWon + 1,
  }).where(eq(usersTable.id, winnerId));

  for (const p of players.filter(pp => pp.userId !== winnerId)) {
    await db.update(usersTable).set({
      gamesPlayed: (await db.select().from(usersTable).where(eq(usersTable.id, p.userId)))[0].gamesPlayed + 1,
    }).where(eq(usersTable.id, p.userId));
  }

  return getGameState(tableId, null);
}

export async function getGameState(tableId: number, viewerUserId: number | null) {
  const session = await getOrCreateSession(tableId);
  const players = await db.select().from(gamePlayersTable)
    .where(eq(gamePlayersTable.sessionId, session.id));

  const [table] = await db.select().from(pokerTablesTable).where(eq(pokerTablesTable.id, tableId));

  const isShowdown = session.phase === "showdown";

  const mappedPlayers = players
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map(p => {
      const user = { displayName: "", username: "" };
      return {
        seatIndex: p.seatIndex,
        oduserId: p.userId,
        chips: p.chips,
        currentBet: p.currentBet,
        status: p.status,
        isDealer: p.isDealer,
        isTurn: p.seatIndex === session.currentSeat,
        lastAction: p.lastAction,
        holeCards: (p.userId === viewerUserId || isShowdown)
          ? p.holeCards as Card[] | null
          : (p.holeCards ? [{ suit: "back" as any, rank: "back" as any }, { suit: "back" as any, rank: "back" as any }] : null),
      };
    });

  const userIds = players.map(p => p.userId);
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(
          userIds.length === 1
            ? eq(usersTable.id, userIds[0])
            : eq(usersTable.id, userIds[0])
        )
    : [];

  const allUsers = userIds.length > 0
    ? await Promise.all(userIds.map(id =>
        db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
          .from(usersTable).where(eq(usersTable.id, id)).then(r => r[0])
      ))
    : [];

  const userMap = new Map(allUsers.filter(Boolean).map(u => [u!.id, u!]));

  const enrichedPlayers = mappedPlayers.map(p => {
    const u = userMap.get(p.oduserId);
    return {
      ...p,
      userId: p.oduserId,
      username: u?.username ?? "unknown",
      displayName: u?.displayName ?? "Unknown",
      avatarUrl: u?.avatarUrl ?? null,
    };
  });

  return {
    tableId,
    sessionId: session.id,
    phase: session.phase,
    pot: session.pot,
    communityCards: session.communityCards as Card[],
    dealerSeat: session.dealerSeat,
    currentSeat: session.currentSeat,
    handNumber: session.handNumber,
    players: enrichedPlayers,
    tableName: table?.name ?? "Unknown",
    smallBlind: table?.smallBlind ?? 1,
    bigBlind: table?.bigBlind ?? 2,
  };
}
