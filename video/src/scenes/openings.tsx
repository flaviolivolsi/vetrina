import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig, spring, Easing } from 'remotion';
import { T } from '../theme';
import { mono, display } from '../fonts';
import { Pulse } from '../components';
import { Waiting } from './Fleet';
import { Wall } from './Wall';
import { Accumulate } from './Accumulate';

/**
 * Three candidate openings, each exactly 8 seconds, so the body of the film is
 * identical across all of them and the comparison is honest.
 *
 * Constraints an opening has to meet that the rest of the film does not:
 *   - legible at ~400px wide, muted, in a feed
 *   - frame 0 has to work as a still, because that is the post's thumbnail
 *   - the decision to keep watching is made around 0.8s, not 4s
 */
export const OPENING_SECONDS = 8;

/** Full-frame claim. Type fills the frame so it survives any size. */
const BigType: React.FC<{
  children: React.ReactNode;
  dim?: boolean;
  size?: number;
  /** Hard cut in: no fade, just a small settle. */
  settle?: boolean;
}> = ({ children, dim, size = 130, settle = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = settle
    ? spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(0.5 * fps) })
    : 1;
  return (
    <AbsoluteFill
      style={{
        background: T.ground,
        justifyContent: 'center',
        paddingLeft: 150,
        paddingRight: 150,
      }}
    >
      <div
        style={{
          fontFamily: display,
          fontSize: size,
          lineHeight: 1.0,
          letterSpacing: '-.045em',
          color: dim ? T.muted : T.fg,
                    maxWidth: 1500,
          transform: `translateY(${interpolate(p, [0, 1], [14, 0])}px)`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The cold open: the blocked agent, large, with a clock that is visibly
 * running. A number changing in frame 0 is motion the eye cannot ignore, and
 * "26 minutes" is a quantity a developer feels immediately.
 */
const BlockedHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // No entrance fade. The film starts already happening.
  const breathe = interpolate(Math.sin((frame / fps) * 3.2), [-1, 1], [0.55, 1]);

  return (
    <AbsoluteFill
      style={{ background: T.ground, justifyContent: 'center', alignItems: 'center' }}
    >
      <div style={{ width: 1480 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontFamily: mono,
            fontSize: 24,
            letterSpacing: '.26em',
            textTransform: 'uppercase',
            color: T.faint,
            marginBottom: 26,
          }}
        >
          <Pulse size={10} />
          Fleet · 5 agents · 3 repos
        </div>

        <div
          style={{
            border: `3px solid ${T.bad}`,
            background: 'rgba(196,117,106,.07)',
            padding: '44px 52px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(45deg, rgba(196,117,106,.18) 0 9px, transparent 9px 18px)',
              opacity: 0.6,
            }}
          />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: '.22em',
                  textTransform: 'uppercase',
                  color: T.bad,
                  fontWeight: 700,
                  opacity: breathe,
                }}
              >
                ◆ Blocked — needs you
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  fontFamily: mono,
                  fontSize: 46,
                  color: T.fg,
                  letterSpacing: '.02em',
                }}
              >
                <Waiting baseSeconds={26 * 60} />
              </div>
            </div>

            <div
              style={{
                fontFamily: display,
                fontSize: 42,
                color: T.fg,
                marginTop: 26,
                lineHeight: 1.08,
                letterSpacing: '-.035em',
              }}
            >
              “Should deleted users keep their audit log entries?”
            </div>

            <div
              style={{
                fontFamily: mono,
                fontSize: 24,
                color: T.muted,
                marginTop: 24,
                letterSpacing: '.05em',
              }}
            >
              agent-03 · acme/identity · paused at step 4/7
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A short, brighter, faster pass of the transcript. Supporting, not carrying. */
const WallFlash: React.FC<{ durationInSeconds: number; label?: string }> = ({
  durationInSeconds,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = durationInSeconds * fps;
  const scroll = interpolate(frame, [0, end], [0, 1500], {
    easing: Easing.in(Easing.quad),
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: T.ground }}>
      <AbsoluteFill
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 84%, transparent 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 60 - scroll,
            left: 150,
            fontFamily: mono,
            fontSize: 34,
            lineHeight: 1.6,
            // Brighter than the original wall: at feed size the old grey read
            // as an empty rectangle.
            color: T.muted,
            whiteSpace: 'pre',
          }}
        >
          {`I've finished the migration pass across the router files.
In total I touched 41 files. Most of the changes were
mechanical — useHistory became useNavigate, Switch became
Routes, and the component prop became element.

There were six places where I had to make a judgement call,
mostly around nested routes and the custom PrivateRoute
wrapper, and I'd suggest you take a look at those.

I could not finish three files. UnsavedChangesPrompt.tsx
still imports the deleted Prompt component, which is why
the build does not currently compile.

On tests: 212 of 216 pass. The four failures are all in
the auth redirect suite. Three of them look like the same
referrer → from rename, and the fourth might be a real
regression I introduced.

The CI run also surfaced 23 failing tests on main, which
are not related to this branch as far as I can tell.`}
        </div>
      </AbsoluteFill>

      {label ? (
        <>
          {/* A real scrim, not a text-shadow. Type sitting directly on moving
              monospace is unreadable at feed size, the glyphs interleave. */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(to bottom, transparent 40%, ${T.ground} 62%, ${T.ground} 100%)`,
            }}
          />
          <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 150px 96px' }}>
            <div
              style={{
                fontFamily: display,
                fontSize: 52,
                color: T.fg,
                letterSpacing: '-.04em',
                lineHeight: 1.04,
              }}
            >
              {label}
            </div>
          </AbsoluteFill>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

const Seq: React.FC<{ from: number; dur: number; children: React.ReactNode }> = ({
  from,
  dur,
  children,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      from={Math.round(from * fps)}
      durationInFrames={Math.round(dur * fps)}
      premountFor={Math.round(1 * fps)}
    >
      {children}
    </Sequence>
  );
};

/** A: cold open on the pain, then explain why you did not know. */
export const OpeningA: React.FC = () => (
  <AbsoluteFill style={{ background: T.ground }}>
    <Seq from={0} dur={2.4}>
      <BlockedHook />
    </Seq>
    <Seq from={2.4} dur={1.9}>
      <BigType size={112}>One of your agents has been stuck for 26 minutes.</BigType>
    </Seq>
    <Seq from={4.3} dur={1.5}>
      <WallFlash durationInSeconds={1.5} label="This is how you were meant to notice." />
    </Seq>
    <Seq from={5.8} dur={2.2}>
      <BigType size={124}>Chat is a log.</BigType>
    </Seq>
  </AbsoluteFill>
);

/** C: the original idea, compressed and amplified. */
export const OpeningC: React.FC = () => (
  <AbsoluteFill style={{ background: T.ground }}>
    <Seq from={0} dur={2.4}>
      <WallFlash durationInSeconds={2.4} label="One hour of work. One channel." />
    </Seq>
    <Seq from={2.4} dur={2.6}>
      <BigType size={128}>Chat is a log.</BigType>
    </Seq>
    <Seq from={5.0} dur={3.0}>
      <BigType size={96} dim>
        Nobody reads a log to understand a system.
      </BigType>
    </Seq>
  </AbsoluteFill>
);

/** D: the claim, as large as the frame allows, in hard cuts. */
export const OpeningD: React.FC = () => (
  <AbsoluteFill style={{ background: T.ground }}>
    <Seq from={0} dur={1.9}>
      <BigType size={142}>Your agent worked for an hour.</BigType>
    </Seq>
    <Seq from={1.9} dur={1.6}>
      <BigType size={142} dim>
        You read about it.
      </BigType>
    </Seq>
    <Seq from={3.5} dur={1.6}>
      <WallFlash durationInSeconds={1.6} />
    </Seq>
    <Seq from={5.1} dur={2.9}>
      <BigType size={124}>Chat is a log.</BigType>
    </Seq>
  </AbsoluteFill>
);

/**
 * E: the pile. Opens inside one conversation as it accumulates: three tasks
 * and two of the human's own mid-flight asides, interleaved, with a counter
 * that only ever goes up. This is the half no shipped session dashboard
 * addresses, because the problem is not knowing where the agents are.
 */
export const OpeningE: React.FC = () => (
  <AbsoluteFill style={{ background: T.ground }}>
    <Seq from={0} dur={3.6}>
      <Accumulate durationInSeconds={3.6} />
    </Seq>
    <Seq from={3.6} dur={2.1}>
      <BigType size={92}>Chat only ever grows.</BigType>
    </Seq>
    <Seq from={5.7} dur={2.3}>
      <BigType size={82} dim>
        A page is rewritten in place.
      </BigType>
    </Seq>
  </AbsoluteFill>
);

/** The current cut, kept so it can be judged next to the alternatives. */
export const OpeningOriginal: React.FC = () => (
  <AbsoluteFill style={{ background: T.ground }}>
    <Seq from={0} dur={4.6}>
      <Wall durationInSeconds={4.6} />
    </Seq>
    <Seq from={4.6} dur={3.4}>
      <BigType size={94}>Chat is a log.</BigType>
    </Seq>
  </AbsoluteFill>
);

export const OPENINGS = {
  original: OpeningOriginal,
  E: OpeningE,
  A: OpeningA,
  C: OpeningC,
  D: OpeningD,
} as const;

export type OpeningKey = keyof typeof OPENINGS;
