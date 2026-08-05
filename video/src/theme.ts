// Vetrina's own tokens, mirrored from site/src/styles/brand.css.
//
// An earlier version of this file used the palette from
// examples/build-console.html and called it "the product's own tokens". It was
// not: that page was built inside Gregario and inherited Gregario's palette,
// which is the design-kit rule working correctly. It made this film look like a
// Gregario film. Every value Gregario owns is gone.
//
// The concept is the name: a lit window seen from a dark street. Ground is cold
// and outside, panels are warmer and lit, and the accent is lamp-light kept
// strictly for things that are actually live.
export const T = {
  ground: '#0a0c10',
  surface: '#101319',
  raised: '#161b23',
  border: '#2a3140',
  hair: '#1d232d',
  hair2: '#161b23',
  fg: '#eceff4',
  muted: '#98a2b3',
  faint: '#67707f',

  /** Tungsten. Liveness only, never decoration. */
  live: '#ffb03a',

  good: '#57c98a',
  warn: '#e0a33d',
  bad: '#e5544b',
  you: '#8b7fd4',
} as const;

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/** Seconds → frames. Every timing in this project is written in seconds. */
export const s = (n: number) => Math.round(n * FPS);

/**
 * The body of the film. The first 8 seconds are the opening under test and are
 * timed inside `scenes/openings.tsx`; everything here is shared by every cut,
 * so the hooks are compared against an identical remainder.
 */
export const BODY = {
  empty: { from: 8.0, dur: 3.0 },
  fill: { from: 11.0, dur: 8.0 },
  blocked: { from: 19.0, dur: 6.0 },
  end: { from: 25.0, dur: 5.0 },
} as const;

export const TOTAL = BODY.end.from + BODY.end.dur; // 30s
