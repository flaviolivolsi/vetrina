import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { T } from '../theme';
import { mono } from '../fonts';

type Turn = {
  who: 'you' | 'agent';
  /** Which task this belongs to. The point is that they interleave. */
  task: 'migration' | 'aside' | 'tests' | 'bundle';
  text: string;
  lines: number;
};

// One conversation, in the order it happened rather than the order it matters.
// Two of these are the human dropping a thought mid-task while the agent is
// busy with something else; those are the ones that get buried.
const TURNS: Turn[] = [
  { who: 'you', task: 'migration', text: 'migrate the router files to v6', lines: 1 },
  { who: 'agent', task: 'migration', text: 'Starting on src/routes. useHistory → useNavigate…', lines: 3 },
  { who: 'agent', task: 'migration', text: 'Six places need a judgement call, mostly nested routes…', lines: 4 },
  { who: 'you', task: 'aside', text: 'oh also — redirect precedence, check ProtectedLayout', lines: 1 },
  { who: 'agent', task: 'migration', text: 'history.block has no v6 equivalent. I picked an approach…', lines: 5 },
  { who: 'you', task: 'tests', text: 'while you\'re there, why is CI red on main?', lines: 1 },
  { who: 'agent', task: 'migration', text: 'UnsavedChangesPrompt.tsx still imports the deleted Prompt…', lines: 4 },
  { who: 'agent', task: 'tests', text: '23 failures. Eleven look like a timezone assumption…', lines: 5 },
  { who: 'you', task: 'aside', text: 'don\'t forget the referrer rename', lines: 1 },
  { who: 'agent', task: 'migration', text: '212 of 216 pass. The four are all auth redirect…', lines: 4 },
  { who: 'agent', task: 'bundle', text: 'Separately: main is over 500KB gzipped now.', lines: 3 },
  { who: 'agent', task: 'tests', text: 'Four are flaky and pass on retry. Two look genuinely broken…', lines: 4 },
  { who: 'you', task: 'migration', text: 'ok merge it', lines: 1 },
  { who: 'agent', task: 'migration', text: 'Merged. Moving to the next thread…', lines: 2 },
];

const TASK_LABEL: Record<Turn['task'], string> = {
  migration: 'migration',
  aside: 'your aside',
  tests: 'ci triage',
  bundle: 'bundle',
};

const LINE_H = 30;
const GAP = 22;

/**
 * The pile. Turns arrive faster and faster, interleaving three tasks and two
 * of the human's own mid-flight asides, until the frame is full and nothing in
 * it is findable. Nothing is deleted, because that is the point.
 */
export const Accumulate: React.FC<{ durationInSeconds: number }> = ({ durationInSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = durationInSeconds * fps;

  // Turns land on an accelerating cadence: an hour compressed, and the sense
  // that it is getting away from you.
  const progress = interpolate(frame, [0, end], [0, 1], {
    easing: Easing.in(Easing.quad),
    extrapolateRight: 'clamp',
  });
  const shownCount = Math.floor(progress * TURNS.length * 1.35);

  const shown = TURNS.slice(0, Math.min(shownCount, TURNS.length));

  // Total height of everything so far; the column rides upward as it fills so
  // the newest turn stays on screen and the oldest scrolls out of reach.
  const heights = shown.map((t) => t.lines * LINE_H + GAP + 26);
  const total = heights.reduce((a, b) => a + b, 0);
  const offset = Math.max(0, total - 880);

  return (
    <AbsoluteFill style={{ background: T.ground }}>
      <AbsoluteFill
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, #000 10%, #000 74%, transparent 96%)',
        }}
      >
        <div style={{ position: 'absolute', top: 120 - offset, left: 150, width: 1180 }}>
          {shown.map((t, i) => {
            const isYou = t.who === 'you';
            const isAside = t.task === 'aside';
            return (
              <div key={i} style={{ marginBottom: GAP }}>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 15,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: T.faint,
                    marginBottom: 7,
                    display: 'flex',
                    gap: 14,
                  }}
                >
                  <span style={{ color: isYou ? T.muted : T.faint }}>{isYou ? 'you' : 'agent'}</span>
                  <span>·</span>
                  <span>{TASK_LABEL[t.task]}</span>
                </div>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 22,
                    lineHeight: `${LINE_H}px`,
                    color: isYou ? T.fg : T.muted,
                    borderLeft: `2px ${isAside ? 'dashed' : 'solid'} ${
                      isYou ? T.border : T.hair
                    }`,
                    paddingLeft: 18,
                  }}
                >
                  {t.text}
                  {/* the bulk the agent actually produced, as texture */}
                  {Array.from({ length: t.lines - 1 }).map((_, k) => (
                    <div key={k} style={{ color: T.faint, opacity: 0.55 }}>
                      {'─'.repeat(46 - ((i + k) % 9) * 3)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* the counter is the argument: it only ever goes up */}
      <AbsoluteFill style={{ padding: '86px 150px', pointerEvents: 'none' }}>
        <div
          style={{
            marginLeft: 'auto',
            textAlign: 'right',
            fontFamily: mono,
            fontSize: 17,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: T.faint,
          }}
        >
          one conversation
          <div
            style={{
              fontSize: 58,
              letterSpacing: '-.02em',
              color: T.fg,
              marginTop: 12,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {String(shown.length).padStart(2, '0')} turns
          </div>
          <div style={{ marginTop: 10, color: T.faint }}>
            {new Set(shown.map((t) => t.task)).size} tasks
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
