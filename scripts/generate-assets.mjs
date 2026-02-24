#!/usr/bin/env node
// Generate cinematic poker game assets using Pollinations.ai (free, no API key)
// Usage: node scripts/generate-assets.mjs

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('attached_assets/generated_images');

const assets = [
  // === 6 Full-body seated poker players ===
  {
    name: "player_seated_1.png",
    prompt: "hyper realistic 3D render of cyberpunk male poker player seated at dark poker table, muscular build, dark tactical vest with glowing cyan LED accents, short dark hair, dramatic overhead rim lighting, dark moody atmosphere, cinematic quality, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },
  {
    name: "player_seated_2.png",
    prompt: "hyper realistic 3D render of cyberpunk female poker player seated at dark poker table, sleek chrome armored jacket with neon teal highlights, silver hair pulled back in ponytail, confident expression, dramatic rim lighting, dark moody cinematic atmosphere, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },
  {
    name: "player_seated_3.png",
    prompt: "hyper realistic 3D render of mysterious cyberpunk poker player seated at dark poker table, dark hood with glowing green visor covering eyes, mechanical prosthetic arm visible resting on table, dramatic green backlighting, dark moody cinematic atmosphere, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },
  {
    name: "player_seated_4.png",
    prompt: "hyper realistic 3D render of intimidating cyberpunk poker player seated at dark poker table, bald head with facial circuit tattoos and cybernetic eye implant glowing amber orange, black leather jacket with metal studs, menacing presence, dramatic rim lighting from above, dark moody cinematic atmosphere, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },
  {
    name: "player_seated_5.png",
    prompt: "hyper realistic 3D render of elegant cyberpunk female poker player seated at dark poker table, flowing dark evening dress with holographic shimmer patterns, long black hair, diamond jewelry with glowing blue gems, sophisticated dangerous beauty, dramatic rim lighting, dark moody cinematic atmosphere, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },
  {
    name: "player_seated_6.png",
    prompt: "hyper realistic 3D render of heavy armored cyberpunk soldier poker player seated at dark poker table, full face tactical helmet with glowing red visor slit, massive combat armor with scratches and battle damage, imposing military figure, dramatic red and teal rim lighting, dark moody cinematic atmosphere, photorealistic, dark teal and black color scheme, upper body facing camera, transparent dark background, unreal engine 5 quality, 8k",
    width: 512, height: 768
  },

  // === Environments & Textures ===
  {
    name: "server_room_bg_cinematic.png",
    prompt: "cinematic server room interior photograph, rows of illuminated server racks with blue and teal LED status lights, strong depth of field blur in background, dark atmospheric volumetric lighting with light rays streaming through, visible cable management and cooling systems, industrial cyberpunk data center aesthetic, photorealistic, ultra wide angle lens, dark teal and deep blue color palette, moody cinematic, 8k",
    width: 1920, height: 1080
  },
  {
    name: "lion_shield_logo_large.png",
    prompt: "majestic golden lion head facing forward on ornate medieval shield with royal crown on top, dramatic golden light rays and magical glow emanating outward, highly detailed engraved metallic gold texture, dark pure black background, heraldic coat of arms style, premium luxury gaming brand emblem, symmetrical centered composition, dramatic lighting, 8k quality",
    width: 768, height: 768
  },
  {
    name: "premium_table_felt.png",
    prompt: "perfectly top down overhead view of premium dark teal green poker table felt surface texture, subtle woven fabric pattern visible, soft even studio lighting, seamless tileable texture, rich deep teal emerald green color, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
    width: 1024, height: 1024
  },
  {
    name: "chip_stack_gold.png",
    prompt: "3D rendered tall stack of premium casino poker chips on dark reflective surface, chips colored black gold and teal with intricate edge patterns, dramatic cinematic side lighting with golden highlights, photorealistic, dark black background, shallow depth of field, luxury casino atmosphere, isolated object, 8k quality",
    width: 512, height: 512
  },
  {
    name: "card_back_premium.png",
    prompt: "flat 2D premium playing card back design, dark navy blue background with intricate gold geometric art deco pattern, golden lion emblem centered, ornate symmetrical border with fine gold lines, luxury elegant feel, dark theme, perfectly rectangular card shape, high detail vector quality, isolated on black background, 8k",
    width: 512, height: 768
  },

  // === Shop/Marketplace Items ===
  {
    name: "marketplace_avatar_cyber.png",
    prompt: "mythic animated cyberpunk character portrait bust, The Cyber Source, face and eyes emanating bright electric blue energy tendrils and lightning, dark hood and cyber augments, holographic data streams around head, dramatic blue teal lighting on dark background, fantasy RPG character art style, game avatar icon, 8k quality",
    width: 512, height: 512
  },
  {
    name: "marketplace_theme_space.png",
    prompt: "fantasy poker table floating in deep space, cosmic purple and blue nebula swirling beneath transparent glass table surface, distant stars and galaxies visible, floating asteroid fragments nearby, science fiction atmosphere, game promotional art, dramatic cinematic purple and blue lighting, 8k quality",
    width: 768, height: 512
  },
  {
    name: "marketplace_theme_demonic.png",
    prompt: "dark gothic demonic poker table, hellfire lava and flames visible beneath cracked obsidian table surface, red orange ember particles rising, demonic skull decorations and dark iron frame, sinister infernal atmosphere, game promotional art, dramatic red and black cinematic lighting, 8k quality",
    width: 768, height: 512
  },

  // === Member Portraits ===
  {
    name: "member_portrait_warrior.png",
    prompt: "detailed cyberpunk female warrior character portrait headshot, bright red mohawk hairstyle, cybernetic glowing blue eye replacement on left side, battle scars across cheek, confident smirk expression, dark background with teal cyan rim lighting on edges, circular avatar portrait crop friendly, game character art style, 8k quality",
    width: 512, height: 512
  },
  {
    name: "member_portrait_aristocrat.png",
    prompt: "detailed cyberpunk male aristocrat character portrait headshot, distinguished silver beard and slicked back hair, monocle with augmented reality holographic display, dark expensive suit with subtle tech details, wise calculating expression, dark background with warm golden rim lighting, circular avatar portrait crop friendly, game character art style, 8k quality",
    width: 512, height: 512
  },
  {
    name: "member_portrait_hacker.png",
    prompt: "detailed cyberpunk young hacker character portrait headshot, bright neon green messy hair, holographic transparent smart glasses displaying code, dark hoodie with glowing circuit patterns, mischievous grin expression, dark background with green neon rim lighting, circular avatar portrait crop friendly, game character art style, 8k quality",
    width: 512, height: 512
  },
];

async function generateImage(asset, index) {
  const encodedPrompt = encodeURIComponent(asset.prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${asset.width}&height=${asset.height}&model=flux&nologo=true&seed=${1000 + index}`;

  console.log(`[${index + 1}/${assets.length}] Generating: ${asset.name}...`);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const outPath = path.join(OUT_DIR, asset.name);
      await writeFile(outPath, buffer);

      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      console.log(`  ✓ ${asset.name} saved (${sizeMB} MB)`);
      return true;
    } catch (err) {
      console.log(`  ✗ Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  console.log(`  ✗ FAILED: ${asset.name}`);
  return false;
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  console.log(`\nGenerating ${assets.length} cinematic poker assets...`);
  console.log(`Output: ${OUT_DIR}\n`);

  let success = 0;
  let failed = 0;

  // Generate in batches of 2 (respect rate limits ~1 req/15s for anonymous)
  for (let i = 0; i < assets.length; i += 2) {
    const batch = assets.slice(i, i + 2);
    const results = await Promise.all(
      batch.map((asset, j) => generateImage(asset, i + j))
    );
    results.forEach(ok => ok ? success++ : failed++);

    if (i + 2 < assets.length) {
      console.log(`  ... waiting 16s for rate limit ...`);
      await new Promise(r => setTimeout(r, 16000));
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
  console.log(`Assets saved to: ${OUT_DIR}`);
}

main().catch(console.error);
