import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { T } from '../theme';
import { mono, display } from '../fonts';
import { Pulse } from '../components';

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mark = spring({ frame, fps, config: { damping: 200 } });
  const line = spring({ frame: frame - Math.round(0.45 * fps), fps, config: { damping: 200 } });
  const cmd = spring({ frame: frame - Math.round(1.0 * fps), fps, config: { damping: 200 } });
  const foot = spring({ frame: frame - Math.round(1.6 * fps), fps, config: { damping: 200 } });

  // The rule under the wordmark draws itself.
  const ruleW = interpolate(line, [0, 1], [0, 560]);

  return (
    <AbsoluteFill
      style={{
        background: T.ground,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 1300 }}>
        <div
          style={{
            opacity: mark,
            transform: `translateY(${interpolate(mark, [0, 1], [20, 0])}px)`,
            fontFamily: display,
            fontSize: 82,
            letterSpacing: '-.05em',
            color: T.fg,
            lineHeight: 1,
          }}
        >
          Vetrina
        </div>

        <div
          style={{
            width: ruleW,
            height: 1,
            background: T.border,
            margin: '38px auto 0',
          }}
        />

        <div
          style={{
            opacity: line,
            fontFamily: display,
                        fontSize: 30,
            color: T.muted,
            marginTop: 34,
            lineHeight: 1.25,
          }}
        >
          A window your agents publish into.
        </div>

        <div
          style={{
            opacity: cmd,
            transform: `translateY(${interpolate(cmd, [0, 1], [16, 0])}px)`,
            marginTop: 58,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 18,
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: '24px 34px',
            fontFamily: mono,
            fontSize: 36,
            color: T.fg,
            letterSpacing: '0',
          }}
        >
          <span style={{ color: T.faint }}>$</span>
          npx vetrina-cli
        </div>

        <div
          style={{
            opacity: foot,
            marginTop: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            fontFamily: mono,
            fontSize: 19,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: T.faint,
          }}
        >
          <Pulse size={7} />
          Any agent · any tool · one file
        </div>
      </div>
    </AbsoluteFill>
  );
};
