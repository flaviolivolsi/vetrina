import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { T } from '../theme';
import { mono, display } from '../fonts';
import { Pulse } from '../components';

export type Row = {
  title: string;
  space: string;
  age: string;
  /** Seconds into the scene at which this page gets published. */
  at: number;
};

// Newest first, which is how the real index sorts. Index 0 therefore arrives
// last, and every arrival pushes the ones below it down the list.
export const ROWS: Row[] = [
  { title: 'Fleet · 5 agents mid-flight', space: 'vetrina', age: '2s ago', at: 5.0 },
  { title: 'CI triage — 23 failures, 4 causes', space: 'harbor', age: '40s ago', at: 4.1 },
  { title: 'Bundle autopsy — main chunk 284 KB → 511 KB', space: 'storefront-web', age: '1m ago', at: 3.2 },
  { title: 'react-router v5 → v6 · migration report', space: 'acme/identity', age: '3m ago', at: 2.3 },
  { title: 'Trace — POST /api/webhooks/stripe', space: 'payments', age: '6m ago', at: 1.4 },
  { title: 'Prompt render audit — Helix Support Assist', space: 'helix', age: '11m ago', at: 0.5 },
];

const ROW_H = 92;

export const IndexFrame: React.FC<{
  /** Seconds elapsed within the publishing animation. Empty window when 0. */
  rows?: Row[];
  highlight?: number | null;
}> = ({ rows = [], highlight = null }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = (r: Row) =>
    spring({ frame: frame - Math.round(r.at * fps), fps, config: { damping: 200 } });

  const shown = rows.filter((r) => frame >= Math.round(r.at * fps));
  const count = shown.length;
  const spaces = Array.from(new Set(shown.map((s) => s.space)));

  return (
    <AbsoluteFill style={{ background: T.ground, padding: '86px 150px' }}>
      {/* masthead */}
      <div
        style={{
          fontFamily: mono,
          fontSize: 19,
          letterSpacing: '.24em',
          textTransform: 'uppercase',
          color: T.faint,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <Pulse size={9} />
        <span style={{ color: T.fg, letterSpacing: '.3em' }}>Vetrina</span>
        <span>/</span>
        <span>
          {count} page{count === 1 ? '' : 's'}
        </span>
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: '.1em' }}>
          ~/vetrina
        </span>
      </div>

      <div
        style={{
          fontFamily: display,
          fontSize: 44,
          letterSpacing: '-.04em',
          color: T.fg,
          marginTop: 40,
          lineHeight: 1,
        }}
      >
        What the agents are showing you.
      </div>

      {/* space chips */}
      <div style={{ display: 'flex', gap: 12, marginTop: 44, minHeight: 52 }}>
        {['all', ...spaces].map((sp, i) => {
          const p =
            sp === 'all'
              ? 1
              : spring({
                  frame:
                    frame -
                    Math.round((shown.find((r) => r.space === sp)?.at ?? 0) * fps),
                  fps,
                  config: { damping: 200 },
                });
          return (
            <div
              key={sp}
              style={{
                opacity: p,
                transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
                fontFamily: mono,
                fontSize: 16,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: i === 0 ? T.fg : T.muted,
                background: i === 0 ? T.raised : T.surface,
                border: `1px solid ${i === 0 ? T.border : T.hair}`,
                padding: '11px 16px',
              }}
            >
              {sp}
            </div>
          );
        })}
      </div>

      {/* rows */}
      <div style={{ marginTop: 34, borderTop: `1px solid ${T.hair}`, position: 'relative' }}>
        {rows.map((r, i) => {
          const p = progress(r);
          // Everything above this row pushes it down as it arrives.
          const push = rows
            .slice(0, i)
            .reduce((acc, above) => acc + ROW_H * progress(above), 0);

          const isHot = highlight === i;
          const hot = isHot
            ? spring({ frame: frame - Math.round(6.1 * fps), fps, config: { damping: 200 } })
            : 0;

          return (
            <div
              key={r.title}
              style={{
                position: 'absolute',
                top: push,
                left: 0,
                right: 0,
                height: ROW_H,
                opacity: p,
                transform: `translateX(${interpolate(p, [0, 1], [-26, 0])}px)`,
                borderBottom: `1px solid ${T.hair2}`,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                paddingInline: interpolate(hot, [0, 1], [0, 18]),
                background: `rgba(35,33,24,${interpolate(hot, [0, 1], [0, 1])})`,
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 27,
                  color: T.fg,
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.title}
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 17,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: T.muted,
                }}
              >
                {r.space}
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 17,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: T.faint,
                  width: 150,
                  textAlign: 'right',
                }}
              >
                {r.age}
              </div>
            </div>
          );
        })}

        {count === 0 ? (
          <div
            style={{
              fontFamily: mono,
              fontSize: 25,
              color: T.faint,
              paddingTop: 54,
            }}
          >
            Nothing published yet. Write an HTML file into{' '}
            <span style={{ color: T.fg }}>~/vetrina</span>.
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
