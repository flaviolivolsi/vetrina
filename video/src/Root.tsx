import React from 'react';
import { Composition, Folder } from 'remotion';
import { Announce, AnnounceProps } from './Announce';
import { FPS, W, H, TOTAL } from './theme';
import { OpeningKey } from './scenes/openings';

const cuts: { id: string; opening: OpeningKey }[] = [
  { id: 'Announce', opening: 'E' },
  { id: 'Cut-E-accumulation', opening: 'E' },
  { id: 'Cut-A-cold-open', opening: 'A' },
  { id: 'Cut-C-compressed-wall', opening: 'C' },
  { id: 'Cut-D-big-claim', opening: 'D' },
  { id: 'Cut-original', opening: 'original' },
];

export const RemotionRoot: React.FC = () => (
  <Folder name="Announce">
    {cuts.map((c) => (
      <Composition
        key={c.id}
        id={c.id}
        component={Announce}
        durationInFrames={Math.round(TOTAL * FPS)}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ opening: c.opening } satisfies AnnounceProps}
      />
    ))}
  </Folder>
);
