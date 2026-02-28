// TTS Engine — ElevenLabs integration for two-voice poker commentary
// Generates audio for commentary segments using two distinct male voices.
// Serves audio via REST endpoint with LRU memory cache.

import type { CommentarySegment, CommentaryLine } from "./commentary-engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AudioAttachment {
  url: string;
  durationMs: number;
  buffer: Buffer;
}

interface CacheEntry {
  buffer: Buffer;
  durationMs: number;
  createdAt: number;
}

// ─── Voice Configuration ─────────────────────────────────────────────────────

// Two distinct male voices for the broadcast duo.
// These are default ElevenLabs pre-made voice IDs.
// pbp = "Adam" (professional, deep), analyst = "Josh" (casual, warm)
const VOICES = {
  pbp: {
    voiceId: "pNInz6obpgDQGcFmaJgB", // Adam
    stability: 0.6,
    similarityBoost: 0.8,
    style: 0.3,
  },
  analyst: {
    voiceId: "TxGEqnHWrfWFTfGW9XjX", // Josh
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.5,
  },
};

const TTS_MODEL = "eleven_turbo_v2_5";
const OUTPUT_FORMAT = "mp3_44100_64";
const TTS_TIMEOUT_MS = 8_000;

// ─── Audio Cache ─────────────────────────────────────────────────────────────

const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 60_000;

// Cache key: "segmentId:lineIndex"
const audioCache = new Map<string, CacheEntry>();

function cacheKey(segmentId: string, lineIndex: number): string {
  return `${segmentId}:${lineIndex}`;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of audioCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      audioCache.delete(key);
    }
  }
  // If still over limit, remove oldest
  if (audioCache.size > MAX_CACHE_ENTRIES) {
    const entries = [...audioCache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      audioCache.delete(key);
    }
  }
}

export function getAudioBuffer(segmentId: string, lineIndex: number): CacheEntry | null {
  const key = cacheKey(segmentId, lineIndex);
  const entry = audioCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    audioCache.delete(key);
    return null;
  }
  return entry;
}

// ─── TTS Generation ──────────────────────────────────────────────────────────

function getElevenLabsKey(): string | null {
  return process.env.ELEVENLABS_API_KEY || null;
}

async function generateSpeech(text: string, speaker: "pbp" | "analyst"): Promise<{ buffer: Buffer; durationMs: number } | null> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) return null;

  const voice = VOICES[speaker];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL,
          voice_settings: {
            stability: voice.stability,
            similarity_boost: voice.similarityBoost,
            style: voice.style,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[tts] ElevenLabs API error: ${res.status}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Estimate duration from MP3 bitrate (64kbps = 8000 bytes/sec)
    const durationMs = Math.round((buffer.length / 8000) * 1000);

    return { buffer, durationMs };
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateSegmentAudio(segment: CommentarySegment): Promise<CommentarySegment> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) {
    // No TTS available — return segment without audio (text-only fallback)
    return segment;
  }

  // Generate all lines in parallel
  const results = await Promise.all(
    segment.lines.map(async (line, index) => {
      const speech = await generateSpeech(line.text, line.speaker);
      if (!speech) return null;

      // Cache the audio buffer
      const key = cacheKey(segment.id, index);
      audioCache.set(key, {
        buffer: speech.buffer,
        durationMs: speech.durationMs,
        createdAt: Date.now(),
      });

      return {
        url: `/api/commentary-audio/${segment.id}/${index}`,
        durationMs: speech.durationMs,
        buffer: speech.buffer,
      } as AudioAttachment;
    })
  );

  pruneCache();

  return {
    ...segment,
    audio: results.map(r => r || { url: "", durationMs: 0, buffer: Buffer.alloc(0) }),
  };
}
