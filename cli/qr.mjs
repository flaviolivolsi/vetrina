/**
 * A QR encoder, because the alternative was a dependency.
 *
 * Vetrina prints a tailnet URL and the device that reads it is a phone. Typing
 * `http://100.87.186.80:7777` by hand is exactly the second step the onboarding
 * promise says does not exist, so the URL has to be scannable. Adding a package
 * to do that would break the other promise: `npx vetrina-cli` on a clean machine
 * pulls one thing, not one thing and its tree.
 *
 * Scope is deliberately narrow. Byte mode, error correction level M, versions 1
 * to 10, up to 216 bytes, which is a URL several times over. Anything longer
 * throws and the caller falls back to printing the URL alone.
 *
 * Reference: ISO/IEC 18004. The tables below are transcribed from it.
 */

// ── GF(256), the field Reed-Solomon lives in ────────────────────────
// Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 = 0x11d, per the spec.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial for n error-correction codewords: ∏ (x - α^i). */
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Polynomial long division; the remainder is the EC block. */
function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const buf = new Uint8Array(data.length + ecLen);
  buf.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= mul(gen[j], factor);
  }
  return buf.slice(data.length);
}

// ── Version tables, level M only ────────────────────────────────────
// [total codewords, EC codewords per block, group1 blocks, group1 data cw,
//  group2 blocks, group2 data cw]
const VERSIONS = [
  null,
  [26, 10, 1, 16, 0, 0],
  [44, 16, 1, 28, 0, 0],
  [70, 26, 1, 44, 0, 0],
  [100, 18, 2, 32, 0, 0],
  [134, 24, 2, 43, 0, 0],
  [172, 16, 4, 27, 0, 0],
  [196, 18, 4, 31, 0, 0],
  [242, 22, 2, 38, 2, 39],
  [292, 22, 3, 36, 2, 37],
  [346, 26, 4, 43, 1, 44],
];

const ALIGN = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

// Leftover bits after codeword placement, per version.
const REMAINDER = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

const dataCapacity = (v) => {
  const [, ec, g1, d1, g2, d2] = VERSIONS[v];
  return g1 * d1 + g2 * d2;
};

// ── Bitstream ───────────────────────────────────────────────────────
function buildBitstream(bytes, version) {
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16); // char count indicator
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCapacity(version) * 8;
  // Terminator: up to four zero bits, fewer if there is no room.
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);

  // Alternating pad bytes, per the spec, until the block is full.
  const pads = [0xec, 0x11];
  for (let i = 0; bits.length < capacityBits; i++) push(pads[i % 2], 8);

  const codewords = new Uint8Array(bits.length / 8);
  for (let i = 0; i < codewords.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    codewords[i] = byte;
  }
  return codewords;
}

/** Split into blocks, add EC to each, then interleave both halves. */
function interleave(codewords, version) {
  const [, ecLen, g1, d1, g2, d2] = VERSIONS[version];
  const blocks = [];
  let at = 0;
  for (let i = 0; i < g1; i++) blocks.push(codewords.slice(at, (at += d1)));
  for (let i = 0; i < g2; i++) blocks.push(codewords.slice(at, (at += d2)));
  const ecBlocks = blocks.map((b) => rsEncode(b, ecLen));

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) out.push(b[i]);
  }
  return out;
}

// ── BCH codes for the format and version areas ──────────────────────
function formatBits(mask) {
  const data = (0b00 << 3) | mask; // 00 = level M
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
  return ((data << 10) | rem) ^ 0x5412; // spec-mandated mask, avoids all-zero
}

function versionBits(v) {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >> 11) & 1) * 0x1f25);
  return (v << 12) | rem;
}

// ── Matrix ──────────────────────────────────────────────────────────
function buildMatrix(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const fixed = Array.from({ length: size }, () => new Uint8Array(size));

  const set = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r][c] = v;
    fixed[r][c] = 1;
  };

  // Finder patterns and their separators, one per corner bar bottom-right.
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(br + r, bc + c, inRing || inCore ? 1 : 0);
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0);
    set(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns, skipping the three that would sit on a finder.
  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      const onFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, edge === 1 ? 0 : 1);
        }
      }
    }
  }

  // The dark module, always.
  set(size - 8, 8, 1);

  // Reserve the two format-information strips; contents come after masking.
  for (let i = 0; i < 9; i++) {
    if (!fixed[8][i]) set(8, i, 0);
    if (!fixed[i][8]) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (!fixed[8][size - 1 - i]) set(8, size - 1 - i, 0);
    if (!fixed[size - 1 - i][8]) set(size - 1 - i, 8, 0);
  }

  // Version information, v7 and up.
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      set(size - 11 + c, r, bit);
      set(r, size - 11 + c, bit);
    }
  }

  return { m, fixed, size };
}

