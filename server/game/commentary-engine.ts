// AI Commentary Engine — Two-voice poker broadcast system
// Generates WSOP-style commentary via Anthropic Claude + ElevenLabs TTS.
// Observes game events, aggregates player stats, and selectively triggers
// commentary for showdowns, big pots, player tendency discussions, etc.

import type { GameEngine, HandSummary, GamePhase, GameFormat, SeatPlayer } from "./engine";
import type { CardType } from "./hand-evaluator";
import { getAnthropicApiKey } from "./ai-bot-engine";
import { generateSegmentAudio, type AudioAttachment } from "./tts-engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CommentaryTrigger =
  | "showdown_complete"
  | "all_in"
  | "big_pot"
  | "unusual_bet"
  | "player_tendency"
  | "session_ledger"
  | "blind_increase"
  | "player_eliminated"
  | "table_meta";

export interface CommentaryLine {
  speaker: "pbp" | "analyst";
  text: string;
  emphasis: "normal" | "excited" | "thoughtful";
}

export interface CommentarySegment {
  id: string;
  trigger: CommentaryTrigger;
  lines: CommentaryLine[];
  handNumber: number;
  timestamp: number;
  audio?: AudioAttachment[];
}

interface PlayerSessionStats {
  displayName: string;
  handsPlayed: number;
  vpipCount: number;
  pfrCount: number;
  showdownCount: number;
  handsWon: number;
  startingStack: number;
  currentStack: number;
  netResult: number;
  biggestPotWon: number;
  isShortStack: boolean;
  isChipLeader: boolean;
}

