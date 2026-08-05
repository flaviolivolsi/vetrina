#!/usr/bin/env node
/**
 * Vetrina: one window onto what every agent is doing.
 *
 * Serves a directory of agent-written HTML over the tailnet, generates an
 * index of it newest-first, and live-reloads any open tab when a page
 * changes. That is the whole product surface.
 *
 * The root persists deliberately (default ~/vetrina). Individual pages are
 * disposable; the window is not. Any agent, in any tool, in any session,
 * publishes by writing a file. There is no SDK and there is nothing to
 * integrate.
 *
 *   npx vetrina-cli [--root DIR] [--port N] [--bind ADDR]
 *
 * Convention: a page is `<root>/<space>/<name>.html`, where <space> is
 * whoever wrote it (project, agent, session). Flat files at the root work
 * too and land in a space called "loose".
 *
 * Plain Node, no dependencies, so the first run needs nothing installed.
 */

import { createServer } from 'node:http';
import { watch, createReadStream } from 'node:fs';
import { readdir, stat, readFile, mkdir, realpath, open } from 'node:fs/promises';
import { join, extname, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, networkInterfaces } from 'node:os';
import { render as renderQR } from './qr.mjs';

// ── Args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  vetrina: a window your agents publish into

    npx vetrina-cli [options]

    --root DIR    where pages live        (default ~/vetrina)
    --port N      port to serve on        (default 7777)
    --bind ADDR   address to bind         (default tailnet, else loopback)
    --no-qr       do not print the QR code

  Publish by writing an HTML file into <root>/<space>/<name>.html.
  That is the entire API.

  Tailscale is optional. With a tailnet, vetrina binds it and your phone can
  read the window from anywhere. Without one it binds loopback, and you can
  pass --bind <your LAN IP> to reach it from another device on your network.
  It never binds 0.0.0.0.
`);
  process.exit(0);
}

/**
 * Pick a safe default bind address.
 *
 * NEVER 0.0.0.0. This was learned the hard way: the first run bound every
 * interface on a machine that turned out to have a public IP on eth0, which
 * put an unauthenticated window straight onto the internet. There is no
 * application-level auth here, so the bind address IS the security model.
 *
 * Order: the Tailscale address if the host is on a tailnet (100.64.0.0/10,
 * the CGNAT range Tailscale uses), otherwise loopback. Anything else has to
 * be asked for explicitly, and a public bind is refused outright.
 */
function tailscaleAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const [a, b] = n.address.split('.').map(Number);
      if (a === 100 && b >= 64 && b <= 127) return n.address;
    }
  }
  return null;
}

/** A private LAN address, if there is one, to suggest when there is no tailnet. */
function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const [a, b] = n.address.split('.').map(Number);
      if (a === 10) return n.address;
      if (a === 192 && b === 168) return n.address;
      if (a === 172 && b >= 16 && b <= 31) return n.address;
    }
  }
  return null;
}

function isPublic(addr) {
  if (addr === '0.0.0.0' || addr === '::') return true;
  // IPv6 and hostname loopback were being refused as public.
  if (addr === '::1' || addr === '[::1]' || addr === 'localhost') return false;
  const [a, b] = addr.split('.').map(Number);
  if (!Number.isFinite(a)) return true; // unknown form: refuse rather than guess
  if (a === 127 || a === 10) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

const ROOT = resolve(argOf('--root', join(homedir(), 'vetrina')));
const BIND = argOf('--bind', tailscaleAddress() ?? '127.0.0.1');

// Validate rather than hand a bad value to Node and print its stack trace at
// someone. Every error here says what to do next, which is the whole
// onboarding promise applied to the unhappy path.
const rawPort = argOf('--port', '7777');
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`\n  --port wants a whole number from 1 to 65535, not "${rawPort}".\n`);
  process.exit(1);
}

// An IPv6 literal has to be bracketed to be a URL at all, and this string ends
// up in the QR code as well as on screen. `http://::1:7777` is not a link.
const hostForUrl = (addr) => (addr.includes(':') && !addr.startsWith('[') ? `[${addr}]` : addr);

