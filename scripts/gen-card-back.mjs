#!/usr/bin/env node
import sharp from 'sharp';
import { writeFile } from 'fs/promises';

const API_KEY = process.env.GOOGLE_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;

const prompt = `Generate an image of the BACK of a playing card (what you see when the card is face-down).
Portrait orientation (width:height ratio exactly 5:7). Pure black background behind the card. Flat top-down view.
The card back design:
- Deep navy blue to rich purple gradient as the base color.
- An intricate, perfectly SYMMETRICAL geometric pattern covering the entire card surface.
- The pattern should be Art Deco inspired with gold/amber colored lines forming diamonds, chevrons, and interlocking shapes.
- In the exact center: a gold lion head emblem inside an ornate circular frame.
- Fine gold border running around all four edges of the card.
- Corner flourishes in each of the four corners.
- The entire design MUST be perfectly symmetrical both vertically AND horizontally.
- Premium luxury casino quality. Rich, dark, elegant.
- Clean crisp edges, high contrast gold pattern on dark background.`;

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }),
});

const data = await res.json();
const parts = data.candidates?.[0]?.content?.parts || [];
const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
if (!imagePart) {
  console.error('No image in response');
  process.exit(1);
}
const buf = Buffer.from(imagePart.inlineData.data, 'base64');
const webp = await sharp(buf).resize(200, 280, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
await writeFile('client/public/cards/card_back.webp', webp);
console.log(`OK card_back.webp (${(webp.length / 1024).toFixed(1)} KB)`);