interface TableCommentaryState {
  tableId: string;
  subscribers: Map<string, { omniscient: boolean }>; // userId -> prefs
  lastCommentaryTime: number;
  handsSinceLastNonShowdown: number;
  recentHandSummaries: HandSummary[];
  sessionStats: Map<string, PlayerSessionStats>;
  isGenerating: boolean;
  segmentCounter: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMMENTARY_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;
const LLM_TIMEOUT_MS = 10_000;
const MIN_COOLDOWN_MS = 15_000;
const MAX_RECENT_SUMMARIES = 10;
const TENDENCY_INTERVAL_MIN = 5;
const TENDENCY_INTERVAL_MAX = 8;
const LEDGER_INTERVAL_MIN = 10;
const LEDGER_INTERVAL_MAX = 15;

// ─── Module State ────────────────────────────────────────────────────────────

const tableStates = new Map<string, TableCommentaryState>();

let nextTendencyAt = randomBetween(TENDENCY_INTERVAL_MIN, TENDENCY_INTERVAL_MAX);
let nextLedgerAt = randomBetween(LEDGER_INTERVAL_MIN, LEDGER_INTERVAL_MAX);

// ─── Public API ──────────────────────────────────────────────────────────────

export function getCommentaryState(tableId: string): TableCommentaryState | undefined {
  return tableStates.get(tableId);
}

export function subscribeCommentary(tableId: string, userId: string, omniscient: boolean = false) {
  let state = tableStates.get(tableId);
  if (!state) {
    state = {
      tableId,
      subscribers: new Map(),
      lastCommentaryTime: 0,
      handsSinceLastNonShowdown: 0,
      recentHandSummaries: [],
      sessionStats: new Map(),
      isGenerating: false,
      segmentCounter: 0,
    };
    tableStates.set(tableId, state);
  }
  state.subscribers.set(userId, { omniscient });
}

export function unsubscribeCommentary(tableId: string, userId: string) {
  const state = tableStates.get(tableId);
  if (!state) return;
  state.subscribers.delete(userId);
  if (state.subscribers.size === 0) {
    tableStates.delete(tableId);
  }
}

export function setOmniscientMode(tableId: string, userId: string, omniscient: boolean) {
  const state = tableStates.get(tableId);
  if (!state) return;
  const sub = state.subscribers.get(userId);
  if (sub) sub.omniscient = omniscient;
}

export function hasSubscribers(tableId: string): boolean {
  const state = tableStates.get(tableId);
  return !!state && state.subscribers.size > 0;
}

export function cleanupTable(tableId: string) {
  tableStates.delete(tableId);
}

// ─── Event Handlers (called from table-manager) ─────────────────────────────

export async function onHandComplete(
  tableId: string,
  summary: HandSummary,
  engine: GameEngine,
  sendToUser: (userId: string, msg: any) => void,
) {
  const state = tableStates.get(tableId);
  if (!state || state.subscribers.size === 0) return;
  if (state.isGenerating) return;

  // Update session stats
  updateSessionStats(state, summary, engine);

  // Store recent summary
  state.recentHandSummaries.push(summary);
  if (state.recentHandSummaries.length > MAX_RECENT_SUMMARIES) {
    state.recentHandSummaries.shift();
  }

  // Determine triggers
  const triggers = evaluateTriggers(state, summary, engine);
  if (triggers.length === 0) {
    state.handsSinceLastNonShowdown++;
    return;
  }

  // Cooldown check
  const now = Date.now();
  if (now - state.lastCommentaryTime < MIN_COOLDOWN_MS) return;

  state.isGenerating = true;
  state.lastCommentaryTime = now;

  try {
    // Generate commentary for each subscriber group (omniscient vs not)
    const omniscientUsers: string[] = [];
    const normalUsers: string[] = [];
    for (const [userId, prefs] of state.subscribers) {
      if (prefs.omniscient) omniscientUsers.push(userId);
      else normalUsers.push(userId);
    }

    const primaryTrigger = triggers[0];

    // Generate normal (non-omniscient) commentary
    if (normalUsers.length > 0) {
      const segment = await generateCommentary(state, summary, engine, primaryTrigger, false);
      if (segment) {
        // Generate audio
        const withAudio = await generateSegmentAudio(segment);
        for (const userId of normalUsers) {
          sendToUser(userId, { type: "commentary", segment: serializeSegment(withAudio) });
        }
      }
    }

    // Generate omniscient commentary (different prompt)
    if (omniscientUsers.length > 0) {
      const segment = await generateCommentary(state, summary, engine, primaryTrigger, true);
      if (segment) {
        const withAudio = await generateSegmentAudio(segment);
        for (const userId of omniscientUsers) {
          sendToUser(userId, { type: "commentary", segment: serializeSegment(withAudio) });
        }
      }
    }

    // Reset counters based on trigger type
    if (primaryTrigger !== "showdown_complete") {
      state.handsSinceLastNonShowdown = 0;
    }
  } catch (err) {
    // Silently fail — no commentary is better than broken commentary
    console.warn(`[commentary] Generation failed for table ${tableId}:`, err);
  } finally {
    state.isGenerating = false;
  }
}

export async function onBlindIncrease(
  tableId: string,
  level: { level: number; sb: number; bb: number; ante: number },
  engine: GameEngine,
  sendToUser: (userId: string, msg: any) => void,
) {
  const state = tableStates.get(tableId);
  if (!state || state.subscribers.size === 0 || state.isGenerating) return;

  state.isGenerating = true;
  try {
    const segment = await generateBlindCommentary(state, level, engine);
    if (segment) {
      const withAudio = await generateSegmentAudio(segment);
      for (const [userId] of state.subscribers) {
        sendToUser(userId, { type: "commentary", segment: serializeSegment(withAudio) });
      }
    }
  } catch {
    // silent
  } finally {
    state.isGenerating = false;
  }
}

export async function onPlayerEliminated(
  tableId: string,
  playerId: string,
  displayName: string,
  finishPlace: number,
  prizeAmount: number,
  engine: GameEngine,
  sendToUser: (userId: string, msg: any) => void,
) {
  const state = tableStates.get(tableId);
  if (!state || state.subscribers.size === 0 || state.isGenerating) return;

  state.isGenerating = true;
  try {
    const segment = await generateEliminationCommentary(state, displayName, finishPlace, prizeAmount, engine);
    if (segment) {
      const withAudio = await generateSegmentAudio(segment);
      for (const [userId] of state.subscribers) {
        sendToUser(userId, { type: "commentary", segment: serializeSegment(withAudio) });
      }
    }
  } catch {
    // silent
  } finally {
    state.isGenerating = false;
  }
}

// ─── Trigger Evaluation ──────────────────────────────────────────────────────

function evaluateTriggers(
  state: TableCommentaryState,
  summary: HandSummary,
  engine: GameEngine,
): CommentaryTrigger[] {
  const triggers: CommentaryTrigger[] = [];
  const bb = engine.state.minBet || 1;

  // Showdown — always comment
  if (summary.showdownResults && summary.showdownResults.length > 0) {
    triggers.push("showdown_complete");
  }

  // All-in with big pot
  const hasAllIn = summary.actions.some(a => a.action === "all-in");
  if (hasAllIn && summary.pot > bb * 10) {
    triggers.push("all_in");
  }

  // Big pot without showdown
  if (summary.pot > bb * 20 && !summary.showdownResults?.length) {
    triggers.push("big_pot");
  }

  // Periodic player tendency discussion
  if (state.handsSinceLastNonShowdown >= nextTendencyAt && hasInterestingStats(state)) {
    triggers.push("player_tendency");
    nextTendencyAt = randomBetween(TENDENCY_INTERVAL_MIN, TENDENCY_INTERVAL_MAX);
  }

  // Periodic session ledger discussion
  if (state.handsSinceLastNonShowdown >= nextLedgerAt) {
    triggers.push("session_ledger");
    nextLedgerAt = randomBetween(LEDGER_INTERVAL_MIN, LEDGER_INTERVAL_MAX);
  }

  return triggers;
}

function hasInterestingStats(state: TableCommentaryState): boolean {
  for (const [, stats] of state.sessionStats) {
    if (stats.handsPlayed < 5) continue;
    const vpipPct = (stats.vpipCount / stats.handsPlayed) * 100;
    const pfrPct = (stats.pfrCount / stats.handsPlayed) * 100;
    // Extreme VPIP or PFR
    if (vpipPct > 60 || vpipPct < 12 || pfrPct > 35 || pfrPct < 5) return true;
    // Big winner or loser
    if (Math.abs(stats.netResult) > stats.startingStack * 0.5) return true;
  }
  return false;
}

// ─── Stats Aggregation ───────────────────────────────────────────────────────

function updateSessionStats(state: TableCommentaryState, summary: HandSummary, engine: GameEngine) {
  // Initialize stats for new players
  for (const p of engine.state.players) {
    if (!state.sessionStats.has(p.id)) {
      state.sessionStats.set(p.id, {
        displayName: p.displayName,
        handsPlayed: 0,
        vpipCount: 0,
        pfrCount: 0,
        showdownCount: 0,
        handsWon: 0,
        startingStack: p.chips,
        currentStack: p.chips,
        netResult: 0,
        biggestPotWon: 0,
        isShortStack: false,
        isChipLeader: false,
      });
    }
  }

  // Increment hands played for participants
  for (const p of summary.players) {
    const stats = state.sessionStats.get(p.id);
    if (stats) {
      stats.handsPlayed++;
    }
  }

  // Update VPIP/PFR from engine
  for (const vpipId of engine.vpipPlayers) {
    const stats = state.sessionStats.get(vpipId);
    if (stats) stats.vpipCount++;
  }
  for (const pfrId of engine.pfrPlayers) {
    const stats = state.sessionStats.get(pfrId);
    if (stats) stats.pfrCount++;
  }

  // Update showdown count
  if (summary.showdownResults?.length) {
    for (const result of summary.showdownResults) {
      const stats = state.sessionStats.get(result.playerId);
      if (stats) stats.showdownCount++;
    }
  }

  // Update winners
  for (const w of summary.winners) {
    const stats = state.sessionStats.get(w.playerId);
    if (stats) {
      stats.handsWon++;
      if (w.amount > stats.biggestPotWon) stats.biggestPotWon = w.amount;
    }
  }

  // Update current stacks and compute chip leader / short stack
  const activeStacks: number[] = [];
  for (const p of engine.state.players) {
    const stats = state.sessionStats.get(p.id);
    if (stats) {
      stats.currentStack = p.chips;
      stats.netResult = p.chips - stats.startingStack;
    }
    if (p.chips > 0) activeStacks.push(p.chips);
  }

  const maxStack = Math.max(...activeStacks, 0);
  const avgStack = activeStacks.length > 0 ? activeStacks.reduce((a, b) => a + b, 0) / activeStacks.length : 0;

  for (const [, stats] of state.sessionStats) {
    stats.isChipLeader = stats.currentStack === maxStack && maxStack > 0;
    stats.isShortStack = stats.currentStack > 0 && stats.currentStack < avgStack * 0.4;
  }

  // Remove departed players
  const activePlayers = new Set(engine.state.players.map(p => p.id));
  for (const [id] of state.sessionStats) {
    if (!activePlayers.has(id)) {
      state.sessionStats.delete(id);
    }
  }
}

// ─── LLM Commentary Generation ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing live poker commentary as a two-person broadcast team, like Lon McEachern and Norman Chad at the WSOP.

PLAY-BY-PLAY (pbp): Describes the action, sets the scene, provides factual narration. Professional, measured, occasionally dramatic. Uses poker terminology precisely. Opens topics, introduces stats.

ANALYST (analyst): Provides color commentary, analysis, humor, and opinion. More casual, witty, sometimes irreverent. Offers strategic insight, reads on players, and memorable observations. Reacts to what pbp says.

FORMAT: Return a JSON array of dialogue lines. Each line:
- "speaker": "pbp" or "analyst"
- "text": The spoken line (15-40 words, conversational)
- "emphasis": "normal" | "excited" | "thoughtful"

Keep it to 2-6 lines total. Sound like a natural back-and-forth conversation. DO NOT narrate card-by-card action unless it's a showdown. Focus on the STORY: player tendencies, session dynamics, what this hand means in context.

Return ONLY the JSON array, no markdown fencing.`;

async function generateCommentary(
  state: TableCommentaryState,
  summary: HandSummary,
  engine: GameEngine,
  trigger: CommentaryTrigger,
  omniscient: boolean,
): Promise<CommentarySegment | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const prompt = buildPrompt(state, summary, engine, trigger, omniscient);

  const lines = await callLLM(apiKey, prompt);
  if (!lines || lines.length === 0) return null;

  return {
    id: `seg-${state.tableId}-${++state.segmentCounter}`,
    trigger,
    lines,
    handNumber: summary.handNumber,
    timestamp: Date.now(),
  };
}

async function generateBlindCommentary(
  state: TableCommentaryState,
  level: { level: number; sb: number; bb: number; ante: number },
  engine: GameEngine,
): Promise<CommentarySegment | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const playerContext = buildPlayerStatsContext(state, engine);
  const prompt = `TABLE CONTEXT:
- Blinds just increased to ${level.sb}/${level.bb}${level.ante ? ` (ante ${level.ante})` : ""} — Level ${level.level}
- Players: ${playerContext}

TRIGGER: blind_increase

The blinds just went up. Discuss the impact on short stacks and the table dynamic. Who's in trouble?`;

