// Build the README hero image from the gallery pages themselves.
//
// The point of the picture is that these are real pages, so it is composed from
// live renders rather than mocked up. When the gallery changes, re-run this and
// the picture stops lying. The previous hero survived two rounds of the gallery
// changing underneath it and still showed pages that were no longer the ones on
// the site.
//
//   node scripts/hero.mjs        ->  assets/vetrina.jpg
//
// Needs playwright, which is not a dependency of this site: it is used by this
// script and by the render checks, both of which are occasional. Install it with
// `npx playwright install chromium` if the import below fails.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('\n  needs playwright:  npm i -D playwright && npx playwright install chromium\n');
  process.exit(1);
}

// Three pages, chosen because they look nothing like each other: a timeline, a
// waterfall and a proportional map. A hero made of three variations on a list
// would argue against the thing it is illustrating.
const PAGES = ['04-incident-timeline.html', '01-eval-waterfall.html', '07-blast-radius.html'];

const kit = readFileSync(join(root, 'cli', 'kit.css'), 'utf8');
const KIT_LINK = /<link\b[^>]*href=["']\/_vetrina\/kit\.css["'][^>]*>/i;

const font = (f) =>
  readFileSync(join(here, '..', 'node_modules', '@fontsource', f)).toString('base64');
const azeret = font('azeret-mono/files/azeret-mono-latin-500-normal.woff2');
const dm = font('dm-mono/files/dm-mono-latin-400-normal.woff2');

const browser = await chromium.launch();

// 1. Render each page tall and dark, as an image to paste into the composition.
const shots = [];
for (const name of PAGES) {
  const html = readFileSync(join(root, 'gallery', name), 'utf8')
    .replace(KIT_LINK, `<style>\n${kit}\n</style>`);
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 1500 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html data-theme="dark">${html}`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  shots.push((await page.screenshot({ type: 'png' })).toString('base64'));
  await ctx.close();
}

// 2. Compose. The cards recede to the right and the nearest one dissolves into
//    the ground on the left, so the text sits on flat colour and the pages read
//    as a window rather than as a screenshot grid.
// Each card is a fixed window onto its page, scrolled to the band where the
// shape actually is. Showing the top of a page shows a headline and a
// paragraph, which is the one part of it that looks like every other page.
const card = (i, { x, y, w, h, rot, scale, offset, dim }) => `
  <div class="card" style="left:${x}px; top:${y}px; width:${w}px; height:${h}px;
       transform: rotate(${rot}deg) scale(${scale}); opacity:${dim};">
    <img style="top:-${offset}px" src="data:image/png;base64,${shots[i]}" />
  </div>`;

const composition = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Azeret; src: url(data:font/woff2;base64,${azeret}) format('woff2'); font-weight: 500; }
  @font-face { font-family: DM; src: url(data:font/woff2;base64,${dm}) format('woff2'); font-weight: 400; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 2400px; height: 1260px; background: #0a0c10; overflow: hidden; position: relative;
         font-family: Azeret, monospace; }
  .stage { position: absolute; inset: 0; }
  .card { position: absolute; overflow: hidden; border: 1px solid #232936; border-radius: 3px;
          box-shadow: 0 40px 130px rgba(0,0,0,.7); background: #0a0c10;
          transform-origin: top left; }
  .card img { position: absolute; left: 0; width: 1180px; display: block; }
  /* A scrim rather than a gradient on each card: one soft edge reads as depth,
     three read as a filter. */
  .scrim { position: absolute; inset: 0;
           background: linear-gradient(100deg, #0a0c10 41%, rgba(10,12,16,.9) 49%, rgba(10,12,16,0) 66%); }
  .copy { position: absolute; left: 140px; top: 236px; width: 940px; }
  .kick { font-family: DM, monospace; font-size: 22px; letter-spacing: .26em; color: #7e8695;
          display: flex; align-items: center; gap: 18px; }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: #ffb03a; }
  h1 { font-size: 74px; line-height: 1.16; letter-spacing: -.045em; color: #eceff4;
       font-weight: 500; margin-top: 46px; }
  h1 .dim { color: #98a2b3; }
  p { font-family: DM, monospace; font-size: 29px; line-height: 1.6; color: #98a2b3;
      margin-top: 46px; max-width: 40ch; }
  .cmd { margin-top: 54px; display: inline-block; border: 1px solid #2a3140; background: #101319;
         padding: 22px 30px; font-family: DM, monospace; font-size: 27px; color: #eceff4; }
  .cmd span { color: #67707f; margin-right: 14px; }
</style></head><body>
  <div class="stage">
    ${card(2, { x: 1975, y: 30,  w: 1180, h: 2060, rot: 1.8, scale: .60, offset: 700, dim: .5 })}
    ${card(1, { x: 1520, y: 90,  w: 1180, h: 1790, rot: 1.1, scale: .66, offset: 840, dim: .74 })}
    ${card(0, { x: 1020, y: 145, w: 1180, h: 1520, rot: .5,  scale: .74, offset: 300, dim: 1 })}
  </div>
  <div class="scrim"></div>
  <div class="copy">
    <div class="kick"><span class="dot"></span>VETRINA</div>
    <h1>Chat only ever grows.<br /><span class="dim">A page is rewritten in place.</span></h1>
    <p>A window your coding agents publish into. They write an HTML file; you get a page shaped like the task.</p>
    <div class="cmd"><span>$</span>npx vetrina-cli</div>
  </div>
</body></html>`;

// 3. Shoot it twice. The README wants a wide banner; a social card is 1.91:1
//    and gets cropped by every platform slightly differently, so it is the same
//    composition scaled rather than a second layout to keep in sync.
const shoot = async (w, h, out, scale) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.setContent(
    scale === 1 ? composition
      : composition.replace('<body>', `<body style="zoom:${scale}">`),
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await ctx.close();
  return Math.round(readFileSync(out).length / 1024);
};

const heroKb = await shoot(2400, 1260, join(root, 'assets', 'vetrina.jpg'), 1);
const ogKb = await shoot(1200, 630, join(here, '..', 'public', 'og.jpg'), 0.5);
await browser.close();

console.log(`  assets/vetrina.jpg ${heroKb} KB · site/public/og.jpg ${ogKb} KB`);
console.log(`  from ${PAGES.join(', ')}`);
