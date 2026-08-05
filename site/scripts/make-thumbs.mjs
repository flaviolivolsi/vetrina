// Build the site's copies of the pages, so the repo holds exactly one of each.
//
// gallery/ and evidence/ are the only sources of truth. Everything this script
// writes under public/ is generated and gitignored, because three copies of the
// same page in version control is three things a reader has to tell apart, and
// two of them are always the wrong one to edit.
//
// Three outputs, for three different jobs:
//
//   public/gallery/        the pages with kit.css inlined. A static host has no
//                          daemon to inline it at serve time.
//   public/thumb-gallery/  the same, pinned to the dark theme. An iframe does
//                          not inherit the embedder's colour scheme in any
//                          engine worth relying on, so a light-mode page would
//                          punch a white hole in a dark layout. The kit ships a
//                          data-theme override, which beats rewriting anyone's
//                          media queries.
//   public/demos/          the evidence pages, byte for byte. They are cited
//                          from the README and the scorecard, and are
//                          deliberately never restyled: editing them to look
//                          nicer would stop them being evidence.
//
// Runs automatically before a build. Manually: node scripts/make-thumbs.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const pub = join(here, '..', 'public');

const kit = readFileSync(join(root, 'cli', 'kit.css'), 'utf8');
const KIT_LINK = /<link\b[^>]*href=["']\/_vetrina\/kit\.css["'][^>]*>/i;

const inlineKit = (html) =>
  KIT_LINK.test(html) ? html.replace(KIT_LINK, `<style>\n${kit}\n</style>`) : html;

const pinDark = (html) => `<!doctype html><html data-theme="dark">\n${html}`;

function build(srcDir, outDir, transform) {
  const src = join(root, srcDir);
  const out = join(pub, outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let n = 0;
  for (const f of readdirSync(src).filter((f) => f.endsWith('.html')).sort()) {
    const result = transform(readFileSync(join(src, f), 'utf8'), f);
    if (result === null) continue;
    writeFileSync(join(out, f), result);
    n += 1;
  }
  return n;
}

const gallery = build('gallery', 'gallery', inlineKit);

// The index is a directory listing, not a page worth previewing.
const thumbs = build('gallery', 'thumb-gallery', (html, f) =>
  f === 'index.html' ? null : pinDark(inlineKit(html)),
);

const demos = build('evidence', 'demos', (html) => html);

// The original prototype predates the evidence set and lives outside it.
writeFileSync(
  join(pub, 'demos', '00-build-console.html'),
  readFileSync(join(root, 'examples', 'build-console.html'), 'utf8'),
);

console.log(`  generated: gallery ${gallery}, thumbs ${thumbs}, demos ${demos + 1}`);
