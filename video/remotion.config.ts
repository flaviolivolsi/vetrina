import { Config } from '@remotion/cli/config';

// PNG rather than JPEG: the whole video is flat dark tones and subtle
// gradients, which is exactly where JPEG banding shows up.
Config.setVideoImageFormat('png');

// Explicit limited-range bt709. Rendering from JPEG produced yuvj420p
// (full-range), which several players, X included, treat as limited anyway
// and crush the blacks. On a video this dark that is not a subtle difference.
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');

Config.setOverwriteOutput(true);