if (isPublic(BIND)) {
  console.error(
    `\n  refusing to bind ${BIND}.\n\n` +
      `  vetrina has no authentication, so the bind address is the whole\n` +
      `  security model. Use a tailnet or LAN address, or 127.0.0.1.\n`,
  );
  process.exit(1);
}

await mkdir(ROOT, { recursive: true });

// The root itself may sit behind a symlink; compare like with like.
const REAL_ROOT = await realpath(ROOT);

// ── The kit ─────────────────────────────────────────────────────────
// A page links it with one line; the daemon inlines it at serve time so the
// page is still self-contained if it is saved, mailed or promoted into a repo.
// The link stays valid either way, so a page read straight off disk is only
// unstyled, never broken.
const KIT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'kit.css');
const KIT_HREF = '/_vetrina/kit.css';
const KIT = await readFile(KIT_PATH, 'utf8').catch(() => null);

const KIT_LINK_RE =
  /<link\b[^>]*href=["']\/_vetrina\/kit\.css["'][^>]*>/gi;

/**
 * Serve-time rewriting is string surgery on someone else's HTML, and the two
 * things we look for are both legal *text* inside a script:
 *
 *   <script>const t = "</body>";</script>
 *   <script>const e = '<link rel=stylesheet href="/_vetrina/kit.css">';</script>
 *
 * Matching those corrupted valid pages: the reload snippet landed inside a
 * string literal, and the whole kit was substituted into a script body. Neither
 * is a security hole, but a daemon that breaks pages it is only supposed to be
 * serving is worse than one that does nothing.
 *
 * This is not a parser and does not pretend to be. It only asks whether an
 * offset sits between an opening and a closing script tag, which is enough for
 * the case that actually occurs.
 */
function insideScript(html, index) {
  const before = html.slice(0, index).toLowerCase();
  return before.lastIndexOf('<script') > before.lastIndexOf('</script');
}

/** Last occurrence of a needle that is not inside a script block. */
function lastIndexOutsideScript(html, needle) {
  let i = html.lastIndexOf(needle);
  while (i >= 0 && insideScript(html, i)) i = html.lastIndexOf(needle, i - 1);
  return i;
}

// ── Page discovery ──────────────────────────────────────────────────
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

/**
 * Find every page under the root.
 *
 * Three things here are load-bearing, and all three were bugs first.
 *
 * Every entry is resolved and contained, exactly as a request is. A symlink
 * pointing out of the root used to be refused on fetch but still listed, so
 * the index published the <title> of a file the daemon would not serve.
 *
 * Only regular files are read. A FIFO named `page.html` used to hang the index
 * request forever, because readFile on a pipe waits for a writer that never
 * comes.
 *
 * Nothing here is allowed to throw. This walk runs inside a request, and a
 * single dangling symlink in the root used to reject a stat and take the whole
 * daemon down with it. A broken file should cost you that file, not the window.
 */
async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    try {
      const real = await realpath(full);
      if (real !== REAL_ROOT && !real.startsWith(REAL_ROOT + sep)) continue;
      const st = await stat(real);
      if (st.isDirectory()) await walk(full, acc);
      else if (st.isFile() && extname(e.name).toLowerCase() === '.html') {
        acc.push({ full, real, st });
      }
    } catch {
      // Dangling symlink, permissions, or a file deleted mid-walk. Skip it.
    }
  }
  return acc;
}

/** Read at most the first 4 KB, so a huge page costs a page-sized read. */
async function readHead(path, bytes = 4096) {
  let fh;
  try {
    fh = await open(path, 'r');
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } catch {
    return '';
  } finally {
    await fh?.close().catch(() => {});
  }
}

