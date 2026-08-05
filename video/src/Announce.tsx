import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { T, BODY } from './theme';
import { Grain, SceneFade } from './components';
import { IndexFrame, ROWS } from './scenes/Window';
import { Fleet } from './scenes/Fleet';
import { End } from './scenes/End';
import { OPENINGS, OpeningKey, OPENING_SECONDS } from './scenes/openings';

export type AnnounceProps = {
  /** Which candidate opening to run. The body is identical in every case. */
  opening: OpeningKey;
};

/**
 * The edit. The first 8 seconds are swappable so competing hooks can be judged
 * against an unchanged body; everything after is the same film.
 */
export const Announce: React.FC<AnnounceProps> = ({ opening }) => {
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);
  const Opening = OPENINGS[opening] ?? OPENINGS.original;

  const S = (
    key: keyof typeof BODY,
    children: React.ReactNode,
    fade: { in?: number; out?: number } = {},
  ) => {
    const sc = BODY[key];
    return (
      <Sequence from={f(sc.from)} durationInFrames={f(sc.dur)} premountFor={f(1)} name={key}>
        <SceneFade durationInSeconds={sc.dur} inSeconds={fade.in} outSeconds={fade.out}>
          {children}
        </SceneFade>
      </Sequence>
    );
  };

  return (
    <AbsoluteFill style={{ background: T.ground }}>
      {/* 0-8s, the hook under test */}
      <Sequence from={0} durationInFrames={f(OPENING_SECONDS)} premountFor={f(1)} name={`opening:${opening}`}>
        <Opening />
      </Sequence>

      {/* the window, empty */}
      {S('empty', <IndexFrame rows={[]} />, { in: 0.4, out: 0.01 })}

      {/* agents publish into it, newest first, pushing the rest down */}
      {S('fill', <IndexFrame rows={ROWS} highlight={0} />, { in: 0.01, out: 0.4 })}

      /* The film ends on the fleet and the command. An earlier cut carried an
         eighth beat where a blocked agent was answered from a phone; vetrina is
         read-only, so the film no longer shows it. A demo of an unbuilt feature
         needs a disclaimer, and a disclaimer under a hero video is worse than
         losing the beat. */
      {/* push into the one that needs you */}
      {S('blocked', <Fleet />, { in: 0.3, out: 0.4 })}

      {/* the command */}
      {S('end', <End />, { in: 0.5, out: 0.7 })}

      <Grain />
    </AbsoluteFill>
  );
};
