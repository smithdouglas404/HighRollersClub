#!/usr/bin/env node
// Generate a single realistic casino-style avatar preview using Pollinations.ai (free)
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('attached_assets/generated_images/avatars/realistic_preview');

const avatar = {
  name: "avatar_the_shark_preview.png",
  prompt: "Portrait headshot of a distinguished male poker player in his 40s at a high stakes casino poker table, wearing a tailored dark navy suit with a crisp white dress shirt and no tie, top button undone, strong jaw, short dark hair with subtle gray at temples, intense focused eyes looking directly at camera, warm overhead casino pendant lighting casting dramatic shadows, rich dark mahogany and green felt background slightly blurred, professional photography style portrait, warm golden ambient casino lighting, photorealistic, luxury Las Vegas high roller room atmosphere, sharp focus on face, 8k quality",
  width: 512,
  height: 512
};

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const encodedPrompt = encodeURIComponent(avatar.prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${avatar.width}&height=${avatar.height}&model=flux&nologo=true&seed=42`;

  console.log(`Generating realistic casino avatar preview...`);
  console.log(`Output: ${OUT_DIR}/${avatar.name}\n`);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const outPath = path.join(OUT_DIR, avatar.name);
      await writeFile(outPath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(0);
      console.log(`✓ Saved: ${avatar.name} (${sizeKB} KB)`);
      console.log(`\nView it at: ${outPath}`);
      return;
    } catch (err) {
      console.log(`✗ Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  console.log(`✗ FAILED to generate avatar`);
}

main().catch(console.error);
