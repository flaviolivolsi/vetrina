import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { T } from '../theme';
import { mono, display } from '../fonts';
import { Pulse, useRise } from '../components';

const TILES = [
  { n: '03', g: '◆?', label: 'Needs you', color: T.bad, style: 'solid' },
  { n: '05', g: '✕', label: 'Crashed', color: T.faint, style: 'dashed' },
  { n: '04', g: '●', label: 'Testing', color: T.you, style: 'solid' },
  { n: '01', g: '●', label: '6/9', color: T.you, style: 'solid' },
  { n: '02', g: '✓', label: 'Review', color: T.good, style: 'solid' },
] as const;

/** Elapsed clock that actually ticks, because a frozen timer reads as a mock. */
export const Waiting: React.FC<{ baseSeconds: number; frozenAt?: number | null }> = ({
  baseSeconds,
  frozenAt = null,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frozenAt === null ? frame / fps : Math.min(frame / fps, frozenAt);
  const total = Math.floor(baseSeconds + elapsed);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {m}m {String(sec).padStart(2, '0')}s
    </span>
  );
};

export const StatusTiles: React.FC<{ delay?: number }> = ({ delay = 0.25 }) => (
  <div style={{ display: 'flex', gap: 14 }}>
    {TILES.map((t, i) => {
      const r = useRise(i, delay, 0.07);
      return (
        <div
          key={t.n}
          style={{
            ...r,
            flex: 1,
            background: i === 0 ? 'rgba(196,117,106,.09)' : T.surface,
            border: `2px ${t.style} ${i === 0 ? T.bad : T.hair}`,
            padding: '18px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 17, color: T.faint, letterSpacing: '.1em' }}>
            {t.n}
          </div>
          <div style={{ fontSize: 24, color: t.color, marginTop: 6 }}>{t.g}</div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 15,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: i === 0 ? T.bad : T.muted,
              marginTop: 8,
              fontWeight: 700,
            }}
          >
            {t.label}
          </div>
        </div>
      );
    })}
  </div>
);

const HATCH = `repeating-linear-gradient(45deg, rgba(196,117,106,.16) 0 8px, transparent 8px 16px)`;

export const Fleet: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Push in from the index row rather than cutting flat.
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(1.1 * fps) });
  const scale = interpolate(p, [0, 1], [1.07, 1]);

  const card = useRise(0, 0.75, 0);

  return (
    <AbsoluteFill style={{ background: T.ground, transform: `scale(${scale})` }}>
      <div style={{ padding: '70px 150px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontFamily: mono,
            fontSize: 21,
            letterSpacing: '.3em',
            textTransform: 'uppercase',
            color: T.fg,
          }}
        >
          Fleet
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Pulse size={9} />
            <span style={{ fontSize: 17, letterSpacing: '.14em', color: T.muted }}>
              live · 3 repos
            </span>
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          <StatusTiles />
        </div>

        <div
          style={{
            ...card,
            marginTop: 34,
            border: `2px solid ${T.bad}`,
            background: `rgba(196,117,106,.05)`,
            padding: '34px 38px 38px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: HATCH,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 18,
                  letterSpacing: '.2em',
                  textTransform: 'uppercase',
                  color: T.bad,
                  fontWeight: 700,
                }}
              >
                ◆ Blocked — needs you
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  fontFamily: mono,
                  fontSize: 19,
                  color: T.muted,
                  letterSpacing: '.06em',
                }}
              >
                waiting <Waiting baseSeconds={26 * 60} />
              </div>
            </div>

            <div
              style={{
                fontFamily: display,
                fontSize: 21,
                color: T.fg,
                marginTop: 18,
                letterSpacing: '-.05em',
              }}
            >
              Here is what it is waiting on
              <span style={{ fontFamily: mono, fontSize: 26, color: T.muted, marginLeft: 18 }}>
                agent-03
              </span>
            </div>

            <div
              style={{
                fontFamily: mono,
                fontSize: 19,
                color: T.faint,
                marginTop: 12,
                letterSpacing: '.06em',
              }}
            >
              acme/identity · feature/gdpr-erasure
            </div>

            <div
              style={{
                marginTop: 26,
                border: `1px solid ${T.border}`,
                background: T.ground,
                padding: '26px 30px',
                fontFamily: display,
                fontSize: 44,
                color: T.fg,
                letterSpacing: '-.05em',
              }}
            >
              “Should deleted users keep their audit log entries?”
            </div>

            <div
              style={{
                marginTop: 22,
                fontFamily: mono,
                fontSize: 18,
                color: T.bad,
                letterSpacing: '.04em',
              }}
            >
              Nothing has moved for 26 minutes. Every other step is done and waiting on this one
              answer.
            </div>
          </div>
        </div>

        {/* The rest of the fleet, quieter. Without these the page claims five
            agents and shows one, which reads as a mock. */}
        <div style={{ display: 'flex', gap: 20, marginTop: 24 }}>
          <SecondaryCard
            i={0}
            glyph="✕"
            state="Stopped — crashed"
            color={T.faint}
            border="dashed"
            title="Rate limit, no retry"
            agent="agent-05"
            repo="acme/storefront-web · docs/api-reference-sync"
            foot="Died at step 2/5 · exit code 1 · restart is safe"
          />
          <SecondaryCard
            i={1}
            glyph="●"
            state="Running — test suite"
            color={T.you}
            border="solid"
            title="1,840 of 3,200 tests"
            agent="agent-04"
            repo="acme/storefront-web · chore/upgrade-vitest-3"
            foot="3 failures so far · ~11m left"
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SecondaryCard: React.FC<{
  i: number;
  glyph: string;
  state: string;
  color: string;
  border: string;
  title: string;
  agent: string;
  repo: string;
  foot: string;
}> = ({ i, glyph, state, color, border, title, agent, repo, foot }) => {
  const r = useRise(i, 1.35, 0.12);
  return (
    <div
      style={{
        ...r,
        flex: 1,
        border: `2px ${border} ${T.hair}`,
        background: T.surface,
        padding: '22px 26px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ color, fontSize: 20 }}>{glyph}</span>
        <span
          style={{
            fontFamily: mono,
            fontSize: 15,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: T.muted,
            fontWeight: 700,
          }}
        >
          {state}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 15, color: T.faint }}>
          {agent}
        </span>
      </div>
      <div style={{ fontFamily: display, fontSize: 21, color: T.fg, marginTop: 10 }}>{title}</div>
      <div style={{ fontFamily: mono, fontSize: 15, color: T.faint, marginTop: 8 }}>{repo}</div>
      <div style={{ fontFamily: mono, fontSize: 15, color: T.muted, marginTop: 12 }}>{foot}</div>
    </div>
  );
};
