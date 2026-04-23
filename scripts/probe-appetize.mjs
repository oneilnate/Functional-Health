import { chromium } from '@playwright/test';
const URL = 'https://appetize.io/embed/e725apxb22yowx5ebdidhqpjwu?device=iphone17pro';
// Critical flags for autoplay + WebRTC in headless
const browser = await chromium.launch({
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
  ],
});
const page = await browser.newPage({ viewport: { width: 500, height: 1000 }});
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text().slice(0,300)); });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('Waiting for Tap to Start...');
await page.waitForTimeout(12000);

// Use real mouse coordinates at the center of the Tap to Start area
// From prior probe: x=74-219, y=218-248, so center ~ (147, 233)
console.log('Clicking Tap to Start at (147, 233)...');
await page.mouse.click(147, 233);
await page.waitForTimeout(3000);

// Force video play
await page.evaluate(() => {
  const v = document.querySelector('video');
  if (v) { v.muted = true; v.play().catch(e => console.error('play error', e.message)); }
});

console.log('Waiting 45s for app boot...');
await page.waitForTimeout(45000);

const info = await page.evaluate(() => ({
  body_snippet: document.body.innerText.slice(0, 150),
  video_state: [...document.querySelectorAll('video')].map(v => ({
    paused: v.paused, currentTime: v.currentTime.toFixed(2),
    readyState: v.readyState, videoWidth: v.videoWidth, videoHeight: v.videoHeight,
  })),
}));
console.log('Final state:', JSON.stringify(info, null, 2));
errors.slice(0,3).forEach(e => console.log('  err:', e));
await page.screenshot({ path: '/tmp/appetize-booted.png', fullPage: false });
await browser.close();
