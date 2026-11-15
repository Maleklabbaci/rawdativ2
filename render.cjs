/* Rendu des 10 posts direction-v2 + mesures de débordement. */
const chromiumBin = require('@sparticuz/chromium').default;
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'campagne-instagram/direction-v2');

(async () => {
  const files = fs.readdirSync(dir).filter(f => /^\d\d-.*\.html$/.test(f)).sort();
  const exe = await chromiumBin.executablePath();
  const b = await chromium.launch({ executablePath: exe, args: [...chromiumBin.args, '--font-render-hinting=none'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const f of files) {
    await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(120);
    await p.screenshot({ path: path.join(dir, f.replace('.html', '.png')) });
    const m = await p.evaluate(() => {
      const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
      const over = [...document.querySelectorAll('.post *')]
        .filter(e => { const cs = getComputedStyle(e); if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') return false;
          return e.scrollHeight - Math.round(e.getBoundingClientRect().height) > 3; })
        .map(e => (e.className || e.tagName) + '+' + (e.scrollHeight - Math.round(e.getBoundingClientRect().height)));
      const col = document.querySelector('.rc') || document.querySelector('.col');
      const below = col ? Math.round(col.getBoundingClientRect().bottom) : null;
      return { frame: q('.mock .frame'), col: q('.rc') || q('.col'), colBottom: below, over: over.slice(0, 5) };
    });
    console.log(f, JSON.stringify(m));
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