  const lines = await callLLM(apiKey, prompt);
  if (!lines) return null;

  return {
    id: `seg-${state.tableId}-${++state.segmentCounter}`,
    trigger: "blind_increase",
    lines,
    handNumber: engine.state.handNumber,
    timestamp: Date.now(),
  };
}

async function generateEliminationCommentary(
  state: TableCommentaryState,
  displayName: string,
  finishPlace: number,
  prizeAmount: number,
  engine: GameEngine,
): Promise<CommentarySegment | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const playerStats = state.sessionStats.get(displayName);
  const statsLine = playerStats
    ? `They played ${playerStats.handsPlayed} hands with a VPIP of ${pct(playerStats.vpipCount, playerStats.handsPlayed)}% and won ${playerStats.handsWon} pots.`
    : "";

  const prompt = `TABLE CONTEXT:
- ${displayName} has been eliminated in ${ordinal(finishPlace)} place${prizeAmount > 0 ? ` winning ${prizeAmount} chips` : ""}.
- ${engine.state.playersRemaining} players remain.
${statsLine}

TRIGGER: player_eliminated

Commentate on this elimination. Recap how they played and react to their exit.`;

  const lines = await callLLM(apiKey, prompt);
  if (!lines) return null;

  return {
    id: `seg-${state.tableId}-${++state.segmentCounter}`,
    trigger: "player_eliminated",
    lines,
    handNumber: engine.state.handNumber,
    timestamp: Date.now(),
  };
}

