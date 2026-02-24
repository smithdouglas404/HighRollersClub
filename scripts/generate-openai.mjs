import fs from "fs";
import path from "path";
import https from "https";

const API_KEY = "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";
const OUT_DIR = path.resolve("attached_assets/generated_images");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ASSETS = [
  {
    name: "player_seated_cyberpunk_1.png",
    prompt: "Full body portrait of a cyberpunk poker player seated at a dark poker table, male character wearing futuristic tactical armor with glowing cyan LED accents, dark visor helmet, moody cinematic lighting from above, dark teal and black color palette, photorealistic 3D render, ultra detailed, 4K game art style, black background"
  },
  {
    name: "player_seated_cyberpunk_2.png",
    prompt: "Full body portrait of a female cyberpunk poker player seated at a dark poker table, wearing sleek black and gold futuristic outfit with holographic collar, short neon-highlighted hair, confident expression, moody cinematic lighting, dark teal and black color palette, photorealistic 3D render, ultra detailed, 4K game art style, black background"
  },
  {
    name: "player_seated_cyberpunk_3.png",
    prompt: "Full body portrait of a cyberpunk poker player seated at a dark poker table, muscular male character wearing heavy chrome cybernetic armor with red LED accents, mechanical arm, intimidating presence, moody cinematic lighting, dark teal and black color palette, photorealistic 3D render, ultra detailed, 4K game art style, black background"
  },
  {
    name: "player_seated_cyberpunk_4.png",
    prompt: "Full body portrait of a mysterious cyberpunk poker player seated at a dark poker table, hooded figure in dark tactical gear with green holographic display over one eye, glowing circuit patterns on jacket, moody cinematic lighting, dark teal and black color palette, photorealistic 3D render, ultra detailed, 4K game art style, black background"
  },
  {
    name: "cinematic_server_room_bg.png",
    prompt: "Wide angle cinematic photograph of a dark futuristic server room corridor, rows of illuminated server racks with blue and green LED lights, volumetric fog, depth of field blur, moody cyberpunk atmosphere, dark teal and black color palette, photorealistic, ultra detailed 4K, suitable as a background image for a poker game UI"
  },
  {
    name: "poker_table_top_cinematic.png",
    prompt: "Top-down view of a premium dark teal poker table felt surface with subtle texture, luxury gold trim border visible at edges, center has a faint embossed lion crest watermark, cinematic lighting with soft spotlight from above, photorealistic, ultra detailed 4K, dark moody atmosphere"
  },
  {
    name: "gold_chip_stack_3d.png",
    prompt: "Stack of luxury poker chips on black background, gold, red and green chips stacked neatly, photorealistic 3D render with dramatic lighting, reflections and shadows, casino quality chips with detailed edge patterns, ultra detailed 4K, isolated on pure black background"
  },
  {
    name: "card_back_premium.png",
    prompt: "Single playing card back design, dark navy blue with intricate gold geometric pattern, lion emblem in center, luxury premium casino quality, ornate border design, photorealistic 3D render on black background, ultra detailed 4K"
  },
  {
    name: "lion_crest_gold_emblem.png",
    prompt: "Golden lion head emblem logo, front-facing majestic lion with crown, metallic gold with subtle glow, shield shape background, luxury premium quality, dark background, photorealistic 3D render, isolated on pure black background, ultra detailed 4K"
  },
  {
    name: "holographic_hud_overlay.png",
    prompt: "Futuristic holographic HUD interface overlay, circular data visualization with glowing cyan and green lines, network nodes connected by light beams, digital entropy visualization, dark background with transparent elements, cyberpunk style, ultra detailed 4K"
  },
  {
    name: "neon_diamond_sparkle.png",
    prompt: "Single glowing diamond shape icon, white and cyan neon glow effect, sparkle particles around it, minimalist, isolated on pure black background, photorealistic 3D render, ultra detailed"
  },
  {
    name: "marketplace_item_armor.png",
    prompt: "Cyberpunk character avatar bust portrait, wearing ornate futuristic armor with glowing purple accents, mythic rarity game item showcase, dramatic lighting, dark background, photorealistic 3D render, ultra detailed 4K, game marketplace item preview"
  },
  {
    name: "marketplace_item_helmet.png",
    prompt: "Futuristic cyber helmet with holographic visor display, gold and black color scheme, legendary rarity game item showcase, dramatic lighting on dark background, photorealistic 3D render, ultra detailed 4K, game marketplace item preview"
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
            console.log(`  ✓ ${asset.name} (${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`);
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
  console.log(`\nGenerating ${ASSETS.length} cinematic assets via DALL-E 3...\n`);

  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];
    console.log(`[${i + 1}/${ASSETS.length}] ${asset.name}...`);
    try {
      await generateImage(asset);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
    // Small delay between requests to be respectful
    if (i < ASSETS.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log("\nDone! Assets saved to:", OUT_DIR);
}

main();
