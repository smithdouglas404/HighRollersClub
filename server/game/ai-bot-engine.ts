// AI Bot Engine — Uses Anthropic Claude API for intelligent bot decisions
// Falls back to heuristic-based decisions if no API key is configured.

import type { CardType } from "./hand-evaluator";

interface AIDecisionContext {
  personality: string;
  holeCards: CardType[];
  communityCards: CardType[];
  pot: number;
  toCall: number;
  chips: number;
  position: string; // "early", "middle", "late", "blinds"
  phase: string; // "pre-flop", "flop", "turn", "river"
  numPlayers: number;
  minRaise: number;
  recentActions: string[]; // last 3-5 actions e.g. ["Player1 raises 200", "Player2 calls"]
}

interface AIDecisionResult {
  action: "fold" | "check" | "call" | "raise";
  amount?: number;
  chatMessage?: string;
}

// Module-level config
let anthropicApiKey: string | null = null;
const AI_MODEL = process.env.AI_BOT_MODEL || "claude-haiku-4-5-20251001";

export function setAnthropicApiKey(key: string | null) {
  anthropicApiKey = key;
}

export function getAnthropicApiKey(): string | null {
  return anthropicApiKey || process.env.ANTHROPIC_API_KEY || null;
}

export function hasAIEnabled(): boolean {
  return !!getAnthropicApiKey();
}

const PERSONALITY_PROMPTS: Record<string, string> = {
  shark: `You are "The Shark" — an aggressive, intimidating poker player. You love big bluffs, pressuring opponents, and trash-talking. You play loose-aggressive and aren't afraid to shove with marginal hands. Your chat style is cocky and confident.`,
  professor: `You are "The Professor" — a tight, analytical poker player. You only play premium hands and make mathematically correct decisions. You cite pot odds and EV in your chat. Your style is calm, methodical, and educational.`,
  gambler: `You are "The Gambler" — a wild, unpredictable poker player. You love action, play lots of hands, and make big bets for the thrill. Your chat is energetic, uses exclamation marks, and references luck. You sometimes make questionable calls just for fun.`,
  robot: `You are "GTO-9000" — a robotic, game-theory-optimal poker player. You speak in short, technical phrases. You reference solver outputs, EV calculations, and range analysis. You show no emotion and treat poker as pure mathematics.`,
  rookie: `You are "The Rookie" — a beginner poker player still learning the game. You make mistakes, sometimes misread the board, and get excited easily. Your chat shows uncertainty ("Am I doing this right?") and enthusiasm when you win. Sometimes you make suboptimal plays.`,
};

function formatCards(cards: CardType[]): string {
  return cards.map(c => `${c.rank}${c.suit[0]}`).join(" ");
}

export async function getAIDecision(ctx: AIDecisionContext): Promise<AIDecisionResult | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  const personalityPrompt = PERSONALITY_PROMPTS[ctx.personality] || PERSONALITY_PROMPTS.robot;

  const prompt = `${personalityPrompt}

You are playing Texas Hold'em poker. Make a decision based on your personality and the current game state.

GAME STATE:
- Your hole cards: ${formatCards(ctx.holeCards)}
- Community cards: ${ctx.communityCards.length > 0 ? formatCards(ctx.communityCards) : "None (pre-flop)"}
- Phase: ${ctx.phase}
- Pot: $${ctx.pot}
- To call: $${ctx.toCall}
- Your chips: $${ctx.chips}
- Minimum raise: $${ctx.minRaise}
- Position: ${ctx.position}
- Players remaining: ${ctx.numPlayers}
- Recent actions: ${ctx.recentActions.length > 0 ? ctx.recentActions.join(", ") : "None yet"}

Respond with EXACTLY this JSON format (no markdown, no explanation):
{"action": "fold|check|call|raise", "amount": <number if raising, omit otherwise>, "chat": "<optional short chat message in character, or empty string>"}

Rules:
- You can only "check" if toCall is 0
- If you "raise", amount must be >= ${ctx.minRaise} and <= ${ctx.chips}
- Keep chat messages under 50 characters
- Stay in character for your personality`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[ai-bot] API error: ${res.status} (model: ${AI_MODEL}) — falling back to heuristics`);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) return null;

    // Parse JSON response
    const parsed = JSON.parse(text);
    const action = parsed.action;
    if (!["fold", "check", "call", "raise"].includes(action)) return null;

    // Validate
    if (action === "check" && ctx.toCall > 0) return null;
    if (action === "raise") {
      const amt = Number(parsed.amount);
      if (isNaN(amt) || amt < ctx.minRaise) return null;
      return {
        action: "raise",
        amount: Math.min(amt, ctx.chips),
        chatMessage: parsed.chat || undefined,
      };
    }

    return {
      action,
      chatMessage: parsed.chat || undefined,
    };
  } catch (err) {
    // Timeout or parse error — fall back to heuristic
    return null;
  }
}
