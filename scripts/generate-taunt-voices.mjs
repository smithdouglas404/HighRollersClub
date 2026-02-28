#!/usr/bin/env node
// Generate taunt audio clips using ElevenLabs TTS with expressive voice settings.
// Creates a "default" confident voice + avatar-specific voice variants.
//
// Usage:
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-taunt-voices.mjs
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-taunt-voices.mjs --voice=default
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-taunt-voices.mjs --voice=neon-viper

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOUNDS_DIR = path.join(__dirname, "../client/public/sounds/taunts");

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY environment variable");
  process.exit(1);
}

// ─── All taunts ──────────────────────────────────────────────────────────────

const TAUNTS = [
  // Free
  { id: "gg", text: "Good game!" },
  { id: "nice-hand", text: "Nice hand!" },
  { id: "gl", text: "Good luck!" },
  { id: "well-played", text: "Well played." },
  { id: "thats-poker", text: "That's poker, baby!" },
  { id: "nice-try", text: "Nice try!" },
  { id: "i-smell-bluff", text: "I smell a bluff..." },
  { id: "hmm", text: "Hmm... interesting." },
  { id: "patience", text: "Patience pays off." },
  { id: "bad-beat", text: "Brutal bad beat." },
  { id: "lets-go", text: "Let's gooo!" },
  { id: "fold-pre", text: "Should've folded pre." },
  // Premium
  { id: "ship-it", text: "Ship it!" },
  { id: "easy-money", text: "Easy money." },
  { id: "pay-me", text: "Pay me." },
  { id: "own-table", text: "I own this table." },
  { id: "read-you", text: "Read you like a book." },
  { id: "drawing-dead", text: "You're drawing dead." },
  { id: "run-it", text: "Run it twice? I don't need to." },
  { id: "the-nuts", text: "The nuts, baby!" },
  { id: "call-clock", text: "Call the clock!" },
  { id: "crying-call", text: "That's a crying call." },
  { id: "grandma", text: "My grandma plays better." },
  { id: "reload", text: "Time to reload." },
  { id: "math", text: "I did the math." },
  { id: "scared-money", text: "Scared money don't make money." },
  { id: "all-day", text: "I can do this all day." },
  { id: "respect", text: "Respect the raise." },
];

// ─── Voice profiles ──────────────────────────────────────────────────────────
// Each voice is tuned for poker taunt delivery — high expressiveness, confident.

export const TAUNT_VOICES = {
  // DEFAULT — cocky, confident, energetic male. Used when no avatar voice is set.
  default: {
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — Deep, Confident, Energetic
    label: "Confident (Default)",
    stability: 0.35,         // Lower = more expressive/dramatic
    similarityBoost: 0.7,
    style: 0.7,              // High style = more character
    useSpeakerBoost: true,
  },

  // Avatar-mapped voices — each avatar gets a fitting voice personality
  "neon-viper": {
    voiceId: "N2lVS1w4EtoT3dr4eOWO", // Callum — Husky Trickster
    label: "Husky Trickster",
    stability: 0.3,
    similarityBoost: 0.65,
    style: 0.8,
    useSpeakerBoost: true,
  },
  "chrome-siren": {
    voiceId: "cgSgspJ2msm6clMCkdW9", // Jessica — Playful, Bright
    label: "Playful Siren",
    stability: 0.35,
    similarityBoost: 0.7,
    style: 0.75,
    useSpeakerBoost: true,
  },
  "gold-phantom": {
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // George — Warm, Captivating Storyteller
    label: "Captivating Phantom",
    stability: 0.4,
    similarityBoost: 0.75,
    style: 0.6,
    useSpeakerBoost: true,
  },
  "shadow-king": {
    voiceId: "nPczCjzI2devNBz1zQrb", // Brian — Deep, Resonant
    label: "Deep Shadow",
    stability: 0.3,
    similarityBoost: 0.7,
    style: 0.75,
    useSpeakerBoost: true,
  },
  "red-wolf": {
    voiceId: "SOYHLrjzK2X1ezoPC6cr", // Harry — Fierce Warrior
    label: "Fierce Wolf",
    stability: 0.25,
    similarityBoost: 0.65,
    style: 0.85,
    useSpeakerBoost: true,
  },
  "ice-queen": {
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah — Mature, Confident
    label: "Ice Queen",
    stability: 0.4,
    similarityBoost: 0.75,
    style: 0.65,
    useSpeakerBoost: true,
  },
  "tech-monk": {
    voiceId: "pqHfZKP75CvOlQylNhV4", // Bill — Wise, Mature
    label: "Wise Monk",
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.5,
    useSpeakerBoost: true,
  },
  "cyber-punk": {
    voiceId: "TX3LPaxmHKxFdv7VOQHJ", // Liam — Energetic, Social Media
    label: "Punk Energy",
    stability: 0.25,
    similarityBoost: 0.6,
    style: 0.9,
    useSpeakerBoost: true,
  },
  "steel-ghost": {
    voiceId: "onwK4e9ZLuTAKqWW03F9", // Daniel — Steady Broadcaster
    label: "Steel Broadcaster",
    stability: 0.45,
    similarityBoost: 0.75,
    style: 0.55,
    useSpeakerBoost: true,
  },
  "neon-fox": {
    voiceId: "iP95p4xoKVk53GoZ742B", // Chris — Charming, Down-to-Earth
    label: "Charming Fox",
    stability: 0.35,
    similarityBoost: 0.7,
    style: 0.7,
    useSpeakerBoost: true,
  },
  "dark-ace": {
    voiceId: "cjVigY5qzO86Huf0OWal", // Eric — Smooth, Trustworthy
    label: "Smooth Ace",
    stability: 0.35,
    similarityBoost: 0.7,
    style: 0.7,
    useSpeakerBoost: true,
  },
  "bolt-runner": {
    voiceId: "CwhRBWXzGAHq8TQ4Fs17", // Roger — Laid-Back, Casual
    label: "Laid-Back Runner",
    stability: 0.35,
    similarityBoost: 0.65,
    style: 0.7,
    useSpeakerBoost: true,
  },
};

