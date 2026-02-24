import fs from "fs";
import path from "path";
import https from "https";

const API_KEY = "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";
const OUT_DIR = path.resolve("attached_assets/generated_images/avatars");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const AVATARS = [
  // --- Legendary (4) ---
  {
    name: "avatar_neon_viper.png",
    prompt: "Portrait bust of a cyberpunk male poker player, sharp angular face, glowing cyan LED visor over eyes, dark tactical armor with blue neon accents, short silver hair, menacing confident expression, dark background with subtle blue glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_chrome_siren.png",
    prompt: "Portrait bust of a female cyberpunk poker player, sleek chrome and black futuristic bodysuit, holographic purple collar glow, short asymmetric platinum hair with purple tips, piercing green eyes, dark background with purple glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_gold_phantom.png",
    prompt: "Portrait bust of a mysterious cyberpunk figure in ornate gold and black mask covering half face, glowing amber eyes, dark hooded cloak with gold circuit patterns, luxury elite poker player aesthetic, dark background with warm gold glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_shadow_king.png",
    prompt: "Portrait bust of a dark-skinned cyberpunk male poker player, bald head with golden cybernetic implants along skull, thick gold chain with lion pendant, black leather jacket with gold trim, confident powerful expression, dark background with gold particles, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  // --- Epic (4) ---
  {
    name: "avatar_red_wolf.png",
    prompt: "Portrait bust of a rugged cyberpunk male poker player, wild red-tinted hair, facial scars, red LED eye implant on left eye, dark combat vest with red accent lights, fierce intense expression, dark background with red glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_ice_queen.png",
    prompt: "Portrait bust of an elegant female cyberpunk poker player, long white flowing hair with ice blue streaks, pale skin, crystal blue eyes, white and silver futuristic high-collar outfit with frost particle effects, cold calculating expression, dark background with ice blue glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_tech_monk.png",
    prompt: "Portrait bust of an Asian cyberpunk monk poker player, shaved head with glowing green circuit tattoos, traditional robes fused with tech armor, green holographic prayer beads, serene focused expression, dark background with green aura, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_cyber_punk.png",
    prompt: "Portrait bust of a young cyberpunk poker player with mohawk hairstyle in neon pink, multiple ear piercings and neck tattoos, punk leather jacket covered in holographic patches, chewing gum with smirk, dark background with pink neon glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  // --- Rare (4) ---
  {
    name: "avatar_steel_ghost.png",
    prompt: "Portrait bust of a cyberpunk poker player wearing a smooth featureless chrome mask reflecting light, dark hoodie, mysterious anonymous aesthetic, no visible face features just reflective metal, dark background with subtle teal glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_neon_fox.png",
    prompt: "Portrait bust of a female cyberpunk poker player, fox-shaped glowing orange AR glasses, short spiky orange hair, freckles, playful confident smile, orange and black tech jacket with fox emblem, dark background with orange glow, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_dark_ace.png",
    prompt: "Portrait bust of a cyberpunk poker player in a dark suit and tie futuristic style, slicked back dark hair, thin glowing blue line down center of face like a scar, cool collected expression, dark background with minimal blue accent, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
  {
    name: "avatar_bolt_runner.png",
    prompt: "Portrait bust of a young female cyberpunk poker player, bright yellow lightning bolt face paint across eyes, wild curly dark hair with yellow streaks, energetic excited expression, yellow and black racing-style jacket, dark background with electric yellow sparks, photorealistic 3D render, ultra detailed 4K, game avatar style, centered composition"
  },
];

async function generateImage(asset) {
  const body = JSON.stringify({
    model: "dall-e-3",
    prompt: asset.prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "b64_json",
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/images/generations",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const b64 = json.data[0].b64_json;
            const outPath = path.join(OUT_DIR, asset.name);
            fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
            const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(0);
            console.log(`  ✓ ${asset.name} (${sizeKB}KB)`);
            resolve(outPath);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`\nGenerating ${AVATARS.length} avatar portraits via DALL-E 3...\n`);

  for (let i = 0; i < AVATARS.length; i++) {
    const asset = AVATARS[i];
    console.log(`[${i + 1}/${AVATARS.length}] ${asset.name}...`);
    try {
      await generateImage(asset);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
    if (i < AVATARS.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log("\nDone! Avatars saved to:", OUT_DIR);
}

main();
