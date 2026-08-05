import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { T } from '../theme';
import { mono, display } from '../fonts';
import { Kicker } from '../components';

// A real-shaped agent transcript. Deliberately dense and deliberately dull,
// the point of the shot is that none of it is legible at speed, which is the
// same problem it has when you scroll it yourself.
const LINES = `I've finished the migration pass across the router files.
In total I touched 41 files. Most of the changes were mechanical —
useHistory became useNavigate, Switch became Routes, and the
component prop became element.

There were six places where I had to make a judgement call, mostly
around nested routes and the custom PrivateRoute wrapper, and I'd
suggest you take a look at those before merging.

Two of them use history.block, which has no direct v6 equivalent,
so I picked an approach but you should confirm it is what you want.

I could not finish three files. UnsavedChangesPrompt.tsx still
imports the deleted Prompt component, which is why the build does
not currently compile. I did not want to guess at the replacement.

On tests: 212 of 216 pass. The four failures are all in the auth
redirect suite. Three of them look like the same referrer → from
rename, and the fourth might be a real regression I introduced
when I collapsed the nested redirect in ProtectedLayout.tsx.

Separately, while I was in there I noticed the bundle has grown
quite a lot since the last time anyone checked — main is now over
500KB gzipped. I have not investigated it.

The CI run also surfaced 23 failing tests on main, which are not
related to this branch as far as I can tell. Eleven of them look
like a timezone assumption, six look like a null-handling change,
four are flaky and pass on retry, and two look genuinely broken.

Let me know how you want to handle the redirect precedence and I
will finish the remaining three files.`.split('\n');

export const Wall: React.FC<{ durationInSeconds: number }> = ({ durationInSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = durationInSeconds * fps;

  // Accelerating scroll: it starts at a readable pace and outruns you.
  const scroll = interpolate(frame, [0, end], [0, 1580], {
    easing: Easing.in(Easing.quad),
    extrapolateRight: 'clamp',
  });

  // As it accelerates it also blurs and desaturates: the text stops being
  // information and becomes texture.
  const blur = interpolate(frame, [0, end * 0.55, end], [0, 0.6, 5.5], {
    extrapolateRight: 'clamp',
  });
  const dim = interpolate(frame, [0, end * 0.6, end], [1, 0.8, 0.28], {
    extrapolateRight: 'clamp',
  });

  const labelIn = interpolate(frame, [Math.round(1.1 * fps), Math.round(1.8 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const label2In = interpolate(frame, [Math.round(2.7 * fps), Math.round(3.4 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: T.ground }}>
      <AbsoluteFill
        style={{
          filter: `blur(${blur}px)`,
          opacity: dim,
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 82%, transparent 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 120 - scroll,
            left: 150,
            fontFamily: mono,
            fontSize: 25,
            lineHeight: 1.75,
            color: T.faint,
            // `pre`, not `pre-wrap`: the source already carries its line breaks,
            // and letting the container re-wrap them produces orphans like
            // "and I'd" hanging on their own line.
            whiteSpace: 'pre',
          }}
        >
          {LINES.map((l, i) => (
            <div key={i} style={{ minHeight: l === '' ? 22 : undefined }}>
              {l}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingRight: 150,
        }}
      >
        <div style={{ textAlign: 'right', maxWidth: 720 }}>
          <div style={{ opacity: labelIn }}>
            <Kicker size={21} style={{ justifyContent: 'flex-end' }}>
              One hour of work
            </Kicker>
          </div>
          <div
            style={{
              opacity: label2In,
              fontFamily: display,
              fontSize: 58,
              lineHeight: 1.02,
              letterSpacing: '-.04em',
              color: T.fg,
              marginTop: 26,
            }}
          >
            One channel.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