function buildPrompt(
  state: TableCommentaryState,
  summary: HandSummary,
  engine: GameEngine,
  trigger: CommentaryTrigger,
  omniscient: boolean,
): string {
  const bb = engine.state.minBet || 1;
  const format = engine.state.gameFormat;
  const playerContext = buildPlayerStatsContext(state, engine);

  // Compress recent hand summaries (last 3)
  const recentHistory = state.recentHandSummaries
    .slice(-3)
    .map(s => {
      const winnerNames = s.winners.map(w => {
        const p = s.players.find(pl => pl.id === w.playerId);
        return p?.displayName || "Unknown";
      }).join(", ");
      const hadShowdown = s.showdownResults && s.showdownResults.length > 0;
      return `Hand #${s.handNumber}: Pot ${s.pot}. Winner: ${winnerNames}${hadShowdown ? " (showdown)" : " (no showdown)"}.`;
    })
    .join("\n");

  // Current hand summary
  let handSummaryText = `Hand #${summary.handNumber}: Pot ${summary.pot}.`;
  if (summary.showdownResults && summary.showdownResults.length > 0) {
    for (const result of summary.showdownResults) {
      const player = summary.players.find(p => p.id === result.playerId);
      const name = player?.displayName || "Unknown";
      handSummaryText += `\n${name}: ${formatCards(result.hand?.bestCards)} — ${result.hand?.description || "unknown hand"}${result.isWinner ? " (WINNER)" : ""}`;
    }
  } else {
    const winnerNames = summary.winners.map(w => {
      const p = summary.players.find(pl => pl.id === w.playerId);
      return p?.displayName || "Unknown";
    }).join(", ");
    handSummaryText += ` Won by ${winnerNames} (no showdown).`;
  }

  // Omniscient mode — include hole cards of all players
  let holeCardsText = "";
  if (omniscient) {
    const cardLines: string[] = [];
    for (const p of engine.state.players) {
      if (p.cards) {
        cardLines.push(`${p.displayName}: ${formatCards(p.cards)}`);
      }
    }
    if (cardLines.length > 0) {
      holeCardsText = `\nHOLE CARDS (you can see these, reference them naturally):\n${cardLines.join("\n")}`;
    }
  }

  return `TABLE CONTEXT:
- Blinds: ${bb / 2}/${bb} (${format} game)
- Hand #${summary.handNumber}

PLAYER SESSION STATS:
${playerContext}

RECENT HISTORY:
${recentHistory || "No previous hands."}

THIS HAND:
${handSummaryText}
${holeCardsText}
${!omniscient ? "\nYou do NOT know any player's hole cards. Comment only on visible actions, bet sizing, and showdown results." : ""}

TRIGGER: ${trigger}

Generate the commentary dialogue.`;
}

