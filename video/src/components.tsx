import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { T } from './theme';
import { mono } from './fonts';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Paper grain + vignette. Sits above everything, never animates. */
export const Grain: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN,
        opacity: 0.05,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(120% 80% at 50% 40%, transparent 45%, rgba(0,0,0,.45) 100%)',
        pointerEvents: 'none',
      }}
    />
  </>
);

/**
 * Fades a scene in and out at its own edges. Written in seconds and resolved
 * against the enclosing Sequence, so scenes stay independent of the edit.
 */
export const SceneFade: React.FC<{
  durationInSeconds: number;
  children: React.ReactNode;
  inSeconds?: number;
  outSeconds?: number;
}> = ({ durationInSeconds, children, inSeconds = 0.35, outSeconds = 0.35 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = durationInSeconds * fps;

  const opacity = interpolate(
    frame,
    [0, inSeconds * fps, end - outSeconds * fps, end],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** The live dot. Cyan, and only ever used for things that are actually live. */
export const Pulse: React.FC<{ size?: number; color?: string }> = ({
  size = 10,
  color = T.live,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = interpolate(Math.sin((frame / fps) * 2.4), [-1, 1], [0.3, 1]);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity: o,
        flexShrink: 0,
      }}
    />
  );
};

/** Small-caps letterspaced label, the product's most reused piece of type. */
export const Kicker: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 20, color = T.faint, style }) => (
  <div
    style={{
      fontFamily: mono,
      fontSize: size,
      letterSpacing: '.24em',
      textTransform: 'uppercase',
      color,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Staggered entrance used by every list in the video. */
export const useRise = (index: number, delaySeconds = 0, stagger = 0.09) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - Math.round((delaySeconds + index * stagger) * fps),
    fps,
    config: { damping: 200 },
  });
  return {
    opacity: p,
    transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px)`,
  };
};
