import https from 'https';
import fs from 'fs';

const API_KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = '/home/runner/workspace/client/public/images/table-options';

function generate(prompt, filename) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'hd', style: 'natural' });
    const options = {
      hostname: 'api.openai.com', path: '/v1/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) { console.error(`${filename} ERROR: ${j.error.message}`); resolve(); return; }
          https.get(j.data[0].url, (r) => {
            const ch = [];
            r.on('data', c => ch.push(c));
            r.on('end', () => {
              fs.writeFileSync(`${OUT_DIR}/${filename}`, Buffer.concat(ch));
              console.log(`DONE: ${filename} (${(Buffer.concat(ch).length/1024/1024).toFixed(2)} MB)`);
              resolve();
            });
          });
        } catch(e) { console.error(`${filename} parse error`); resolve(); }
      });
    });
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

const base = 'Top-down view of a circular poker table on pure black background, completely empty surface with absolutely no cards no chips no squares no markers no slots no objects, ';
const end = ', photorealistic 8K render quality, square 1:1 composition, the table is centered and fills about 70% of the frame';

const prompts = [
  // Classic luxury variations
  { file: 'table-01-classic-green.png', prompt: base + 'dark emerald green velvet felt surface, thick dark mahogany wood rail with padded black leather arm rest, thin gold metal trim between felt and rail, subtle warm overhead lighting' + end },
  { file: 'table-02-deep-emerald.png', prompt: base + 'deep rich emerald green casino speed cloth felt, polished dark walnut wood rail with brass studs and black leather padding, gold pinstripe accent, dramatic pendant light overhead' + end },
  { file: 'table-03-royal-green.png', prompt: base + 'royal green professional baize felt, dark cherry wood rail with tufted black leather cushion and ornate gold filigree trim, warm golden spotlight from above' + end },

  // Cyberpunk/neon variations
  { file: 'table-04-cyber-cyan.png', prompt: base + 'dark green felt surface, sleek black carbon fiber rail with cyan blue LED underglow strip around entire perimeter, brushed titanium trim, futuristic cyberpunk aesthetic, cyan neon reflections on black floor' + end },
  { file: 'table-05-neon-gold.png', prompt: base + 'dark emerald felt surface, black matte rail with glowing gold LED accent strip and cyan underglow, premium futuristic design, atmospheric haze' + end },
  { file: 'table-06-tron-glow.png', prompt: base + 'dark green felt, minimalist black rail with thin bright cyan LED line running along the edge and a gold inner ring, sci-fi Tron aesthetic, black void background with subtle blue reflections' + end },
  { file: 'table-07-neon-ring.png', prompt: base + 'deep green velvet felt, dark brushed steel rail with continuous cyan neon ring embedded in the rail edge casting soft blue glow, gold trim between felt and rail, dark atmosphere' + end },

  // Premium/luxury variations
  { file: 'table-08-gold-luxury.png', prompt: base + 'rich dark green felt, wide ornate gold-plated rail with intricate scrollwork and black leather padding, luxury casino quality, warm overhead chandelier lighting casting golden highlights' + end },
  { file: 'table-09-platinum.png', prompt: base + 'dark emerald green felt surface, platinum silver rail with diamond-pattern black leather cushion and thin gold accent lines, ultra-premium exclusive design, cool dramatic lighting' + end },
  { file: 'table-10-obsidian.png', prompt: base + 'deep dark green almost black felt surface, obsidian black rail with subtle gold edge trim and matte black leather padding, minimal and sleek, soft overhead pool of light on felt center' + end },

  // High contrast / dramatic
  { file: 'table-11-spotlight.png', prompt: base + 'vivid green professional felt with visible fabric texture, dark mahogany rail with brass fittings and leather arm rest, single dramatic overhead spotlight creating stark light pool on felt with deep shadows around edges' + end },
  { file: 'table-12-smoky.png', prompt: base + 'rich green felt, dark wood rail with gold trim and leather cushion, atmospheric smoke and haze drifting across the scene, warm pendant light from above, moody noir atmosphere' + end },
  { file: 'table-13-vignette.png', prompt: base + 'dark green baize felt, elegant dark rail with gold accents, heavy vignette darkening at edges, warm center spotlight, film noir dramatic lighting, cinematic quality' + end },

  // Modern/minimal
  { file: 'table-14-minimal.png', prompt: base + 'clean dark green felt, slim modern black rail with no ornamentation and a single thin gold line accent, minimal contemporary design, even soft overhead lighting' + end },
  { file: 'table-15-matte.png', prompt: base + 'matte dark green felt with subtle texture, brushed dark gunmetal rail with thin rose gold accent strip, modern luxury aesthetic, soft diffused overhead lighting' + end },

  // Exotic
  { file: 'table-16-red-felt.png', prompt: base + 'deep crimson red professional felt surface instead of green, dark mahogany rail with gold trim and black leather cushion, warm dramatic overhead lighting, exclusive high-roller aesthetic' + end },
  { file: 'table-17-blue-felt.png', prompt: base + 'deep midnight blue professional felt surface, dark walnut rail with silver trim and navy leather cushion, cool dramatic lighting with blue tones' + end },
  { file: 'table-18-purple.png', prompt: base + 'deep royal purple velvet felt surface, black rail with gold filigree and plush black leather cushion, regal luxury aesthetic, warm golden overhead light' + end },

  // Ultra premium
  { file: 'table-19-diamond.png', prompt: base + 'dark emerald green felt, wide rail with alternating segments of polished gold and dark leather with diamond-shaped gold studs, ultimate luxury casino quality, multiple warm overhead lights' + end },
  { file: 'table-20-vault.png', prompt: base + 'dark green felt surface, thick rail made of dark brushed metal and carbon fiber with embedded cyan LED strips and gold accent rivets, high-tech vault aesthetic, cyberpunk luxury, atmospheric blue and gold lighting from above' + end },
];

async function main() {
  console.log(`Generating ${prompts.length} table options...`);
  // Run in batches of 3 to avoid rate limits
  for (let i = 0; i < prompts.length; i += 3) {
    const batch = prompts.slice(i, i + 3);
    console.log(`\nBatch ${Math.floor(i/3) + 1}/${Math.ceil(prompts.length/3)}:`);
    await Promise.all(batch.map(p => generate(p.prompt, p.file)));
  }
  console.log('\nAll done! Check: client/public/images/table-options/');
}

main();
