#!/usr/bin/env node
/**
 * Generate premium vault background images using Gemini AI
 * Usage: node scripts/generate-vault-backgrounds.mjs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "client", "public", "images", "generated");

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY not set in environment");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const BACKGROUNDS = [
  {
    name: "vault-bg-main",
    prompt: "Ultra premium luxury bank vault interior, golden safe deposit boxes lining walls, dramatic warm lighting, deep shadows, bokeh effect, dark moody atmosphere with gold accents, photorealistic, 4K, no text, no people, cinematic lighting, shallow depth of field, dark amber and gold color palette",
  },
  {
    name: "vault-bg-lobby",
    prompt: "Luxury VIP poker room entrance, dark marble floors, gold chandelier light reflections, velvet rope, deep shadows, bokeh golden lights in background, premium casino atmosphere, no text, no people, cinematic, dark with warm gold highlights, shallow depth of field",
  },
  {
    name: "vault-bg-profile",
    prompt: "Close up of luxury golden safe deposit boxes with dramatic side lighting, dark moody atmosphere, shallow depth of field, bokeh gold reflections, warm amber tones, premium bank vault aesthetic, no text, no people, photorealistic, 4K",
  },
  {
    name: "vault-bg-club",
    prompt: "Premium private members club interior, dark leather chairs, gold trimmed bar, warm spotlight lighting, deep shadows, luxury cigar lounge atmosphere, bokeh lights, no text, no people, cinematic photography, dark with gold accents, shallow depth of field",
  },
  {
    name: "vault-bg-tournament",
    prompt: "Grand poker tournament arena from above, dark atmosphere with dramatic gold spotlights on green felt tables, stadium seating in shadows, premium casino event, bokeh lights, no text, no people, cinematic wide shot, dark with warm gold lighting",
  },
  {
    name: "vault-bg-wallet",
    prompt: "Stack of gold bars in a dark vault with dramatic lighting, shallow depth of field, bokeh gold reflections on polished surfaces, premium wealth aesthetic, dark moody atmosphere, no text, no people, photorealistic, warm amber and gold tones",
  },
  {
    name: "vault-bg-shop",
    prompt: "Luxury jewelry display case with dramatic gold lighting, dark velvet background, premium items under spotlights, bokeh reflections, high-end retail atmosphere, no text, no people, cinematic, dark with warm gold accents, shallow depth of field",
  },
  {
    name: "vault-bg-analytics",
    prompt: "Dark premium trading floor with gold-tinted holographic screens, dramatic lighting, deep shadows, modern luxury financial center, bokeh lights, no text, no people, cinematic, futuristic dark with warm gold accents",
  },
];

async function generateImage(bg) {
  const outputPath = path.join(OUTPUT_DIR, `${bg.name}.webp`);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`  ⏭  ${bg.name} already exists, skipping`);
    return;
  }

  console.log(`  🎨 Generating ${bg.name}...`);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `Generate a high-quality background image: ${bg.prompt}. The image should be 1920x1080, landscape orientation, suitable as a dark website background with content overlaid on top.` }] }],
      generationConfig: {
        responseModalities: ["image", "text"],
      },
    });

    const response = result.response;

    // Find image part in response
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(outputPath, buffer);
          console.log(`  ✅ Saved ${bg.name} (${(buffer.length / 1024).toFixed(0)}KB)`);
          return;
        }
      }
    }

    console.log(`  ⚠️  ${bg.name}: No image in response`);
  } catch (err) {
    console.error(`  ❌ ${bg.name} failed:`, err.message);
  }
}

async function main() {
  console.log(`\n🏦 Generating ${BACKGROUNDS.length} vault background images...\n`);

  for (const bg of BACKGROUNDS) {
    await generateImage(bg);
    // Rate limit delay
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n✅ Done! Images saved to client/public/images/generated/\n");
}

main();
