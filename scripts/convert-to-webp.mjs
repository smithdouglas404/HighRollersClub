import sharp from "sharp";
import { readdir, stat, unlink } from "fs/promises";
import { join, basename, extname } from "path";

const ASSETS_DIR = "/home/runner/workspace/attached_assets/generated_images";
const AVATARS_DIR = join(ASSETS_DIR, "avatars");

// Images actually used in the codebase (from grep analysis)
const USED_IMAGES = new Set([
  // Avatars (all 12)
  "avatar_gold_phantom.png",
  "avatar_shadow_king.png",
  "avatar_red_wolf.png",
  "avatar_ice_queen.png",
  "avatar_tech_monk.png",
  "avatar_cyber_punk.png",
  "avatar_steel_ghost.png",
  "avatar_neon_fox.png",
  "avatar_dark_ace.png",
  "avatar_bolt_runner.png",
  "avatar_neon_viper.png",
  "avatar_chrome_siren.png",
  // Backgrounds & assets
  "lion_crest_gold_emblem.png",
  "cinematic_server_room_bg.png",
  "cyberpunk_casino_bg_wide.png",
  "poker_table_clean_topdown.png",
  "poker_table_perspective.png",
  "poker_table_top_cinematic.png",
  "gold_chip_stack_3d.png",
  "poker_felt_top_down.png",
  "chip_stack_gold_pile.png",
]);

// Images confirmed unused
const UNUSED_IMAGES = [
  "holographic_hud_overlay.png",
  "player_seated_cyberpunk_1.png",
  "player_seated_cyberpunk_2.png",
  "player_seated_cyberpunk_3.png",
  "player_seated_cyberpunk_4.png",
  "cyberpunk_poker_player_avatar_1.png",
  "cyberpunk_poker_player_avatar_2.png",
  "cyberpunk_poker_player_avatar_3.png",
  "cyberpunk_poker_player_avatar_4.png",
  "holographic_entropy_network_hud.png",
  "holographic_network_graph_green.png",
  "holographic_player_alliance_ui.png",
  "marketplace_item_armor.png",
  "marketplace_item_helmet.png",
  "neon_diamond_sparkle.png",
  "poker_table_bg_cinematic.png",
  "poker_table_bg_v2.png",
  "poker_table_online_view.png",
  "poker_table_scene_clean.png",
  "poker_table_topdown_clean.png",
  "luxury_poker_table_surface.png",
  "Dark_Teal_Poker_Felt_Texture_83ec2760.png",
  "blurred_server_room_background.png",
  "chip_stack_large.png",
  "chip_stack_medium.png",
  "chip_stack_small.png",
  "card_back_cyberpunk.png",
  "card_back_premium.png",
  "card_back_topdown.png",
  "card_face_template.png",
  "dealer_button.png",
  "avatar_neon_frame_cyan.png",
  "Golden_Lion_Logo_for_Poker_Table_961614b0.png",
];

async function convertFile(inputPath, outputPath, opts = {}) {
  const inputStat = await stat(inputPath);
  const inputSize = inputStat.size;

  let pipeline = sharp(inputPath);

  if (opts.resize) {
    pipeline = pipeline.resize(opts.resize, opts.resize, { fit: "cover" });
  }

  await pipeline.webp({ quality: opts.quality || 80 }).toFile(outputPath);

  const outputStat = await stat(outputPath);
  const outputSize = outputStat.size;
  const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

  console.log(
    `  ${basename(inputPath)} → ${basename(outputPath)}  ` +
    `${(inputSize / 1024).toFixed(0)}KB → ${(outputSize / 1024).toFixed(0)}KB  (${savings}% smaller)`
  );

  return { inputSize, outputSize };
}

async function main() {
  let totalInput = 0;
  let totalOutput = 0;

  // 1. Convert avatars (resize to 240x240)
  console.log("\n=== Avatars (240x240, quality 85) ===\n");
  const avatarFiles = await readdir(AVATARS_DIR);
  for (const file of avatarFiles) {
    if (!file.endsWith(".png")) continue;
    const input = join(AVATARS_DIR, file);
    const output = join(AVATARS_DIR, file.replace(".png", ".webp"));
    const { inputSize, outputSize } = await convertFile(input, output, { resize: 240, quality: 85 });
    totalInput += inputSize;
    totalOutput += outputSize;
  }

  // 2. Convert background images (full size, quality 80)
  console.log("\n=== Backgrounds & Assets (quality 80) ===\n");
  const bgFiles = await readdir(ASSETS_DIR);
  for (const file of bgFiles) {
    if (!file.endsWith(".png")) continue;
    if (UNUSED_IMAGES.includes(file)) continue; // skip unused
    if (!USED_IMAGES.has(file)) continue; // only convert used files
    const input = join(ASSETS_DIR, file);
    const output = join(ASSETS_DIR, file.replace(".png", ".webp"));

    // Lion logo: smaller, high quality
    let opts = { quality: 80 };
    if (file === "lion_crest_gold_emblem.png") {
      opts = { quality: 85, resize: 512 };
    }
    // Gold chips: medium size
    if (file.includes("chip") || file.includes("gold")) {
      opts = { quality: 82, resize: 512 };
    }

    const { inputSize, outputSize } = await convertFile(input, output, opts);
    totalInput += inputSize;
    totalOutput += outputSize;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total input:  ${(totalInput / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Total output: ${(totalOutput / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Savings:      ${((1 - totalOutput / totalInput) * 100).toFixed(1)}%`);
  console.log(`Saved:        ${((totalInput - totalOutput) / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