async function listPages() {
  const files = await walk(ROOT);
  const pages = await Promise.all(
    files.map(async ({ full, real, st }) => {
      const rel = relative(ROOT, full);
      let title = rel.replace(/\.html$/i, '');
      const m = TITLE_RE.exec(await readHead(real));
      if (m?.[1]) title = m[1].trim().replace(/\s+/g, ' ');
      const dir = dirname(rel);
      return {
        href: '/' + rel.split(/[\\/]/).map(encodeURIComponent).join('/'),
        space: dir === '.' ? 'loose' : dir.split(/[\\/]/)[0],
        title,
        mtimeMs: st.mtimeMs,
        bytes: st.size,
      };
    }),
  );
  // Newest first: the thing an agent wrote a minute ago is the thing you want.
  return pages.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// ── Live reload ─────────────────────────────────────────────────────
const clients = new Set();
let reloadTimer = null;

watch(ROOT, { recursive: true }, () => {
  // fs.watch is chatty; one nudge per burst is plenty.
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const send of clients) send('reload');
  }, 120);
});

/** Injected into every served page. Reconnects on its own, because the
 *  server restarting is the normal case, not an error. */
const RELOAD_SNIPPET = `
<script>
(() => {
  let es;
  const connect = () => {
    es = new EventSource('/__vetrina/reload');
    es.onmessage = () => location.reload();
    es.onerror = () => { es.close(); setTimeout(connect, 1500); };
  };
  connect();
})();
</script>`;