function buildPlayerStatsContext(state: TableCommentaryState, engine: GameEngine): string {
  const lines: string[] = [];
  for (const p of engine.state.players) {
    const stats = state.sessionStats.get(p.id);
    if (!stats || stats.handsPlayed === 0) {
      lines.push(`${p.displayName}: Stack ${p.chips}, just joined`);
      continue;
    }
    const vpip = pct(stats.vpipCount, stats.handsPlayed);
    const pfr = pct(stats.pfrCount, stats.handsPlayed);
    const pl = stats.netResult >= 0 ? `+${stats.netResult}` : `${stats.netResult}`;
    const tags: string[] = [];
    if (stats.isChipLeader) tags.push("CHIP LEADER");
    if (stats.isShortStack) tags.push("SHORT STACK");
    lines.push(
      `${p.displayName}: Stack ${p.chips} (${pl}), ${stats.handsPlayed} hands, VPIP ${vpip}%, PFR ${pfr}%, Won ${stats.handsWon}${tags.length ? ` [${tags.join(", ")}]` : ""}`
    );
  }
  return lines.join("\n");
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

async function callLLM(apiKey: string, userPrompt: string): Promise<CommentaryLine[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: COMMENTARY_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[commentary] LLM API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) return null;

    // Parse JSON array — strip markdown fencing if present
    const clean = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return null;

    // Validate structure
    return parsed
      .filter(
        (line: any) =>
          (line.speaker === "pbp" || line.speaker === "analyst") &&
          typeof line.text === "string" &&
          line.text.length > 0
      )
      .map((line: any) => ({
        speaker: line.speaker as "pbp" | "analyst",
        text: line.text,
        emphasis: (["normal", "excited", "thoughtful"].includes(line.emphasis) ? line.emphasis : "normal") as CommentaryLine["emphasis"],
      }))
      .slice(0, 6); // Max 6 lines
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCards(cards: CardType[] | null | undefined): string {
  if (!cards || cards.length === 0) return "??";
  return cards.map(c => `${c.rank}${c.suit[0]}`).join(" ");
}

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function serializeSegment(segment: CommentarySegment): any {
  return {
    id: segment.id,
    trigger: segment.trigger,
    handNumber: segment.handNumber,
    lines: segment.lines.map((line, i) => ({
      speaker: line.speaker,
      text: line.text,
      emphasis: line.emphasis,
      audioUrl: segment.audio?.[i]?.url || null,
      durationMs: segment.audio?.[i]?.durationMs || 0,
    })),
  };
}