/** Zigzag placement: two-module columns, right to left, skipping column 6. */
function placeData(m, fixed, size, bits) {
  let idx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is not data
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const r = upward ? size - 1 - vert : vert;
        if (fixed[r][c]) continue;
        m[r][c] = idx < bits.length ? bits[idx++] : 0;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The four penalty rules. Lower is more likely to scan first time. */
function penalty(m, size) {
  let score = 0;

  // Rule 1: runs of five or more.
  for (let i = 0; i < size; i++) {
    for (const readRow of [true, false]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        const cur = readRow ? m[i][j] : m[j][i];
        const prev = readRow ? m[i][j - 1] : m[j - 1][i];
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3: finder-lookalike sequences, which confuse a decoder badly.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get, start) => {
    let a = true;
    let b = true;
    for (let k = 0; k < 11; k++) {
      const v = get(start + k);
      if (v !== A[k]) a = false;
      if (v !== B[k]) b = false;
    }
    return (a ? 1 : 0) + (b ? 1 : 0);
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j + 11 <= size; j++) {
      score += 40 * matches((k) => m[i][k], j);
      score += 40 * matches((k) => m[k][i], j);
    }
  }

  // Rule 4: deviation from an even split of dark and light.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/**
 * Encode text as a QR matrix.
 * @returns {{ matrix: Int8Array[], size: number }}
 */
export function encode(text) {
  const bytes = new TextEncoder().encode(text);

  let version = 0;
  for (let v = 1; v <= 10; v++) {
    // Mode indicator plus count indicator, in bytes, before the payload.
    const overhead = v < 10 ? 2 : 3;
    if (bytes.length + overhead <= dataCapacity(v)) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error(`too long for a version-10 QR: ${bytes.length} bytes`);

  const codewords = interleave(buildBitstream(bytes, version), version);
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  for (let i = 0; i < REMAINDER[version]; i++) bits.push(0);

  const { m: base, fixed, size } = buildMatrix(version);
  placeData(base, fixed, size, bits);

  // Try all eight masks and keep the least-penalised, as the spec requires.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = base.map((row) => Int8Array.from(row));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!fixed[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
      }
    }

    const fmt = formatBits(mask);
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      // Copy one: down the left of the top-right finder, then along the top.
      if (i < 6) m[i][8] = bit;
      else if (i === 6) m[7][8] = bit;
      else if (i === 7) m[8][8] = bit;
      else if (i === 8) m[8][7] = bit;
      else m[8][14 - i] = bit;
      // Copy two, so a damaged corner still decodes.
      if (i < 8) m[8][size - 1 - i] = bit;
      else m[size - 15 + i][8] = bit;
    }

    const score = penalty(m, size);
    if (!best || score < best.score) best = { score, matrix: m };
  }

  return { matrix: best.matrix, size };
}

/**
 * Render to a terminal string using half-block characters, so one module is
 * roughly square rather than twice as tall as it is wide.
 *
 * Colours are set explicitly rather than inherited. A QR on a dark terminal
 * with an inverted palette does not scan, and "works on my theme" is not a
 * property worth shipping.
 */
export function render(text, { quiet = 4, indent = '  ' } = {}) {
  const { matrix, size } = encode(text);
  const total = size + quiet * 2;
  const at = (r, c) => {
    const rr = r - quiet;
    const cc = c - quiet;
    if (rr < 0 || cc < 0 || rr >= size || cc >= size) return 0;
    return matrix[rr][cc];
  };

  const WHITE_FG = '\x1b[97m';
  const BLACK_FG = '\x1b[30m';
  const WHITE_BG = '\x1b[107m';
  const BLACK_BG = '\x1b[40m';
  const RESET = '\x1b[0m';

  const lines = [];
  for (let r = 0; r < total; r += 2) {
    let line = indent;
    let lastFg = null;
    let lastBg = null;
    for (let c = 0; c < total; c++) {
      // Dark module prints black; the upper half-block's foreground is the
      // top module and its background is the one below.
      const fg = at(r, c) ? BLACK_FG : WHITE_FG;
      const bg = r + 1 < total && at(r + 1, c) ? BLACK_BG : WHITE_BG;
      if (fg !== lastFg) { line += fg; lastFg = fg; }
      if (bg !== lastBg) { line += bg; lastBg = bg; }
      line += '▀';
    }
    lines.push(line + RESET);
  }
  return lines.join('\n');
}
