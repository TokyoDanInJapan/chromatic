/**
 * Types for `chromatic.js`.
 *
 * Hand-written, because the library is a classic script and a script cannot
 * carry its own types. They are checked the only way a hand-written
 * declaration can be: `npm run check:types` compiles them against a use of
 * every export.
 */

/** Anything that can be drawn from. The demo passes a canvas. */
export type Source = CanvasImageSource & { width: number; height: number };

/** A value per colour channel. */
export interface PerChannel {
  r: number;
  g: number;
  b: number;
}

export interface AberrateOptions {
  /**
   * The difference in magnification between red and blue, as a fraction.
   * Default 0.004.
   */
  lateral?: number;
  /** The optical centre across, as a fraction of the frame. Default 0.5. */
  cx?: number;
  /** And down. Default 0.5. */
  cy?: number;
  /**
   * Which wavelength is in focus, on the dispersion axis: 0 red, 0.39 green,
   * 1 blue. Default 0.39.
   */
  focus?: number;
  /** Blur in pixels at the far end of that axis. Default 0. */
  defocus?: number;
  /** Hold the effect to edges, 0 to 1. Default 0, and needs `ctx.filter`. */
  edges?: number;
  /** Show what changed rather than the result. Default false. */
  diff?: boolean;
}

export interface AberrateReport {
  /** False when the source had no area, in which case `canvas` is null. */
  ok: boolean;
  /**
   * The result.
   *
   * **Pooled**: it is overwritten by the next call, so draw it before calling
   * again.
   */
  canvas: HTMLCanvasElement | null;
  /** What each channel was magnified by. */
  scales: PerChannel | null;
  /** And blurred by, in pixels. */
  blurs: PerChannel | null;
  /** How far red and blue are pulled apart at the furthest corner, in pixels. */
  spread: number;
  /** The padding the blur was given to reach into, in pixels. */
  pad: number;
  /** How long it took, in milliseconds. */
  ms: number;
  /** Whether the platform accepted `ctx.filter`. */
  filter: boolean;
}

/** Where each channel sits on the dispersion axis, red at 0 and blue at 1. */
export declare const DISPERSION: PerChannel;

/** Whether the platform has `ctx.filter`, which the defocus and the edge mask need. */
export declare function supports(): { filter: boolean };

/** Aberrate a picture. Synchronous: every step is a canvas operation. */
export declare function aberrate(source: Source, options?: AberrateOptions): AberrateReport;

/** How far red and blue are pulled apart at the furthest corner, in pixels. */
export declare function spreadOf(lateral: number, w: number, h: number, cx: number, cy: number): number;

/** Everything above, as one object - what `chromatic.js` sets on `globalThis`. */
export interface ChromaticApi {
  DISPERSION: PerChannel;
  supports: typeof supports;
  aberrate: typeof aberrate;
  spreadOf: typeof spreadOf;
}

export declare const Chromatic: ChromaticApi;
export default Chromatic;

declare global {
  var Chromatic: ChromaticApi;
}
