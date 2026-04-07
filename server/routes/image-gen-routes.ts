/**
 * Image Generation Routes — uses Gemini to generate vault background images on demand.
 * POST /api/admin/generate-backgrounds — generates all vault backgrounds (admin only)
 */

import type { Express, RequestHandler } from "express";
import fs from "fs";
import path from "path";

const BACKGROUNDS = [
  { name: "vault-bg-main", prompt: "Ultra premium luxury bank vault interior, golden safe deposit boxes lining walls, dramatic warm lighting, deep shadows, bokeh effect, dark moody atmosphere with gold accents, photorealistic, 4K, no text, no people, cinematic lighting, shallow depth of field" },
  { name: "vault-bg-lobby", prompt: "Luxury VIP poker room entrance, dark marble floors, gold chandelier light reflections, velvet rope, deep shadows, bokeh golden lights, premium casino atmosphere, no text, no people, cinematic, dark with warm gold highlights" },
  { name: "vault-bg-profile", prompt: "Close up of luxury golden safe deposit boxes with dramatic side lighting, dark moody atmosphere, shallow depth of field, bokeh gold reflections, warm amber tones, premium bank vault aesthetic, no text, no people" },
  { name: "vault-bg-club", prompt: "Premium private members club interior, dark leather chairs, gold trimmed bar, warm spotlight lighting, deep shadows, luxury cigar lounge atmosphere, bokeh lights, no text, no people, dark with gold accents" },
  { name: "vault-bg-tournament", prompt: "Grand poker tournament arena, dark atmosphere with dramatic gold spotlights on green felt tables, stadium seating in shadows, premium casino event, bokeh lights, no text, no people, cinematic wide shot" },
  { name: "vault-bg-wallet", prompt: "Stack of gold bars in a dark vault with dramatic lighting, shallow depth of field, bokeh gold reflections on polished surfaces, premium wealth aesthetic, dark moody atmosphere, no text, no people" },
  { name: "vault-bg-shop", prompt: "Luxury jewelry display case with dramatic gold lighting, dark velvet background, premium items under spotlights, bokeh reflections, high-end retail atmosphere, no text, no people, dark with warm gold accents" },
  { name: "vault-bg-analytics", prompt: "Dark premium trading floor with gold-tinted holographic screens, dramatic lighting, deep shadows, modern luxury financial center, bokeh lights, no text, no people, futuristic dark with warm gold accents" },
];

export async function registerImageGenRoutes(app: Express, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  const outputDir = path.join(process.cwd(), "client", "public", "images", "generated");
  fs.mkdirSync(outputDir, { recursive: true });

  app.post("/api/admin/generate-backgrounds", requireAuth, requireAdmin, async (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

    const results: Array<{ name: string; status: string }> = [];

    for (const bg of BACKGROUNDS) {
      const outputPath = path.join(outputDir, `${bg.name}.webp`);
      if (fs.existsSync(outputPath)) {
        results.push({ name: bg.name, status: "exists" });
        continue;
      }

      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: `Generate a high-quality background image: ${bg.prompt}. 1920x1080, landscape, suitable as dark website background.` }] }],
          generationConfig: { responseModalities: ["image", "text"] } as any,
        });

        for (const candidate of result.response.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if ((part as any).inlineData) {
              const buffer = Buffer.from((part as any).inlineData.data, "base64");
              fs.writeFileSync(outputPath, buffer);
              results.push({ name: bg.name, status: "generated" });
              break;
            }
          }
        }
      } catch (err: any) {
        results.push({ name: bg.name, status: `error: ${err.message}` });
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({ results });
  });

  // Get list of available backgrounds
  app.get("/api/backgrounds", (_req, res) => {
    const available = BACKGROUNDS.map(bg => {
      const exists = fs.existsSync(path.join(outputDir, `${bg.name}.webp`));
      return { name: bg.name, url: exists ? `/images/generated/${bg.name}.webp` : null };
    });
    res.json(available);
  });
}
