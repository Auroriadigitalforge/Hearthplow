import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8099/';
const OUT = 'itch-art';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1920,1080', '--enable-unsafe-swiftshader', '--use-gl=angle', '--disable-gpu-sandbox', '--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

// Wait for the Three.js canvas to exist and render
await page.waitForSelector('canvas', { timeout: 30000 });
await sleep(8000); // let the twilight world build and animate

// 1) Title screen shot (scene + UI)
await page.screenshot({ path: `${OUT}/shot-title.png` });

// 2) Start the shift, then hide all UI overlays for a clean gameplay scene
const started = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const start = btns.find((b) => b.textContent.includes('Start Shift'));
  if (start) { start.click(); return true; }
  return false;
});
console.log('Start Shift clicked:', started);
await sleep(6000);

// Hide every fixed-position UI overlay (title screen, HUD) so only the 3D canvas shows
await page.evaluate(() => {
  document.querySelectorAll('[class*="fixed"]').forEach((el) => { el.style.display = 'none'; });
});
await sleep(2000);
await page.screenshot({ path: `${OUT}/shot-gameplay-iso.png` });

// 3) Cycle camera (C) for a second angle
await page.keyboard.press('KeyC');
await sleep(2500);
await page.screenshot({ path: `${OUT}/shot-gameplay-chase.png` });
await page.keyboard.press('KeyC');
await sleep(2500);
await page.screenshot({ path: `${OUT}/shot-gameplay-cab.png` });

// 4) Drive forward a bit so the truck is mid-street plowing with spray
await page.keyboard.down('KeyW');
await sleep(4000);
await page.keyboard.up('KeyW');
await sleep(1500);
await page.screenshot({ path: `${OUT}/shot-gameplay-driving.png` });

// 5) Cover: gameplay scene cropped, with title lockup composited by the browser
await page.evaluate(() => {
  const wrap = document.createElement('div');
  wrap.id = 'cover-overlay';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:space-between;padding:0;pointer-events:none;font-family:Outfit,Segoe UI,sans-serif;';
  const bottom = document.createElement('div');
  bottom.style.cssText = 'background:linear-gradient(to top, rgba(8,12,20,0.92) 0%, rgba(8,12,20,0.55) 55%, rgba(8,12,20,0) 100%);padding:70px 70px 55px;';
  bottom.innerHTML = `
    <div style="font-size:108px;font-weight:800;letter-spacing:-3px;color:#F8FAFC;text-shadow:0 6px 30px rgba(0,0,0,0.8);line-height:1;">Hearthplow</div>
    <div style="font-size:34px;font-weight:600;color:#FDE68A;margin-top:14px;letter-spacing:6px;text-transform:uppercase;text-shadow:0 3px 14px rgba(0,0,0,0.85);">Cozy 3D Snow-Plowing</div>
    <div style="font-size:24px;font-weight:500;color:#CBD5E1;margin-top:18px;">Clear the lanes · Dodge the villagers · Upgrade your rig</div>`;
  wrap.appendChild(bottom);
  document.body.appendChild(wrap);
});
await sleep(800);
await page.screenshot({ path: `${OUT}/cover-raw-1920x1080.png` });

// 6) Cover at itch.io's 630x500: crop the center band of the 1920x1080 scene
await page.setViewport({ width: 630, height: 500, deviceScaleFactor: 2 });
await sleep(3000);
await page.screenshot({ path: `${OUT}/cover-630x500.png` });

console.log('done');
await browser.close();
