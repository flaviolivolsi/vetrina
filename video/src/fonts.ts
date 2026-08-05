import { loadFont as loadDisplay } from '@remotion/google-fonts/AzeretMono';
import { loadFont as loadMono } from '@remotion/google-fonts/DMMono';

/**
 * Mono-led, deliberately. An earlier pass paired Instrument Serif with DM Mono
 * Different families from Gregario's Fraunces + JetBrains Mono, but the same
 * *categories*, so the silhouette still read as Gregario. There is no serif
 * here at all.
 *
 * Azeret Mono carries display; DM Mono carries data and UI. Both pinned to the
 * latin subset and the weights actually used, because an unrestricted family
 * fires ~96 font requests per render.
 */
export const display = loadDisplay('normal', {
  subsets: ['latin'],
  weights: ['400', '500'],
}).fontFamily;

export const mono = loadMono('normal', {
  subsets: ['latin'],
  weights: ['400', '500'],
}).fontFamily;
