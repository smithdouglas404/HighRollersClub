#!/usr/bin/env node
// Generate AI art for all 10 UI areas using Google Nano Banana (Gemini image generation)
// Usage: node scripts/generate-ui-art.mjs

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('attached_assets/generated_images');
const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC-UlvBMHtaPN1Zm15kSSBs52rVfNTimZk';
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const assets = [
  // ═══════════════════════════════════════════════════════════════
  // AREA 1: Table Felts/Backgrounds (6 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "felts/felt_royal_velvet.webp",
    prompt: "perfectly top down overhead view of premium deep burgundy royal red velvet poker table felt surface texture, subtle woven fabric pattern visible, rich deep crimson maroon color, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
  },
  {
    name: "felts/felt_ocean_deep.webp",
    prompt: "perfectly top down overhead view of premium deep ocean blue poker table felt surface texture, subtle wave-like woven pattern, rich navy sapphire blue color, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
  },
  {
    name: "felts/felt_emerald_luxury.webp",
    prompt: "perfectly top down overhead view of premium emerald green poker table felt with subtle gold thread accents woven into fabric, rich deep emerald color, luxury casino quality, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
  },
  {
    name: "felts/felt_cosmic_purple.webp",
    prompt: "perfectly top down overhead view of premium dark cosmic purple poker table felt surface texture, deep violet purple with subtle nebula-like color variation, mysterious atmosphere, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
  },
  {
    name: "felts/felt_carbon_fiber.webp",
    prompt: "perfectly top down overhead view of dark carbon fiber poker table surface texture, matte black with subtle woven carbon pattern, tech futuristic cyberpunk aesthetic, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic material texture, 8k quality",
  },
  {
    name: "felts/felt_gold_vip.webp",
    prompt: "perfectly top down overhead view of premium black poker table felt with intricate gold damask pattern woven into fabric, VIP luxury casino aesthetic, dark black base with gold ornamental accents, soft even studio lighting, seamless tileable texture, very slight dark vignette at edges, photorealistic fabric material texture, 8k quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 2: Player Avatars (12 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "avatars/avatar_cyber_samurai.webp",
    prompt: "portrait bust of a cyberpunk samurai poker player, traditional kabuto helmet fused with glowing blue tech visor, dark armor with Japanese wave pattern in cyan LED, stoic focused expression, dark background with blue glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_neon_medic.webp",
    prompt: "portrait bust of a cyberpunk combat medic poker player, white tactical coat with glowing green cross emblem and medical readouts, short dark hair, green holographic HUD over one eye, calm professional expression, dark background with green glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_dj_chrome.webp",
    prompt: "portrait bust of a cyberpunk DJ poker player, massive chrome headphones with blue LED equalizer display, wild electric blue mohawk, mirror-finish sunglasses, cocky grin, dark background with blue and purple glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_ghost_sniper.webp",
    prompt: "portrait bust of a cyberpunk sniper poker player, tactical ghillie hood with fiber optic camouflage strands, one glowing red targeting eye, scarred weathered face, intense focused expression, dark background with red accent glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_oracle_seer.webp",
    prompt: "portrait bust of a mystical cyberpunk oracle poker player, glowing white eyes with no pupils, floating holographic tarot symbols around head, dark robes with constellation patterns, serene all-knowing expression, dark background with ethereal white glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_merchant_boss.webp",
    prompt: "portrait bust of a wealthy cyberpunk merchant poker player, expensive dark suit with gold circuit pin, thick gold rings on fingers, cigar with holographic smoke, confident cunning smile, dark background with warm gold glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_street_racer.webp",
    prompt: "portrait bust of a cyberpunk street racer poker player, racing helmet with tinted orange visor flipped up, spiky black hair, racing suit with neon orange speed stripes, adrenaline-fueled grin, dark background with orange glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_void_witch.webp",
    prompt: "portrait bust of a cyberpunk witch poker player, dark purple lipstick, glowing violet eyes, black hood with floating dark energy particles, silver facial piercings, mysterious dangerous beauty, dark background with deep purple void glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_mech_pilot.webp",
    prompt: "portrait bust of a cyberpunk mech pilot poker player, heavy flight helmet with multiple antenna and displays, oil-stained face, mechanical exoskeleton collar visible, determined tough expression, dark background with yellow warning light glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_data_thief.webp",
    prompt: "portrait bust of a cyberpunk data thief poker player, sleek black face mask covering lower face, glowing cyan data stream tattoos on temples, dark techwear hoodie, calculating sharp eyes, dark background with cyan digital glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_punk_duchess.webp",
    prompt: "portrait bust of a cyberpunk punk duchess poker player, elaborate dark Victorian hairstyle with glowing fiber optics woven in, elegant black corset with tech details, ruby red cyber monocle, haughty confident expression, dark background with dark red glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },
  {
    name: "avatars/avatar_iron_bull.webp",
    prompt: "portrait bust of a massive cyberpunk enforcer poker player, thick neck with metal reinforcement plates, buzz cut with scars, heavy jaw cybernetic implant, intimidating stone-faced expression, dark military vest, dark background with steel gray glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 3: Loading/Splash Screens (3 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "splash/splash_poker_cinematic.webp",
    prompt: "cinematic wide shot of premium poker cards flying through air in dramatic slow motion, royal flush hearts fanned out, golden chips scattering, volumetric light rays, dark luxurious casino atmosphere with bokeh lights in background, dramatic depth of field, photorealistic, movie quality lighting, 8k",
  },
  {
    name: "splash/splash_tournament.webp",
    prompt: "cinematic wide shot of a grand poker tournament arena, massive spotlight beams from above illuminating center table, crowd silhouettes in tiered seating, giant screens showing cards, fog machine atmosphere, dark dramatic lighting with gold and cyan accents, photorealistic, movie quality, 8k",
  },
  {
    name: "splash/splash_high_stakes.webp",
    prompt: "cinematic close-up of premium black and gold poker chips stacked high with playing cards scattered on dark reflective table surface, shallow depth of field bokeh background with warm golden casino lights, dramatic rim lighting, luxury high stakes atmosphere, photorealistic, 8k",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 4: Badge/Achievement Icons (8 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "badges/badge_first_win.webp",
    prompt: "golden star burst badge icon, radiant golden glow emanating outward, premium metallic gold texture, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_royal_flush.webp",
    prompt: "ornate golden crown sitting atop a royal flush fan of five cards, premium metallic gold and dark red, glowing magical aura, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_high_roller.webp",
    prompt: "single large diamond-encrusted poker chip, brilliant sparkling diamonds embedded in gold chip surface, premium luxury, radiant glow, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_bluff_master.webp",
    prompt: "ornate theater comedy and tragedy masks in gold and silver, one mask smiling one frowning, poker bluff master theme, mysterious dramatic lighting, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_iron_player.webp",
    prompt: "iron medieval shield with poker spade emblem engraved in center, scratched battle-worn metal texture, strong defensive theme, dramatic lighting, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_streak_fire.webp",
    prompt: "blazing fire streak icon, intense orange and red flames forming an upward streak shape, hot ember particles, winning streak poker theme, dramatic lighting, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_tournament_champ.webp",
    prompt: "golden trophy cup with laurel wreath wrapped around it, champion poker tournament theme, premium metallic gold texture, radiant golden glow, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },
  {
    name: "badges/badge_club_legend.webp",
    prompt: "majestic golden lion head crest surrounded by five golden stars, legendary status emblem, premium metallic gold texture with royal purple accents, radiant glow, dark background, poker achievement badge, clean centered composition, game UI icon style, highly detailed, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 5: Lobby Banners (3 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "banners/banner_welcome.webp",
    prompt: "wide panoramic banner of premium poker table with scattered chips and cards, warm inviting golden lighting, welcome to the game theme, luxury casino atmosphere, cinematic depth of field, dark background with golden highlights, photorealistic, 8k quality",
  },
  {
    name: "banners/banner_tournament.webp",
    prompt: "wide panoramic banner of poker tournament arena with dramatic spotlight beams, flying cards and chips, competitive exciting atmosphere, cyan and gold color scheme, cinematic lighting, dark background, photorealistic, 8k quality",
  },
  {
    name: "banners/banner_seasonal.webp",
    prompt: "wide panoramic banner of poker table in winter wonderland theme, subtle snowflakes and frost crystals, cool blue and silver color palette, premium poker chips with ice crystal details, elegant seasonal atmosphere, dark background with icy blue highlights, photorealistic, 8k quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 6: Emote Illustrations (8 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "emotes/emote_gg.webp",
    prompt: "stylized game controller icon with GG text glowing in cyan neon, cyberpunk style, dark background, small icon design, clean sharp edges, game emote style, bright vivid colors, 4K quality",
  },
  {
    name: "emotes/emote_nice.webp",
    prompt: "stylized golden clapping hands icon with sparkle effects, applause celebration theme, dark background, small icon design, clean sharp edges, game emote style, bright vivid gold color, 4K quality",
  },
  {
    name: "emotes/emote_bluff.webp",
    prompt: "stylized thinking face with magnifying glass and question mark, detective suspicion theme, cyan and white glow, dark background, small icon design, clean sharp edges, game emote style, 4K quality",
  },
  {
    name: "emotes/emote_allin.webp",
    prompt: "stylized rocket ship blasting off with fire trail, all-in poker theme, bright red and orange flames, dark background, small icon design, clean sharp edges, game emote style, bright vivid colors, 4K quality",
  },
  {
    name: "emotes/emote_gl.webp",
    prompt: "stylized four-leaf clover glowing bright green with sparkle particles, good luck theme, dark background, small icon design, clean sharp edges, game emote style, bright vivid green color, 4K quality",
  },
  {
    name: "emotes/emote_think.webp",
    prompt: "stylized glowing brain icon with purple energy pulses and thought bubbles, deep thinking theme, dark background, small icon design, clean sharp edges, game emote style, bright vivid purple color, 4K quality",
  },
  {
    name: "emotes/emote_wow.webp",
    prompt: "stylized shocked explosion starburst icon with exclamation marks, surprise wow theme, bright orange and yellow, dark background, small icon design, clean sharp edges, game emote style, bright vivid colors, 4K quality",
  },
  {
    name: "emotes/emote_cry.webp",
    prompt: "stylized broken heart with tear drop falling, bad beat sadness theme, muted blue and gray tones, dark background, small icon design, clean sharp edges, game emote style, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 7: Club Logos/Crests (6 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "clubs/club_lions.webp",
    prompt: "heraldic crest emblem with majestic golden lion head facing forward, ornate shield with poker suit symbols, royal crown on top, premium metallic gold texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },
  {
    name: "clubs/club_sharks.webp",
    prompt: "heraldic crest emblem with aggressive shark silhouette, ornate shield with poker suit symbols, dark blue and silver color scheme, ocean predator theme, premium metallic texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },
  {
    name: "clubs/club_eagles.webp",
    prompt: "heraldic crest emblem with majestic eagle with spread wings, ornate shield with poker suit symbols, dark green and gold color scheme, premium metallic texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },
  {
    name: "clubs/club_dragons.webp",
    prompt: "heraldic crest emblem with fierce dragon breathing fire, ornate shield with poker suit symbols, dark red and gold color scheme, premium metallic texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },
  {
    name: "clubs/club_wolves.webp",
    prompt: "heraldic crest emblem with howling wolf silhouette, ornate shield with poker suit symbols, dark gray and silver color scheme, pack loyalty theme, premium metallic texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },
  {
    name: "clubs/club_aces.webp",
    prompt: "heraldic crest emblem with four aces playing cards fanned out, ornate shield, royal purple and gold color scheme, elite poker club theme, premium metallic texture, dark background, club logo style, symmetrical centered composition, highly detailed, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 8: Empty State Illustrations (4 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "empty/empty_no_tables.webp",
    prompt: "melancholic empty poker table in a dark room, single overhead light creating pool of light on felt, dust particles floating in light beam, no players, lonely abandoned casino atmosphere, moody cinematic lighting, photorealistic, 4K quality",
  },
  {
    name: "empty/empty_no_clubs.webp",
    prompt: "empty elegant club room with poker memorabilia on dark walls, empty leather chairs around table, warm but lonely atmosphere, vintage poker posters, single lamp casting warm light, moody cinematic lighting, photorealistic, 4K quality",
  },
  {
    name: "empty/empty_no_history.webp",
    prompt: "blank spread of face-down playing cards on dark felt surface, no hands visible, fresh unplayed deck aesthetic, clean minimalist, invitation to start playing, soft overhead lighting, moody cinematic atmosphere, photorealistic, 4K quality",
  },
  {
    name: "empty/empty_no_friends.webp",
    prompt: "empty poker table with multiple empty chairs pushed in, name placards but no players, waiting for friends theme, warm inviting but empty atmosphere, soft overhead lighting, moody cinematic feeling, photorealistic, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 9: Rank/Tier Avatar Frames (5 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "frames/frame_bronze.webp",
    prompt: "ornate circular avatar frame border ring in bronze copper metal, decorative embossed pattern, empty transparent center for avatar, worn patina texture, dark background, game UI element, clean centered composition, highly detailed metalwork, 4K quality",
  },
  {
    name: "frames/frame_silver.webp",
    prompt: "ornate circular avatar frame border ring in polished silver metal, decorative engraved pattern with small gems, empty transparent center for avatar, reflective silver texture, dark background, game UI element, clean centered composition, highly detailed metalwork, 4K quality",
  },
  {
    name: "frames/frame_gold.webp",
    prompt: "ornate circular avatar frame border ring in premium gold metal, decorative filigree pattern with embedded rubies, empty transparent center for avatar, rich golden glow, dark background, game UI element, clean centered composition, highly detailed metalwork, 4K quality",
  },
  {
    name: "frames/frame_platinum.webp",
    prompt: "ornate circular avatar frame border ring in platinum white metal with cyan energy accents, futuristic tech-meets-luxury pattern, glowing cyan gems, empty transparent center for avatar, dark background, game UI element, clean centered composition, highly detailed, 4K quality",
  },
  {
    name: "frames/frame_diamond.webp",
    prompt: "ornate circular avatar frame border ring encrusted with brilliant diamonds and crystals, rainbow prismatic light reflections, most premium tier, radiant white and prismatic glow, empty transparent center for avatar, dark background, game UI element, clean centered composition, highly detailed, 4K quality",
  },

  // ═══════════════════════════════════════════════════════════════
  // AREA 10: Card Backs (4 images)
  // ═══════════════════════════════════════════════════════════════
  {
    name: "cardbacks/cardback_classic.webp",
    prompt: "flat 2D premium playing card back design, dark navy blue background with intricate gold geometric art deco pattern, golden lion emblem centered, ornate symmetrical border with fine gold lines, luxury elegant feel, dark theme, perfectly rectangular card shape, high detail, isolated on black background, 4K quality",
  },
  {
    name: "cardbacks/cardback_neon.webp",
    prompt: "flat 2D premium playing card back design, matte black background with bright neon cyan circuit board pattern, glowing cyan spade emblem centered, cyberpunk tech aesthetic, thin neon border, dark theme, perfectly rectangular card shape, high detail, isolated on black background, 4K quality",
  },
  {
    name: "cardbacks/cardback_royal.webp",
    prompt: "flat 2D premium playing card back design, deep royal red background with ornate gold baroque scrollwork pattern, golden crown emblem centered, classic luxury casino feel, gold border with decorative corners, dark theme, perfectly rectangular card shape, high detail, isolated on black background, 4K quality",
  },
  {
    name: "cardbacks/cardback_holographic.webp",
    prompt: "flat 2D premium playing card back design, dark background with holographic rainbow shimmer geometric pattern, prismatic diamond emblem centered, iridescent color shifting effect, thin holographic border, futuristic feel, perfectly rectangular card shape, high detail, isolated on black background, 4K quality",
  },
];

async function generateImage(asset, index) {
  console.log(`[${index + 1}/${assets.length}] Generating: ${asset.name}...`);

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

      // Find the image part in the response
      let imageData = null;
      let mimeType = 'image/png';
      for (const candidate of json.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) {
            imageData = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'image/png';
            break;
          }
        }
        if (imageData) break;
      }

      if (!imageData) {
        throw new Error('No image data in response');
      }

      const buffer = Buffer.from(imageData, 'base64');

      // Ensure subdirectory exists
      const outPath = path.join(OUT_DIR, asset.name);
      const dir = path.dirname(outPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(outPath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(0);
      console.log(`  ✓ ${asset.name} saved (${sizeKB} KB)`);
      return true;
    } catch (err) {
      console.log(`  ✗ Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 3000));
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

  console.log(`\nGenerating ${assets.length} UI art assets via Google Nano Banana (Gemini)...`);
  console.log(`Output: ${OUT_DIR}\n`);

  let success = 0;
  let failed = 0;

  // Generate one at a time to respect rate limits
  for (let i = 0; i < assets.length; i++) {
    const ok = await generateImage(assets[i], i);
    ok ? success++ : failed++;

    // Small delay between requests
    if (i < assets.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
  console.log(`Assets saved to: ${OUT_DIR}`);
}

main().catch(console.error);