// ── The index ───────────────────────────────────────────────────────
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function renderIndex(pages) {
  const spaces = [...new Set(pages.map((p) => p.space))];
  const rows = pages
    .map(
      (p) => `<li class="row" data-space="${esc(p.space)}">
  <a href="${p.href}">
    <span class="t">${esc(p.title)}</span>
    <span class="meta"><span class="sp">${esc(p.space)}</span><span class="when">${ago(p.mtimeMs)}</span></span>
  </a>
</li>`,
    )
    .join('\n');

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vetrina</title>
<style>
:root{--ground:#0a0c10;--surface:#101319;--border:#2a3140;--sub:#1d232d;--fg:#eceff4;--muted:#98a2b3;--faint:#67707f;--accent:#ffb03a;
--mono:ui-monospace,"SF Mono","DM Mono",Menlo,monospace}
@media(prefers-color-scheme:light){:root{--ground:#f6f7f9;--surface:#eceff4;--border:#c3cad6;--sub:#dde2ea;--fg:#0f1319;--muted:#4d5768;--faint:#6b7482;--accent:#b06f00}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--fg);font-family:var(--mono);font-size:14px;line-height:1.5}
.wrap{max-width:860px;margin-inline:auto;padding:clamp(1.5rem,5vw,3rem) 1.25rem 4rem}
h1{font-size:clamp(1.5rem,4vw,2.1rem);font-weight:500;margin:.4rem 0 .5rem;letter-spacing:-.03em}
.kicker{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0;display:flex;gap:.6rem;align-items:center}
.dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.lede{font-size:13px;color:var(--muted);max-width:60ch;margin:0 0 1.75rem}
.chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:1rem 0;border-top:1px solid var(--border)}
button{font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;background:var(--surface);color:var(--muted);
border:1px solid var(--sub);padding:.45rem .7rem;min-height:36px;cursor:pointer}
button[aria-pressed=true]{color:var(--fg);border-color:var(--border)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
ul{list-style:none;margin:0;padding:0;border-top:1px solid var(--sub)}
.row{border-bottom:1px solid var(--sub)}
.row[hidden]{display:none}
.row a{display:flex;flex-wrap:wrap;gap:.35rem 1rem;align-items:baseline;justify-content:space-between;
padding:.95rem .15rem;text-decoration:none;color:inherit;min-height:44px}
.row a:hover .t{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:5px}
.row a:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.t{font-size:14.5px;color:var(--fg)}
.meta{display:flex;gap:1rem;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-variant-numeric:tabular-nums}
.sp{color:var(--muted)}
.empty{color:var(--faint);padding:2rem 0;font-size:13px}
footer{margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--sub);color:var(--faint);font-size:11.5px;line-height:1.7}
code{color:var(--fg)}
</style></head><body>
<div class="wrap">
  <p class="kicker"><span class="dot"></span><span>Vetrina</span><span>/</span><span>${pages.length} page${pages.length === 1 ? '' : 's'}</span></p>
  <h1>What the agents are showing you.</h1>
  <p class="lede">Newest first. Any agent publishes by writing an HTML file into the root. Pages reload themselves when they change.</p>
  <div class="chips" role="group" aria-label="Filter by space">
    <button data-f="all" aria-pressed="true">All</button>
    ${spaces.map((s) => `<button data-f="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join('')}
  </div>
  ${pages.length ? `<ul>${rows}</ul>` : `<p class="empty">Nothing published yet. Write an HTML file into <code>${esc(ROOT)}</code>.</p>`}
  <footer>Root <code>${esc(ROOT)}</code>. These pages describe your work, so treat them like it. No authentication: the bind address is the whole access control.</footer>
</div>
<script>
const rows=[...document.querySelectorAll('.row')],btns=[...document.querySelectorAll('[data-f]')];
btns.forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.f;
rows.forEach(r=>{r.hidden=f!=='all'&&r.dataset.space!==f});
btns.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.f===f)))}));
</script>
${RELOAD_SNIPPET}
</body></html>`;
}

// ── Static types ────────────────────────────────────────────────────
// Bun.file guessed these for us; plain Node does not.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// ── Server ──────────────────────────────────────────────────────────

/**
 * The handler is async, so anything it throws becomes an unhandled rejection
 * and Node exits. That is how a single dangling symlink in the root used to
 * kill the window for everybody: one rejected stat inside the index walk and
 * the process was gone until someone noticed and restarted it.
 *
 * A page that cannot be read should cost you that page. Nothing a file can do
 * should be able to close the window.
 */
const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(`  request failed: ${req.method} ${req.url}\n  ${err?.stack ?? err}`);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('something broke on this page, but the window is still up');
  });
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/__vetrina/reload') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': open\n\n');
    const push = (d) => {
      try {
        res.write(`data: ${d}\n\n`);
      } catch {
        /* client gone */
      }
    };
    clients.add(push);
    req.on('close', () => clients.delete(push));
    return;
  }

  if (url.pathname === KIT_HREF) {
    if (!KIT) {
      res.writeHead(404).end('no kit');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES['.css'], 'cache-control': 'no-store' });
    res.end(KIT);
    return;
  }

  if (url.pathname === '/') {
    const body = renderIndex(await listPages());
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }

  // Everything else is a file under the root. decodeURIComponent then
  // resolve, and refuse anything that escapes: a page path is never
  // allowed to reach outside the window.
  //
  // The separator in the prefix check is load-bearing. Comparing against
  // ROOT alone lets `/../vetrina-notes/secret.html` through, because
  // /home/me/vetrina-notes does start with /home/me/vetrina.
  let relPath;
  try {
    relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    res.writeHead(400).end('bad path');
    return;
  }
  const full = resolve(ROOT, relPath);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) {
    res.writeHead(403).end('nope');
    return;
  }

  // resolve() is string maths and does not follow symlinks; stat() and
  // createReadStream() do. Without this second check, a link inside the root
  // (`ln -s /etc ~/vetrina/etclink`) serves any file on the machine to anyone
  // on the tailnet. Re-check containment against the real path.
  let real;
  try {
    real = await realpath(full);
  } catch {
    res.writeHead(404).end('not here');
    return;
  }
  if (real !== REAL_ROOT && !real.startsWith(REAL_ROOT + sep)) {
    res.writeHead(403).end('nope');
    return;
  }

  let st;
  try {
    st = await stat(real);
  } catch {
    res.writeHead(404).end('not here');
    return;
  }
  if (!st.isFile()) {
    res.writeHead(404).end('not here');
    return;
  }

  const ext = extname(real).toLowerCase();

  if (ext === '.html') {
    let html;
    try {
      html = await readFile(real, 'utf8');
    } catch {
      res.writeHead(403).end('cannot read that');
      return;
    }

    // Swap the kit link for the kit itself. Replacing rather than appending
    // keeps the cascade order the author wrote, so a page's own <style> block
    // still overrides the kit exactly as it does in the browser.
    if (KIT) {
      KIT_LINK_RE.lastIndex = 0;
      let first = true;
      html = html.replace(KIT_LINK_RE, (match, offset, whole) => {
        if (insideScript(whole, offset)) return match; // a string, not a tag
        if (!first) return ''; // linked twice: inline once, drop the rest
        first = false;
        return `<style data-vetrina-kit>\n${KIT}\n</style>`;
      });
      KIT_LINK_RE.lastIndex = 0;
    }

    const at = lastIndexOutsideScript(html, '</body>');
    const injected =
      at >= 0 ? html.slice(0, at) + RELOAD_SNIPPET + html.slice(at) : html + RELOAD_SNIPPET;
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
    res.end(injected);
    return;
  }

  // Wait for the file to actually open before committing to a 200. Writing the
  // headers first means an unreadable file can only be reported by hanging up,
  // which looks like a broken server rather than a broken file.
  const stream = createReadStream(real);
  stream.once('open', () => {
    res.writeHead(200, {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    stream.pipe(res);
  });
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(403).end('cannot read that');
    else res.destroy(); // mid-flight: nothing left to say
  });
  res.on('close', () => stream.destroy());
}

