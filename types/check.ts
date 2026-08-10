/**
 * The declarations are hand-written, so something has to compile them or they
 * quietly stop describing the library. This uses every export, with the
 * options a real caller passes, and `tsc --noEmit` is the test.
 *
 * It is never bundled and never runs. If it compiles, the types hold together.
 */
import Chromatic, { DISPERSION, aberrate, spreadOf, supports, type AberrateReport, type PerChannel } from '../index.js';

declare const canvas: HTMLCanvasElement;
declare const ctx: CanvasRenderingContext2D;

function once(): void {
  const green: number = DISPERSION.g;
  const { filter }: { filter: boolean } = supports();

  const report: AberrateReport = aberrate(canvas, {
    lateral: 0.004,
    cx: 0.5,
    cy: 0.5,
    focus: green,
    // The defocus and the edge mask both need `ctx.filter`, which Safari only
    // got in 17 - so a caller asks first rather than finding out in the dark.
    defocus: filter ? 2 : 0,
    edges: filter ? 0.8 : 0,
    diff: false,
  });

  if (!report.ok || !report.canvas) return;

  // The pooled canvas is drawn before anything can call `aberrate` again.
  ctx.drawImage(report.canvas, 0, 0);

  const scales: PerChannel | null = report.scales;
  void scales;
  void report.blurs;
  void report.spread;
  void report.pad;
  void report.ms;
  void report.filter;
}

function measured(): number {
  return spreadOf(0.004, 1920, 1080, 960, 540);
}

/** The default export, and the global the classic script sets, are the same shape. */
function viaObject(): void {
  Chromatic.aberrate(canvas);
  globalThis.Chromatic.aberrate(canvas, { lateral: 0.01 });
}

void once;
void measured;
void viaObject;
