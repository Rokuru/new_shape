// Génère les icônes PNG de la PWA à partir du logo SVG (public/icon.svg).
// Usage : node scripts/icons.cjs  (nécessite Playwright / Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
// Variante pleine page (sans coins arrondis) : iOS et les icônes « maskable » appliquent leur propre masque.
const fullBleed = (scale) =>
  svg.replace('rx="14"', 'rx="0"').replace('translate(6.4 6.4) scale(.8)', `translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})`);

const OUT = [
  { file: 'icon-192.png', size: 192, svg },
  { file: 'icon-512.png', size: 512, svg },
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed(0.68) },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(0.74) },
  { file: 'favicon-32.png', size: 32, svg },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const o of OUT) {
    await page.setViewportSize({ width: o.size, height: o.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${o.svg.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(__dirname, '../public', o.file), omitBackground: true });
    console.log('public/' + o.file);
  }
  await browser.close();
})();
