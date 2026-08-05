// Convert the video poster frames from PNG to JPEG.
//
// Remotion emits stills as PNG, which is right for judging a render and wrong
// for shipping: each 1920×1080 frame lands around 1.3 MB, and the `poster`
// attribute means every one of them downloads on page load. Five posters is
// ~6 MB before a single frame of video plays. JPEG at q82 takes that to well
// under 200 KB each with no visible difference on a dark, flat image.
//
//   node scripts/posters.mjs
//
// Uses the ffmpeg that ships with Remotion so there is no system dependency.

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = new URL('../public/', import.meta.url).pathname;
// remotion is a dependency of ../video, not of the site, so ffmpeg is
// invoked with that project as cwd.
const VIDEO = new URL('../../video/', import.meta.url).pathname;
const FFMPEG = ['remotion', 'ffmpeg'];

const pngs = readdirSync(PUBLIC).filter(
  (f) => f.endsWith('.png') && (f.startsWith('frame0-') || f === 'poster.png'),
);

let before = 0;
let after = 0;

for (const f of pngs) {
  const src = join(PUBLIC, f);
  const out = src.replace(/\.png$/, '.jpg');
  before += statSync(src).size;

  execFileSync('npx', [...FFMPEG, '-loglevel', 'error', '-y', '-i', src, '-q:v', '3', out], {
    stdio: 'inherit',
    cwd: VIDEO,
  });

  after += statSync(out).size;
  unlinkSync(src);
  console.log(`${f} → ${f.replace(/\.png$/, '.jpg')}`);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\n${pngs.length} posters: ${mb(before)} → ${mb(after)}`);
