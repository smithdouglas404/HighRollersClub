#!/usr/bin/env node
// Generate premium poker card faces, card back, and chip assets using Google Nano Banana
// (Gemini gemini-2.5-flash-image with image generation)
// Usage: GOOGLE_API_KEY=your-key node scripts/generate-cards-nano-banana.mjs
//
// Outputs WebP images sized for poker table display

import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set GOOGLE_API_KEY environment variable first.");
  console.error("Get a free key at https://aistudio.google.com/apikey");
  process.exit(1);
}

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;
const OUT_DIR = path.resolve('client/public/cards');
const CHIP_DIR = path.resolve('client/public/chips');

// Card dimensions: 2.5:3.5 poker aspect ratio, sized for table display
const CARD_W = 200;
const CARD_H = 280;

// ── Suit config ──
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SUIT_UNICODE = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// Standard playing card colors: Hearts & Diamonds = RED, Clubs & Spades = BLACK
const SUIT_COLORS = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
};

// ── Standard pip layout descriptions for exact positioning ──
const PIP_LAYOUTS = {
  '2': 'one pip centered near the top, one pip centered near the bottom (rotated 180°)',
  '3': 'one pip centered near the top, one pip exactly centered, one pip centered near the bottom (rotated 180°)',
  '4': 'two pips across the top (left and right), two pips across the bottom (left and right, rotated 180°)',
  '5': 'two pips across the top (left and right), one pip exactly centered, two pips across the bottom (left and right, rotated 180°)',
  '6': 'two pips across the top (left and right), two pips across the middle (left and right), two pips across the bottom (left and right, rotated 180°). Three rows of two.',
  '7': 'two pips across the top (left and right), one pip centered between top and middle rows, two pips across the middle (left and right), two pips across the bottom (left and right, rotated 180°)',
  '8': 'two pips across the top (left and right), one pip centered between top and middle, two pips across the middle (left and right), one pip centered between middle and bottom (rotated 180°), two pips across the bottom (left and right, rotated 180°)',
  '9': 'two pips top row, two pips upper-middle row, one pip exactly centered, two pips lower-middle row (rotated 180°), two pips bottom row (rotated 180°). The center pip sits between the two middle rows.',
  '10': 'two pips top row, one pip between top and upper-middle (centered), two pips upper-middle row, two pips lower-middle row (rotated 180°), one pip between lower-middle and bottom (centered, rotated 180°), two pips bottom row (rotated 180°). Four rows of two with two centered singles.',
};

// ── Common card structure description ──
const CARD_BASE = `A single standard poker playing card, portrait orientation (width:height ratio exactly 5:7).
White/cream card stock background. Clean sharp rectangular shape with slightly rounded corners.
The card MUST have the standard playing card layout:
- Top-left corner: rank text above a small suit symbol
- Bottom-right corner: same rank and suit symbol, rotated 180 degrees (upside down)
The design must look EXACTLY like a real physical playing card from a premium casino deck.
Flat top-down view, no perspective, no tilt, no shadow behind the card.
Pure black background behind the card. High resolution, crisp clean edges.`;

// ── Prompt builders ──
function buildNumberCardPrompt(rank, suit) {
  const suitName = suit;
  const suitSymbol = SUIT_UNICODE[suit];
  const suitColor = SUIT_COLORS[suit];
  const pipLayout = PIP_LAYOUTS[rank];
  const count = parseInt(rank);

  return `Generate an image of a playing card: the ${rank} of ${suitName}.

${CARD_BASE}

CRITICAL REQUIREMENTS FOR THIS CARD:
- The rank is "${rank}" and the suit is ${suitName} (${suitSymbol}).
- The suit color is ${suitColor}.
- Top-left corner shows "${rank}" in bold ${suitColor} text with a small ${suitColor} ${suitSymbol} symbol below it.
- Bottom-right corner shows the same "${rank}" and ${suitSymbol}, rotated 180 degrees.
- The center area of the card must contain EXACTLY ${count} ${suitColor} ${suitSymbol} suit symbols (pips). NOT ${count - 1}, NOT ${count + 1}. EXACTLY ${count} pips.
- Pip arrangement: ${pipLayout}.
- Each pip is a clear, crisp ${suitColor} ${suitSymbol} symbol. The pips in the bottom half are rotated 180 degrees as per standard playing card convention.
- Thin gold border line near the card edges.
- No other text, numbers, or decorations besides the rank indices and the ${count} pips.`;
}

