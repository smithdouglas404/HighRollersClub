#!/usr/bin/env node
// Generate 24 high-quality cyberpunk poker player avatars using Gemini 2.5 Flash Image
// Higher resolution, sharper details, consistent style across all avatars
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('attached_assets/generated_images/avatars');
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error("Set GEMINI_API_KEY"); process.exit(1); }

const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

// Style prefix for consistency across all avatars
const STYLE = "hyper-detailed cinematic 3D character portrait, Unreal Engine 5 quality, studio lighting with dramatic rim light, ultra sharp focus, 8K resolution, dark moody background with subtle colored glow, game character art style, centered bust composition, high polygon count, subsurface skin scattering, realistic skin pores and textures with cyberpunk aesthetic";

const AVATARS = [
  // --- Legendary (6) ---
  { name: "avatar_neon_viper.webp", prompt: `${STYLE}, male cyberpunk operative in his 30s, sharp angular face with strong jawline, glowing cyan LED tactical visor across eyes, short silver-white spiked hair with blue tips, dark matte black tactical armor with glowing blue circuit lines and carbon fiber texture, menacing confident smirk, teal cyan background glow` },
  { name: "avatar_chrome_siren.webp", prompt: `${STYLE}, female cyberpunk elite in her 20s, strikingly beautiful face with sharp cheekbones, short asymmetric platinum-lavender hair, sleek chrome and obsidian bodysuit with purple neon accent strips, holographic purple light collar, piercing emerald green eyes, purple violet background glow` },
  { name: "avatar_gold_phantom.webp", prompt: `${STYLE}, mysterious figure wearing ornate half-face mask of black and gold with intricate circuit engravings, glowing amber eyes visible through mask, dark hooded cloak with gold thread circuit patterns, luxury dark atmosphere, warm gold background glow` },
  { name: "avatar_shadow_king.webp", prompt: `${STYLE}, powerful dark-skinned male cyberpunk leader in his 40s, bald head with golden cybernetic implants along skull and temples, thick gold chain with lion medallion, premium black leather coat with gold trim and embedded LEDs, commanding regal expression, gold particle background glow` },
  { name: "avatar_void_witch.webp", prompt: `${STYLE}, dark cyberpunk sorceress, deep purple lipstick and glowing violet eyes with no pupils, black hood with floating dark energy particles swirling around, silver facial piercings on eyebrow and lip, mysterious dangerous beauty, deep purple void background glow` },
  { name: "avatar_cyber_samurai.webp", prompt: `${STYLE}, Japanese cyberpunk ronin warrior, traditional-tech hybrid kabuto helmet with glowing blue visor slit, dark samurai armor fused with circuit boards and blue LED accents, stoic battle-hardened expression, Japanese wave pattern on shoulder plate, blue background glow` },

  // --- Epic (8) ---
  { name: "avatar_red_wolf.webp", prompt: `${STYLE}, rugged male cyberpunk hunter, wild reddish-brown hair swept back, red LED cybernetic eye replacement on left eye with visible circuitry, facial battle scars across cheek and nose, dark combat vest with red accent warning lights, fierce predatory expression, red background glow` },
  { name: "avatar_ice_queen.webp", prompt: `${STYLE}, elegant female cyberpunk aristocrat, long flowing white hair with ice blue crystalline streaks, pale porcelain skin, crystal blue glowing eyes, white and silver high-collar futuristic outfit with frost particle effects on shoulders, cold calculating expression, ice blue background glow` },
  { name: "avatar_tech_monk.webp", prompt: `${STYLE}, Asian cyberpunk monk, shaved head with glowing green circuit tattoo patterns across scalp, traditional dark robes merged with lightweight tech armor plates, green holographic prayer beads floating around neck, serene meditative expression, green aura background glow` },
  { name: "avatar_cyber_punk.webp", prompt: `${STYLE}, young rebellious cyberpunk, wild neon pink mohawk hairstyle, multiple ear piercings and glowing neck tattoos, punk leather jacket covered in holographic patches and band logos, defiant smirk chewing gum, hot pink neon background glow` },
  { name: "avatar_oracle_seer.webp", prompt: `${STYLE}, mystical cyberpunk oracle, glowing solid white eyes with no pupils radiating light, floating holographic tarot card symbols orbiting head, dark flowing robes with constellation star patterns, serene all-knowing expression, ethereal white background glow` },
  { name: "avatar_punk_duchess.webp", prompt: `${STYLE}, cyberpunk Victorian duchess, elaborate dark upswept hairstyle with fiber optic strands woven through glowing softly, elegant black corset with intricate tech clockwork details, ruby red cyber monocle over right eye, haughty confident aristocratic expression, dark red background glow` },
  { name: "avatar_mech_pilot.webp", prompt: `${STYLE}, heavy-set cyberpunk mech pilot, bulky flight helmet with multiple antenna arrays and holographic displays, oil-stained weathered face with determination, mechanical exoskeleton collar and shoulder frame visible, yellow warning light strips on armor, yellow background glow` },
  { name: "avatar_ghost_sniper.webp", prompt: `${STYLE}, cyberpunk stealth sniper, tactical ghillie hood made of fiber optic camouflage strands that shift color, one glowing red targeting reticle eye, scarred weathered face partially hidden, intense razor-focused expression, red accent background glow` },

  // --- Rare (10) ---
  { name: "avatar_steel_ghost.webp", prompt: `${STYLE}, cyberpunk anonymous operative, smooth featureless polished chrome mirror mask reflecting environment, dark tactical hoodie with raised collar, no visible face features just reflective chrome surface, mysterious anonymous presence, teal background glow` },
  { name: "avatar_neon_fox.webp", prompt: `${STYLE}, female cyberpunk trickster, fox-shaped glowing orange AR smart glasses, short spiky bright orange hair, freckles across nose, playful confident mischievous grin, orange and black lightweight tech jacket with fox emblem on chest, orange background glow` },
  { name: "avatar_dark_ace.webp", prompt: `${STYLE}, cyberpunk gentleman agent, sleek dark futuristic suit and tie, slicked back jet black hair, thin glowing blue energy line running vertically down center of face like a scar, cool collected unreadable expression, minimal blue accent background glow` },
  { name: "avatar_bolt_runner.webp", prompt: `${STYLE}, young female cyberpunk speedster, bright yellow lightning bolt face paint across eyes and temples, wild curly dark hair with electric yellow streaks, energetic excited fierce expression, yellow and black racing-style armored jacket, electric yellow spark background glow` },
  { name: "avatar_street_racer.webp", prompt: `${STYLE}, cyberpunk street racer, racing helmet with tinted orange visor flipped up revealing spiky black hair, racing suit with neon orange speed stripe accents, adrenaline-fueled confident grin, orange glow background` },
  { name: "avatar_dj_chrome.webp", prompt: `${STYLE}, cyberpunk DJ entertainer, massive chrome over-ear headphones with blue LED equalizer bars dancing, wild electric blue mohawk, mirror-finish chrome sunglasses, cocky showman grin, blue and purple background glow` },
  { name: "avatar_iron_bull.webp", prompt: `${STYLE}, massive cyberpunk enforcer, extremely thick neck with visible metal reinforcement plates and bolts, military buzz cut with scars across scalp, heavy jaw with cybernetic implant, intimidating stone-cold expression, dark military vest with scratched armor plates, steel gray background glow` },
  { name: "avatar_data_thief.webp", prompt: `${STYLE}, cyberpunk hacker thief, sleek black face mask covering lower face and nose, glowing cyan data stream tattoos on temples flowing down neck, dark techwear hoodie with hidden pockets, calculating sharp analytical eyes visible above mask, cyan digital background glow` },
  { name: "avatar_neon_medic.webp", prompt: `${STYLE}, cyberpunk combat medic, white tactical medical coat with glowing green cross emblem on chest and shoulder, short dark hair neatly kept, green holographic medical HUD display over one eye, calm professional composed expression, green background glow` },
  { name: "avatar_merchant_boss.webp", prompt: `${STYLE}, wealthy cyberpunk crime boss, expensive dark suit with gold circuit pattern pin on lapel, thick gold rings on multiple fingers with embedded LEDs, holographic cigar with digital smoke, confident cunning powerful smile, warm gold background glow` },
];

async function generateImage(asset, index) {
  console.log(`[${index + 1}/${AVATARS.length}] ${asset.name}...`);

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      if (!imageData) throw new Error("No image data in response");

      const buffer = Buffer.from(imageData, "base64");
      const outPath = path.join(OUT_DIR, asset.name);
      await writeFile(outPath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(0);
      console.log(`  ✓ ${asset.name} (${sizeKB} KB)`);
      return true;
    } catch (err) {
      console.log(`  ✗ Attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }
  console.log(`  ✗ FAILED: ${asset.name}`);
  return false;
}

async function main() {
  console.log(`\nGenerating ${AVATARS.length} HD cyberpunk avatars via Gemini...\n`);

  let success = 0, failed = 0;
  for (let i = 0; i < AVATARS.length; i++) {
    const ok = await generateImage(AVATARS[i], i);
    ok ? success++ : failed++;
    if (i < AVATARS.length - 1) {
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
  console.log(`Avatars saved to: ${OUT_DIR}`);
}

main().catch(console.error);
