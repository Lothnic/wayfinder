// Capture frames with Playwright. Usage: node capture.js [fps] [total]
// Renders every 1/fps tick via page.evaluate(window.RENDER(t)).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FPS = Number(process.argv[2] || 30);
const TOTAL = Number(process.argv[3] || 20);
const OUT = path.join(__dirname, 'frames');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = process.env.RENDER_URL || ('http://127.0.0.1:8899/index.html');
  await page.goto(url, { waitUntil: 'networkidle' });
  // ensure fonts (Press Start 2P/VT323/Nunito) are loaded before capture
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction('window.READY === true');
  fs.writeFileSync(path.join(__dirname, 'fonts-used.txt'), 'ok');

  const frames = FPS * TOTAL;
  for (let i = 0; i < frames; i++) {
    const t = i / FPS + 1 / (FPS * 2); // sample at frame centers
    await page.evaluate(tt => window.RENDER(tt), Math.min(t, TOTAL - 1 / (FPS * 2)));
    await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }
  // Also save the settled poster frame candidate once more at a settled index
  console.log('captured', frames, 'frames to', OUT);
  await browser.close();
})();