function buildFaceCardPrompt(rank, suit) {
  const suitName = suit;
  const suitSymbol = SUIT_UNICODE[suit];
  const suitColor = SUIT_COLORS[suit];
  const rankName = rank === 'J' ? 'Jack' : rank === 'Q' ? 'Queen' : 'King';

  // Standard colors: Hearts & Diamonds = RED court cards, Clubs & Spades = BLACK court cards
  const characters = {
    J: {
      hearts: 'a young knight with brown curly hair, wearing ornate RED and gold armor, RED clothing accents, holding a sword vertically',
      diamonds: 'a young prince in RED and gold royal robes, blonde hair, RED cape, holding a scepter',
      clubs: 'a young warrior in BLACK and silver attire, dark brown hair, BLACK clothing, holding a longbow',
      spades: 'a dark-haired young soldier in BLACK and silver armor, BLACK cape, holding a pike',
    },
    Q: {
      hearts: 'a beautiful queen with auburn hair, wearing a flowing RED and gold gown, RED dress, holding a red rose',
      diamonds: 'an elegant queen with platinum blonde hair, wearing RED and gold jewelry-laden dress, RED robes, holding a mirror',
      clubs: 'a regal queen with dark wavy hair, wearing a BLACK and silver dress, BLACK robes with subtle patterns, holding a scepter',
      spades: 'a dark-haired queen in BLACK and silver robes, BLACK gown, holding a scepter with a dark gem',
    },
    K: {
      hearts: 'a powerful king with a brown beard, wearing RED and gold royal robes, RED cape, holding a sword behind his head (traditional pose)',
      diamonds: 'a wise king with a white beard, wearing RED and gold royal robes, RED cloak, holding a battle axe',
      clubs: 'a strong king with a dark beard, wearing BLACK and silver armor, BLACK cape, holding an orb',
      spades: 'a stern king with a dark beard, wearing BLACK and silver plate armor, BLACK robes, holding a sword upright',
    },
  };

  const character = characters[rank][suit];

  return `Generate an image of a playing card: the ${rankName} of ${suitName}.

${CARD_BASE}

CRITICAL REQUIREMENTS FOR THIS CARD:
- The rank is "${rank}" (${rankName}) and the suit is ${suitName} (${suitSymbol}).
- Top-left corner shows "${rank}" in bold ${suitColor} text with a small ${suitColor} ${suitSymbol} symbol below it.
- Bottom-right corner shows the same "${rank}" and ${suitSymbol}, rotated 180 degrees.
- The center illustration shows ${character}.
- The illustration MUST be mirrored/reflected top-to-bottom (vertically symmetric) exactly like traditional playing cards — the top half shows the character right-side up, the bottom half shows the same character upside down, meeting in the middle.
- IMPORTANT COLOR RULE: This is a ${suitName} card. ${suit === 'hearts' || suit === 'diamonds' ? 'Hearts and Diamonds are RED suits — the court card illustration must use RED as the dominant color for clothing, robes, and accents. No blue, no green.' : 'Clubs and Spades are BLACK suits — the court card illustration must use BLACK as the dominant color for clothing, robes, and accents. No blue, no green.'}
- Art style: richly detailed classical playing card illustration with ${suitColor} and gold color accents only.
- Ornate gold decorative frame border around the illustration area.
- The character should be detailed and expressive, like premium casino playing cards.
- Thin gold border line near the card edges.`;
}

function buildAcePrompt(suit) {
  const suitName = suit;
  const suitSymbol = SUIT_UNICODE[suit];
  const suitColor = SUIT_COLORS[suit];

  return `Generate an image of a playing card: the Ace of ${suitName}.

${CARD_BASE}

CRITICAL REQUIREMENTS FOR THIS CARD:
- The rank is "A" (Ace) and the suit is ${suitName} (${suitSymbol}).
- Top-left corner shows "A" in bold ${suitColor} text with a small ${suitColor} ${suitSymbol} symbol below it.
- Bottom-right corner shows the same "A" and ${suitSymbol}, rotated 180 degrees.
- The center features ONE large, ornate, highly detailed ${suitColor} ${suitSymbol} symbol.
- The large center ${suitSymbol} should be decorated with intricate filigree, scrollwork, and fine detail — making it look premium and luxurious.
- Surrounding the center symbol: a circular ornamental border with gold accents and delicate radiating lines.
- The ace design should be dramatic and grand — this is the most important card in the deck.
- Thin gold border line near the card edges.
- Ultra premium casino quality, like GGPoker or PokerStars VR card design.`;
}

function buildCardBackPrompt() {
  return `Generate an image of the BACK of a playing card (what you see when the card is face-down).

Portrait orientation (width:height ratio exactly 5:7). Pure black background behind the card. Flat top-down view.

The card back design:
- Deep navy blue to rich purple gradient as the base color.
- An intricate, perfectly SYMMETRICAL geometric pattern covering the entire card surface.
- The pattern should be Art Deco inspired with gold/amber colored lines forming diamonds, chevrons, and interlocking shapes.
- In the exact center: a gold lion head emblem inside an ornate circular frame.
- Fine gold border running around all four edges of the card.
- Corner flourishes in each of the four corners.
- The entire design MUST be perfectly symmetrical both vertically AND horizontally (180-degree rotational symmetry).
- Premium luxury casino quality. Rich, dark, elegant.
- The card back should be completely opaque — you cannot see through it.
- Clean crisp edges, high contrast gold pattern on dark background.`;
}

