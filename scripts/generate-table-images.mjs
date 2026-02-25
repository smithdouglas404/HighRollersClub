#!/usr/bin/env node
/**
 * Generate poker table images using OpenAI DALL-E 3
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-table-images.mjs
 *
 * Or set the key in Replit Secrets and run via the Replit shell.
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import https from "https";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY not set. Set it as a Replit Secret or pass it as an env var.");
  console.error("Example: OPENAI_API_KEY=sk-... node scripts/generate-table-images.mjs");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const OUTPUT_DIR = path.join(process.cwd(), "attached_assets", "generated_images");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(filepath);
      });
    }).on("error", (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function generateImage(prompt, filename, size = "1024x1024") {
  console.log(`\n  Generating: ${filename}...`);
  console.log(`  Prompt: "${prompt.substring(0, 80)}..."`);

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "hd",
      style: "vivid",
    });

    const imageUrl = response.data[0].url;
    const filepath = path.join(OUTPUT_DIR, filename);
    await downloadImage(imageUrl, filepath);
    console.log(`  Saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error(`  ERROR generating ${filename}:`, error.message);
    return null;
  }
}

// ─── Image prompts ──────────────────────────────────────────────────────────

const IMAGES_TO_GENERATE = [
  // 1. Clean poker table (no players, no UI) — to be used as the base table background
  {
    filename: "poker_table_scene_clean.png",
    size: "1792x1024",
    prompt: `Top-down angled cinematic view of an empty luxury poker table in a cyberpunk casino. Rich dark green felt surface with gold embossed trim and gold rail. The table is an oval shape, elegantly lit from above with warm spotlights. Behind the table, a futuristic neon-lit casino environment with purple and cyan neon lights, holographic displays, and dark atmospheric lighting. No players, no cards, no chips, no text, no UI elements — just the empty table and environment. Ultra-realistic, dramatic lighting, 8K quality, cinematic depth of field.`,
  },

  // 2. Casino room environment background (wide, for behind the table)
  {
    filename: "cyberpunk_casino_bg_wide.png",
    size: "1792x1024",
    prompt: `Wide cinematic view of a futuristic cyberpunk casino interior. Dark atmospheric room with neon lights in cyan, purple, and gold. Slot machines with holographic displays line the walls. LED strip lighting on the ceiling. Smoke/haze in the air catching the light beams. No people, no text. The center area is darker (for a poker table to be composited later). Ultra-realistic, moody atmospheric lighting, 8K render quality, blade runner aesthetic.`,
  },

  // 3. Poker table top felt surface (for the ImageTable oval)
  {
    filename: "poker_felt_top_down.png",
    size: "1024x1024",
    prompt: `Perfect top-down view of a luxury poker table felt surface. Rich dark emerald green velvet felt texture with subtle fiber detail. A thin gold embossed line forms an oval inner border. Small gold lion crest watermark in the exact center, very subtle. Warm overhead spotlight creates a gentle bright spot in the center fading to darker edges. No cards, no chips, no players, no text. Clean surface only. Ultra-high detail texture, photorealistic.`,
  },

  // 4. Gold chip stack for pot display
  {
    filename: "chip_stack_gold_pile.png",
    size: "1024x1024",
    prompt: `Photorealistic pile of luxury casino poker chips on a dark green felt surface. Mix of gold, teal, and black chips with metallic edges stacked in several columns. Dramatic overhead lighting with gold reflections. Transparent/black background. The chips have intricate edge patterns and weight to them. No text, no hands. Ultra-realistic, cinematic lighting, product photography style.`,
  },

  // 5. Neon frame border for avatar (tileable ring)
  {
    filename: "avatar_neon_frame_cyan.png",
    size: "1024x1024",
    prompt: `A glowing neon circular frame/ring on a pure black background. The ring is made of bright cyan/teal neon light, with electric glow effects and light bloom. The center is completely empty/transparent black. The ring has a futuristic tech style with subtle circuit-like patterns in the glow. No text. Clean isolated neon ring, perfect circle, centered. High contrast, vivid neon glow.`,
  },

  // 6. Card back design (premium cyberpunk style)
  {
    filename: "card_back_cyberpunk.png",
    size: "1024x1024",
    prompt: `Design for the back of a premium playing card. Dark navy/black background with an intricate geometric pattern in gold and cyan. A gold lion crest emblem in the center. Thin gold border around the edges. The pattern has a cyberpunk/tech aesthetic with subtle circuit lines mixed with classic diamond patterns. No text except maybe "HR" initials in gold. Portrait orientation, sharp edges, luxury casino quality.`,
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== DALL-E 3 Image Generation for High Rollers Club ===\n");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Generating ${IMAGES_TO_GENERATE.length} images...\n`);

  const results = [];
  for (const img of IMAGES_TO_GENERATE) {
    const result = await generateImage(img.prompt, img.filename, img.size);
    results.push({ filename: img.filename, success: !!result });

    // Small delay between API calls to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n=== Generation Complete ===\n");
  for (const r of results) {
    console.log(`  ${r.success ? "OK" : "FAIL"} — ${r.filename}`);
  }
}

main().catch(console.error);
