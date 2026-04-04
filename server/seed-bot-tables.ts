import { storage } from "./storage";
import { tableManager } from "./game/table-manager";
import { log } from "./vite";

interface BotTableDef {
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  botCount: number;
  pokerVariant?: "nlhe" | "plo";
}

const BOT_TABLES: BotTableDef[] = [
  { name: "Beginner's Table",    smallBlind: 5,   bigBlind: 10,  maxPlayers: 6, botCount: 3 },
  { name: "Mid Stakes Grind",    smallBlind: 25,  bigBlind: 50,  maxPlayers: 9, botCount: 4 },
  { name: "High Rollers Lounge", smallBlind: 100, bigBlind: 200, maxPlayers: 6, botCount: 2 },
  { name: "Heads Up Duel",       smallBlind: 50,  bigBlind: 100, maxPlayers: 2, botCount: 2 },
  { name: "PLO Action",          smallBlind: 10,  bigBlind: 20,  maxPlayers: 6, botCount: 3, pokerVariant: "plo" },
];

/**
 * Seed pre-populated bot tables so the lobby is never empty.
 * Skips entirely if any tables already exist (avoids duplication on restart).
 */
export async function seedBotTables(): Promise<void> {
  try {
    const existing = await storage.getTables();
    if (existing.length > 0) {
      log("[seed-bot-tables] Tables already exist — skipping bot table seeding.");
      return;
    }

    log("[seed-bot-tables] No tables found — creating bot tables...");

    for (const def of BOT_TABLES) {
      const minBuyIn = def.bigBlind * 20;
      const maxBuyIn = def.bigBlind * 100;

      const table = await storage.createTable({
        name: def.name,
        maxPlayers: def.maxPlayers,
        smallBlind: def.smallBlind,
        bigBlind: def.bigBlind,
        minBuyIn,
        maxBuyIn,
        ante: 0,
        timeBankSeconds: 30,
        isPrivate: false,
        allowBots: true,
        replaceBots: true,
        gameFormat: "cash" as const,
        buyInAmount: 0,
        startingChips: 1500,
        createdById: "system",
        gameSpeed: "normal" as const,
        bombPotFrequency: 0,
        bombPotAnte: 0,
        rakePercent: 0,
        rakeCap: 0,
        straddleEnabled: false,
        awayTimeoutMinutes: 5,
        showAllHands: true,
        runItTwice: "no",
        showdownSpeed: "normal",
        dealToAwayPlayers: false,
        timeBankRefillHands: 0,
        spectatorMode: true,
        doubleBoard: false,
        sevenTwoBounty: 0,
        guestChatEnabled: true,
        autoTrimExcessBets: false,
        pokerVariant: def.pokerVariant || "nlhe",
        useCentsValues: false,
        requireAdminApproval: false,
        allowSpectators: true,
        clubMembersOnly: false,
      });

      // Add bots to this table — tableManager.addBots fills up to maxPlayers,
      // but we only want `botCount` bots. We call addBots which fills remaining
      // seats. Since the table starts empty, it will add up to BOT_NAMES.length
      // bots (capped at maxPlayers). For tables where we want fewer bots than
      // maxPlayers (leaving room for humans), we accept that addBots fills to
      // capacity — human join will replace bots when replaceBots is enabled.
      try {
        await tableManager.addBots(table.id);
        log(`[seed-bot-tables] Created "${def.name}" (${def.smallBlind}/${def.bigBlind}) with bots.`);
      } catch (err) {
        log(`[seed-bot-tables] Created "${def.name}" but failed to add bots: ${err}`);
      }
    }

    log(`[seed-bot-tables] Seeded ${BOT_TABLES.length} bot tables.`);
  } catch (err) {
    console.error("[seed-bot-tables] Failed to seed bot tables:", err);
  }
}
