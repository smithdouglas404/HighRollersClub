import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();

// Full HD viewport
await page.setViewport({ width: 1920, height: 1080 });

// Navigate to the game page - try to create a solo game
await page.goto('http://localhost:5000', { waitUntil: 'networkidle2', timeout: 15000 });
await page.screenshot({ path: '/home/runner/workspace/review-screenshots/01-landing.png', fullPage: false });
console.log('1. Landing page captured');

// Try to start a game
try {
  // Look for a "Play" or "Quick Play" or "Solo" button
  await page.waitForSelector('button', { timeout: 5000 });
  const buttons = await page.$$eval('button', els => els.map(e => ({ text: e.textContent?.trim(), id: e.id, class: e.className })));
  console.log('Buttons found:', JSON.stringify(buttons.slice(0, 10)));

  // Click the first game-starting button we find
  for (const btnText of ['Play Now', 'Quick Play', 'Solo', 'Play', 'Start', 'Create']) {
    const btn = await page.$(`button:has-text("${btnText}")`).catch(() => null);
    if (!btn) {
      // Try xpath
      const [xbtn] = await page.$x(`//button[contains(text(), "${btnText}")]`).catch(() => []);
      if (xbtn) {
        await xbtn.click();
        console.log(`Clicked: ${btnText}`);
        await page.waitForTimeout(2000);
        break;
      }
    }
  }

  // Try clicking any link/button that has "play" or "game" in it
  const links = await page.$$('a, button');
  for (const link of links) {
    const text = await link.evaluate(el => el.textContent?.toLowerCase() || '');
    if (text.includes('play') || text.includes('solo') || text.includes('start') || text.includes('create')) {
      await link.click();
      console.log(`Clicked link: ${text.trim()}`);
      await page.waitForTimeout(3000);
      break;
    }
  }
} catch(e) {
  console.log('Navigation attempt:', e.message);
}

await page.screenshot({ path: '/home/runner/workspace/review-screenshots/02-after-click.png', fullPage: false });
console.log('2. After first click captured');

// Wait and see what loaded
await page.waitForTimeout(2000);
await page.screenshot({ path: '/home/runner/workspace/review-screenshots/03-game-state.png', fullPage: false });
console.log('3. Game state captured');

// Try navigating directly to a game URL
await page.goto('http://localhost:5000/game/solo', { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: '/home/runner/workspace/review-screenshots/04-solo-game.png', fullPage: false });
console.log('4. Solo game captured');

// Try other common game routes
for (const route of ['/game', '/play', '/table']) {
  try {
    await page.goto(`http://localhost:5000${route}`, { waitUntil: 'networkidle2', timeout: 8000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/home/runner/workspace/review-screenshots/05-route-${route.replace('/', '')}.png`, fullPage: false });
    console.log(`5. Route ${route} captured`);
  } catch(e) {
    console.log(`Route ${route} failed: ${e.message}`);
  }
}

// Take different viewport sizes if we found the game
const currentUrl = page.url();
if (currentUrl.includes('game') || currentUrl.includes('play') || currentUrl.includes('table')) {
  // Standard laptop
  await page.setViewport({ width: 1366, height: 768 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/runner/workspace/review-screenshots/06-laptop-1366.png', fullPage: false });
  console.log('6. Laptop viewport captured');

  // Ultrawide
  await page.setViewport({ width: 2560, height: 1080 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/runner/workspace/review-screenshots/07-ultrawide.png', fullPage: false });
  console.log('7. Ultrawide viewport captured');

  // Smaller
  await page.setViewport({ width: 1024, height: 768 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/runner/workspace/review-screenshots/08-small-1024.png', fullPage: false });
  console.log('8. Small viewport captured');
}

await browser.close();
console.log('Done! Screenshots saved to review-screenshots/');