// ─── Generation ──────────────────────────────────────────────────────────────

async function generateClip(taunt, voice, voiceKey) {
  const dir = path.join(SOUNDS_DIR, voiceKey);
  fs.mkdirSync(dir, { recursive: true });

  const outPath = path.join(dir, `${taunt.id}.mp3`);

  // Skip if already exists
  if (fs.existsSync(outPath)) {
    console.log(`  [skip] ${voiceKey}/${taunt.id}.mp3 (already exists)`);
    return;
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": API_KEY,
      },
      body: JSON.stringify({
        text: taunt.text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: voice.stability,
          similarity_boost: voice.similarityBoost,
          style: voice.style,
          use_speaker_boost: voice.useSpeakerBoost,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`  [ERROR] ${voiceKey}/${taunt.id}: ${res.status} ${err}`);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  console.log(`  [ok] ${voiceKey}/${taunt.id}.mp3 (${(buffer.length / 1024).toFixed(1)}KB)`);

  // Rate limit: ~3 requests per second
  await new Promise((r) => setTimeout(r, 350));
}

async function main() {
  const targetVoice = process.argv.find((a) => a.startsWith("--voice="))?.split("=")[1];

  const voicesToGenerate = targetVoice
    ? { [targetVoice]: TAUNT_VOICES[targetVoice] }
    : TAUNT_VOICES;

  if (targetVoice && !TAUNT_VOICES[targetVoice]) {
    console.error(`Unknown voice: ${targetVoice}`);
    console.error(`Available: ${Object.keys(TAUNT_VOICES).join(", ")}`);
    process.exit(1);
  }

  for (const [voiceKey, voice] of Object.entries(voicesToGenerate)) {
    console.log(`\n=== Generating voice: ${voiceKey} (${voice.label}) ===`);
    for (const taunt of TAUNTS) {
      await generateClip(taunt, voice, voiceKey);
    }
  }

  // After generating, also copy default voice files to the root taunts dir
  // for backward compatibility (existing code loads from /sounds/taunts/{id}.mp3)
  if (!targetVoice || targetVoice === "default") {
    console.log("\n=== Copying default voice to root for backward compat ===");
    const defaultDir = path.join(SOUNDS_DIR, "default");
    for (const taunt of TAUNTS) {
      const src = path.join(defaultDir, `${taunt.id}.mp3`);
      const dst = path.join(SOUNDS_DIR, `${taunt.id}.mp3`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log(`  [copy] default/${taunt.id}.mp3 -> ${taunt.id}.mp3`);
      }
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
