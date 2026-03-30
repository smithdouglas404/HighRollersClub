#!/usr/bin/env node
// Generate visual polish assets using Google Nano Banana (Gemini image generation)
// Usage: GOOGLE_API_KEY=your-key node scripts/generate-polish-assets.mjs
//
// Generates: lobby heroes, dashboard backgrounds, winner effects, tournament visuals,
// loading overlays, and premium page backgrounds

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.");
  console.error("Get a free key at https://aistudio.google.com/apikey");
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.resolve('client/public');

const assets = [
  // ═══════════════════════════════════════════════════════════════
  // LOBBY & DASHBOARD PREMIUM BACKGROUNDS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "backgrounds/bg_lobby_hero.webp",
    prompt: "ultra wide cinematic panoramic view of a luxurious cyberpunk poker lounge, neon cyan and gold lighting, glass tables with holographic displays, dark obsidian walls with LED accent strips, fog and volumetric light, leather seats, premium VIP atmosphere, no people visible, dark moody lighting with bokeh, photorealistic 8k quality",
  },
  {
    name: "backgrounds/bg_dashboard.webp",
    prompt: "ultra wide panoramic view of a dark futuristic command center dashboard, multiple holographic screens floating in space showing poker statistics and charts, cyan and gold data visualizations, dark obsidian surface, ambient glow, no people, tech control room aesthetic, photorealistic 8k quality",
  },
  {
    name: "backgrounds/bg_profile.webp",
    prompt: "dark luxurious player lounge with single spotlight, leather armchair, scattered poker chips on dark table, personal trophy shelf with golden trophies, moody atmospheric lighting, premium VIP room, dark obsidian and gold color scheme, no people, photorealistic 8k quality",
  },
  {
    name: "backgrounds/bg_tournament.webp",
    prompt: "grand poker tournament arena from above, massive oval table in center spotlight, stadium seating fading into darkness, giant screens on walls, dramatic volumetric light beams, gold and cyan accent lighting, fog atmosphere, dark dramatic scene, no people, photorealistic 8k quality",
  },
  {
    name: "backgrounds/bg_shop.webp",
    prompt: "dark cyberpunk luxury boutique display room, glass cases with glowing items inside, neon product spotlights, holographic price tags floating, premium dark interior with gold accents, retail luxury tech aesthetic, no people, moody atmospheric lighting, photorealistic 8k quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // WINNER CELEBRATION EFFECTS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "effects/winner_burst_gold.webp",
    prompt: "explosive golden light burst with flying poker chips and gold confetti particles radiating outward from center, dramatic golden glow, transparent/dark edges, celebration victory effect, sparkling gold particles, isolated on pure black background, game VFX overlay style, 4K quality",
  },
  {
    name: "effects/winner_particles.webp",
    prompt: "scattered golden sparkle particles and confetti floating in air, various sizes of gold glitter dots and small chip-shaped objects, celebration mood, isolated particles on pure black background, seamless overlay effect, game VFX style, 4K quality",
  },
  {
    name: "effects/allin_dramatic.webp",
    prompt: "dramatic poker all-in moment visual effect, intense red and gold energy waves radiating from center, chips flying through air with motion blur, dark background with explosive light, dramatic tension atmosphere, game VFX overlay style, isolated on black, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // LOADING TRANSITIONS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "loading/loading_cards_shuffle.webp",
    prompt: "artistic top-down view of playing cards being shuffled in a mesmerizing spiral pattern, cards fanning out in circular motion, dark background, smooth motion blur, elegant flowing card cascade, premium casino feel, photorealistic, 4K quality",
  },
  {
    name: "loading/loading_chips_stack.webp",
    prompt: "artistic view of poker chips being neatly stacked in a satisfying tower pattern, multiple colorful chip stacks building up, dark background with dramatic spotlight, premium casino atmosphere, photorealistic, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // TOURNAMENT BRACKET VISUALS
  // ═══════════════════════════════════════════════════════════════
  {
    name: "tournament/bracket_header.webp",
    prompt: "wide panoramic banner of a grand poker tournament bracket board, golden bracket lines connecting match boxes, dark background with dramatic gold lighting, championship trophy silhouette in center, premium esports tournament aesthetic, dark and gold color scheme, photorealistic, 8k quality",
  },
  {
    name: "tournament/final_table.webp",
    prompt: "cinematic view of a poker final table from above, dramatic single spotlight on oval table, 9 empty seats with name placards, scattered chips, tense atmosphere, dark surroundings with fog, premium casino final table setup, photorealistic, 8k quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // PREMIUM LOBBY TABLE PREVIEW IMAGES
  // ═══════════════════════════════════════════════════════════════
  {
    name: "tables/table_preview_cash.webp",
    prompt: "top-down view of a premium poker cash game table with scattered chips and cards mid-game, green emerald felt, warm golden lighting, intimate 6-player table setting, premium casino atmosphere, photorealistic, 4K quality",
  },
  {
    name: "tables/table_preview_tournament.webp",
    prompt: "top-down view of a premium poker tournament table, organized chip stacks at each seat, dealer button and community cards visible, deep blue felt, cool dramatic lighting, competitive atmosphere, photorealistic, 4K quality",
  },
  {
    name: "tables/table_preview_headsup.webp",
    prompt: "top-down view of an intimate heads-up poker table, just two seats facing each other, large chip stacks, dark red velvet felt, intense focused atmosphere, dramatic spotlight from above, photorealistic, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL AVATARS (to expand selection)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "avatars/avatar_neon_samurai.webp",
    prompt: "portrait bust of a futuristic neon samurai poker player, glowing blue energy katana on back, white hair tied up, traditional meets cyberpunk aesthetic, glowing blue eye markings, dark background with blue neon glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_crypto_queen.webp",
    prompt: "portrait bust of a crypto queen poker player, holographic bitcoin crown, sleek platinum hair, futuristic gold and white outfit with blockchain circuit patterns, confident regal expression, dark background with gold glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_phantom_dealer.webp",
    prompt: "portrait bust of a mysterious phantom dealer poker player, half-face metallic mask with glowing cyan eye, dark hood with smoke particles, one visible green eye, elegant dark suit, sinister yet stylish, dark background with teal glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
];

async function generateImage(asset, index) {
  console.log(`[${index + 1}/${assets.length}] Generating: ${asset.name}...`);

  const outPath = path.join(OUT_DIR, asset.name);

  // Skip existing files
  if (existsSync(outPath)) {
    console.log(`  SKIP (exists)`);
    return true;
  }

  // Ensure directory exists
  const dir = path.dirname(outPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: `Generate this image: ${asset.prompt}` }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();

      let imageData = null;
      for (const candidate of json.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            imageData = part.inlineData.data;
            break;
          }
        }
        if (imageData) break;
      }

      if (!imageData) {
        throw new Error('No image data in response');
      }

      const buffer = Buffer.from(imageData, 'base64');
      await writeFile(outPath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(0);
      console.log(`  OK ${asset.name} (${sizeKB} KB)`);
      return true;
    } catch (err) {
      const is429 = err.message.includes('429');
      console.log(`  RETRY ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) {
        const wait = is429 ? 20000 * attempt : 5000 * attempt;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  console.log(`  FAILED: ${asset.name}`);
  return false;
}

async function main() {
  console.log(`\n=== Nano Banana Visual Polish Generator ===`);
  console.log(`Generating ${assets.length} premium assets`);
  console.log(`Output: ${OUT_DIR}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < assets.length; i++) {
    const ok = await generateImage(assets[i], i);
    ok ? success++ : failed++;
    if (i < assets.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n=== Done! ${success} generated, ${failed} failed ===`);
}

main().catch(console.error);