// The zero-config rule: if the port is taken, take the next free one and say
// so, rather than making the human pick. Capped at 65535, because asking for
// port 65536 throws.
let port = PORT;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < Math.min(PORT + 20, 65535)) {
    port += 1;
    server.listen(port, BIND);
    return;
  }
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ports ${PORT} to ${port} are all busy. Try --port with a free one.\n`);
    process.exit(1);
  }
  if (err.code === 'EADDRNOTAVAIL') {
    console.error(`\n  ${BIND} is not an address on this machine. Try --bind 127.0.0.1.\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, BIND, () => {
  port = server.address()?.port ?? port;
  const url = `http://${hostForUrl(BIND)}:${port}`;
  const onLoopback = BIND === '127.0.0.1' || BIND === '::1' || BIND === 'localhost';

  console.log(`\n  vetrina  ·  root ${ROOT}\n`);

  // The reading device is a phone, so the URL has to be scannable. Skipped on
  // loopback, where a QR of 127.0.0.1 would send a phone to its own machine,
  // and when stdout is not a terminal, where escape codes are just noise.
  if (process.stdout.isTTY && !onLoopback && !args.includes('--no-qr')) {
    try {
      console.log(renderQR(url));
      console.log('');
    } catch {
      /* URL too long to encode; the printed URL below is the fallback */
    }
  }

  console.log(`  ${url}${port === PORT ? '' : `   (${PORT} was taken)`}`);
  console.log(`\n  Publish by writing an HTML file into the root.`);

  if (onLoopback) {
    // Tailscale is not required and never was, but falling back to loopback
    // silently leaves people thinking the phone half is broken. Say what it
    // would take, and say what it costs.
    console.log(`  This machine only. To read it on your phone, either:`);
    console.log(`    · join both to a tailnet (tailscale.com), then restart this, or`);
    const lan = lanAddress();
    console.log(
      `    · serve it to your local network with --bind ${lan ?? '<your LAN IP>'}`,
    );
    console.log(`      which any device on that network can then read. Not on shared wifi.\n`);
  } else {
    console.log(`  No auth. Bound to ${BIND} only, which is the security model.\n`);
  }
});