function buildChipPrompt(denomination, color, accentColor) {
  return `Generate an image of a single casino poker chip viewed perfectly from directly above (top-down, bird's eye view).

$${denomination} denomination poker chip.
- Main body color: ${color}.
- Edge has 8 evenly spaced rectangular ${accentColor} stripe inlays around the rim (standard casino chip edge pattern).
- Inner area: a decorative ring pattern with "${denomination}" text centered in the middle.
- Subtle clay/ceramic texture like real casino chips.
- Perfectly circular shape with detailed molded edge.
- Dramatic studio lighting from above, photorealistic quality.
- Isolated on pure black background.
- No perspective distortion — perfectly flat top-down view.
- The chip should look exactly like a real Las Vegas casino chip.`;
}

// ── API call with PNG→WebP conversion ──
async function generateImage(prompt, outputPath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();

      // Extract image from response
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

      if (!imagePart) {
        throw new Error('No image in response');
      }

      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

      // Convert to WebP with sharp, resize to card dimensions
      const isChip = outputPath.includes('chips');
      const webpBuffer = await sharp(imageBuffer)
        .resize(isChip ? 128 : CARD_W, isChip ? 128 : CARD_H, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      await writeFile(outputPath, webpBuffer);

      const sizeKB = (webpBuffer.length / 1024).toFixed(1);
      console.log(`  OK ${path.basename(outputPath)} (${sizeKB} KB)`);
      return true;
    } catch (err) {
      const is429 = err.message.includes('429');
      console.log(`  RETRY ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) {
        const wait = is429 ? 20000 * attempt : 5000 * attempt;
        console.log(`  ... waiting ${wait / 1000}s ...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  console.log(`  FAILED: ${path.basename(outputPath)}`);
  return false;
}

// ── Main ──
async function main() {
  // Create output directories
  for (const dir of [OUT_DIR, CHIP_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  }

  const tasks = [];

  // ── 52 card faces ──
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const filename = `${rank}_${suit}.webp`;
      const outputPath = path.join(OUT_DIR, filename);

      let prompt;
      if (rank === 'A') {
        prompt = buildAcePrompt(suit);
      } else if (['J', 'Q', 'K'].includes(rank)) {
        prompt = buildFaceCardPrompt(rank, suit);
      } else {
        prompt = buildNumberCardPrompt(rank, suit);
      }

      tasks.push({ prompt, outputPath, name: `${rank} of ${suit}` });
    }
  }

  // ── Card back ──
  tasks.push({
    prompt: buildCardBackPrompt(),
    outputPath: path.join(OUT_DIR, 'card_back.webp'),
    name: 'Card Back',
  });

  // ── Chip denominations ──
  const chipDenoms = [
    { value: '1', color: 'white with light gray speckle', accent: 'navy blue' },
    { value: '5', color: 'bright cherry red', accent: 'white' },
    { value: '25', color: 'forest green', accent: 'white' },
    { value: '100', color: 'jet black', accent: 'white' },
    { value: '500', color: 'royal purple', accent: 'gold' },
    { value: '1000', color: 'gold/yellow metallic', accent: 'black' },
  ];

  for (const chip of chipDenoms) {
    tasks.push({
      prompt: buildChipPrompt(chip.value, chip.color, chip.accent),
      outputPath: path.join(CHIP_DIR, `chip_${chip.value}.webp`),
      name: `$${chip.value} Chip`,
    });
  }

  console.log(`\n=== Nano Banana Card & Chip Generator ===`);
  console.log(`Generating ${tasks.length} WebP assets (52 cards + 1 back + 6 chips)`);
  console.log(`Card size: ${CARD_W}x${CARD_H}px | Chip size: 128x128px`);
  console.log(`Cards: ${OUT_DIR}`);
  console.log(`Chips: ${CHIP_DIR}\n`);

  let success = 0;
  let failed = 0;

  // Process sequentially, skip existing files
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    // Skip already generated
    if (existsSync(task.outputPath)) {
      console.log(`[${i + 1}/${tasks.length}] ${task.name} — SKIP (exists)`);
      success++;
      continue;
    }
    console.log(`[${i + 1}/${tasks.length}] ${task.name}`);
    const ok = await generateImage(task.prompt, task.outputPath);
    ok ? success++ : failed++;

    // Rate limit: 6 seconds between requests for free tier
    if (i < tasks.length - 1) {
      await new Promise(r => setTimeout(r, 6000));
    }
  }

  console.log(`\n=== Done! ${success} generated, ${failed} failed ===`);
  console.log(`Card assets: ${OUT_DIR}`);
  console.log(`Chip assets: ${CHIP_DIR}`);
}

main().catch(console.error);
