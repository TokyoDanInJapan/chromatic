/**
 * chromatic.js - chromatic aberration by magnifying each colour channel by a
 * different amount.
 *
 * Nothing in here samples a pixel. Lateral chromatic aberration is a
 * difference in magnification between wavelengths, so the picture is drawn
 * three times at three slightly different scales, one per channel, and the
 * browser's own resampler does the work. Longitudinal aberration is a
 * difference in focus, so each channel is blurred by a different amount with
 * the platform's blur.
 *
 * Two facts about the aberration do all of it, and both are the reason this
 * needs no per-pixel code:
 *
 *   - **Lateral displacement is proportional to radius.** A wavelength that
 *     focuses at a larger magnification lands further out, and how much
 *     further is proportional to how far out it already was. That is exactly
 *     what a scale about the optical centre does, which is why a scale is not
 *     an approximation of lateral aberration but a statement of it.
 *   - **Dispersion follows 1/lambda squared, not the channel order.** Green
 *     does not sit halfway between red and blue. Taking 620, 540 and 460 nm
 *     for the three channels, green sits at 0.39 of the way from red to blue.
 *     Spacing the channels evenly is the single most common way to make this
 *     effect look painted on.
 *
 * This is a classic script rather than a module on purpose: a module cannot
 * be loaded over `file://`, and being able to open the demo by
 * double-clicking it is worth more than the syntax.
 *
 * No dependencies. Browser only - it needs the platform's resampler and the
 * platform's blur, which is rather the point.
 */
(function (global) {
  'use strict';

  /**
   * Where each channel sits on the dispersion axis, with red at 0 and blue
   * at 1.
   *
   * Refraction follows Cauchy's relation, where the deviation goes with
   * 1/lambda squared. At 620, 540 and 460 nm that puts green at
   *
   *   (1/0.54^2 - 1/0.62^2) / (1/0.46^2 - 1/0.62^2) = 0.39
   *
   * so green is nearer red than blue, and by a long way. Every displacement
   * and every blur in here is interpolated on this axis rather than on the
   * channel index, which is what stops the fringes reading as a flat red and
   * cyan pair.
   */
  const DISPERSION = { r: 0, g: 0.39, b: 1 };

  /** Multiply by one of these to keep a single channel and zero the others. */
  const TINT = { r: '#ff0000', g: '#00ff00', b: '#0000ff' };

  /**
   * Canvases are pooled by name and reused between calls. An effect that is
   * animated allocates nothing per frame this way.
   */
  const pool = new Map();

  function scratch(name, width, height) {
    let canvas = pool.get(name);
    if (!canvas) {
      canvas = document.createElement('canvas');
      pool.set(name, canvas);
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
    return canvas;
  }

  /**
   * Whether the platform will accept `ctx.filter`.
   *
   * Safari only gained it in 17. Without it there is no defocus and no edge
   * mask, but the lateral aberration still works, because that is only a
   * scale. Report it rather than fail, and let the caller decide what to say.
   */
  function supports() {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.filter = 'blur(1px)';
    return { filter: ctx.filter === 'blur(1px)' };
  }

  /**
   * Draw one channel: the picture, scaled about the optical centre, blurred,
   * and stripped to a single colour.
   *
   * The stretched copy underneath is not decoration. A blur samples outside
   * the edges of what it is blurring, and outside the frame there is nothing,
   * so the blur would pull in transparency and print a dark border around the
   * picture. Laying a magnified copy down first means what it finds out there
   * is the picture continued.
   */
  function channel(source, geom, tint, scale, blur) {
    const canvas = scratch('ch-' + tint, geom.W, geom.H);
    const ctx = canvas.getContext('2d');

    if (blur > 0) ctx.filter = 'blur(' + blur.toFixed(2) + 'px)';
    if (geom.m > 0) ctx.drawImage(source, 0, 0, geom.w, geom.h, 0, 0, geom.W, geom.H);

    // Scaling about the optical centre rather than the middle of the frame.
    // A real lens is rarely centred on its sensor, and moving this is the
    // difference between an effect and a particular lens.
    const x = geom.m + geom.cx * (1 - scale);
    const y = geom.m + geom.cy * (1 - scale);
    ctx.drawImage(source, x, y, geom.w * scale, geom.h * scale);

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, geom.W, geom.H);
    return canvas;
  }

  /**
   * A map of where the picture has detail, as |picture - blur(picture)|.
   *
   * Used to hold the aberration to the edges. Note what this is *not* for:
   * the fringes already appear only on edges without any help, because
   * displacing a flat area by half a pixel returns the same flat area. What
   * the mask actually removes is the defocus in flat areas, which is a
   * stylistic choice rather than a physical one. See the README.
   */
  function edgeMask(source, w, h, radius, gain, amount) {
    const high = scratch('high', w, h);
    const hctx = high.getContext('2d');
    hctx.drawImage(source, 0, 0);
    hctx.filter = 'blur(' + radius.toFixed(2) + 'px)';
    hctx.globalCompositeOperation = 'difference';
    hctx.drawImage(source, 0, 0);

    const mask = scratch('mask', w, h);
    const mctx = mask.getContext('2d');
    // White where the mask is to have no effect, so that `amount` can fade
    // the whole thing in: multiplying white by a partly transparent mask
    // gives (1 - amount) + amount * mask, which is the fade.
    mctx.fillStyle = '#fff';
    mctx.fillRect(0, 0, w, h);
    mctx.filter = 'grayscale(1) brightness(' + gain.toFixed(2) + ')';
    mctx.globalCompositeOperation = 'multiply';
    mctx.globalAlpha = amount;
    mctx.drawImage(high, 0, 0);
    return mask;
  }

  /** dst = a * mask + b * (1 - mask), all of it done by the compositor. */
  function blendThrough(a, b, mask, w, h) {
    const lit = scratch('lit', w, h);
    const lctx = lit.getContext('2d');
    lctx.drawImage(a, 0, 0);
    lctx.globalCompositeOperation = 'multiply';
    lctx.drawImage(mask, 0, 0);

    const dim = scratch('dim', w, h);
    const dctx = dim.getContext('2d');
    dctx.drawImage(b, 0, 0);
    dctx.globalCompositeOperation = 'multiply';
    dctx.filter = 'invert(1)';
    dctx.drawImage(mask, 0, 0);

    const out = scratch('blend', w, h);
    const octx = out.getContext('2d');
    octx.drawImage(lit, 0, 0);
    octx.globalCompositeOperation = 'lighter';
    octx.drawImage(dim, 0, 0);
    return out;
  }

  /**
   * Apply chromatic aberration to a canvas or image.
   *
   * Options, all optional:
   *
   *   lateral  0..1     the difference in magnification between red and blue,
   *                     as a fraction. 0.004 is a strong but photographic
   *                     0.4 per cent. Default 0.004.
   *   cx,cy    0..1     the optical centre, as a fraction of the frame. A
   *                     lens is rarely centred on its sensor. Defaults 0.5.
   *   focus    0..1     which wavelength is sharp, on the dispersion axis:
   *                     0 is red, 1 is blue, 0.39 is green. Default 0.39,
   *                     which is where an autofocus system lands.
   *   defocus  number   blur in pixels at the far end of that axis. 0 turns
   *                     longitudinal aberration off. Default 0.
   *   edges    0..1     how far to hold the effect to edges of the picture.
   *                     0 is the physical result. Default 0.
   *   diff     boolean  show the difference from the original instead of the
   *                     result, which is the honest way to see what the
   *                     effect touched. Default false.
   *
   * Returns a report, because half the point of a demo is being able to see
   * what happened:
   *
   *   { ok, canvas, scales, blurs, spread, pad, ms, filter }
   *
   * `canvas` is pooled and is overwritten by the next call, so draw it before
   * calling again.
   */
  function aberrate(source, options) {
    const opts = options || {};
    const lateral = opts.lateral == null ? 0.004 : opts.lateral;
    const focus = opts.focus == null ? DISPERSION.g : opts.focus;
    const defocus = opts.defocus == null ? 0 : opts.defocus;
    const edges = opts.edges == null ? 0 : opts.edges;
    const w = source.width;
    const h = source.height;
    const started = performance.now();
    const filter = supports().filter;

    const report = { ok: false, canvas: null, scales: null, blurs: null, spread: 0, pad: 0, ms: 0, filter };
    if (!(w > 0 && h > 0)) return report;

    // Every channel is scaled up rather than one up and one down. Scaling a
    // channel below 1 would uncover the frame edge, and a uniform
    // magnification of a few tenths of a per cent is not visible - it is a
    // zoom, and a zoom is not an aberration.
    const scales = {
      r: 1 + lateral * (1 - DISPERSION.r),
      g: 1 + lateral * (1 - DISPERSION.g),
      b: 1 + lateral * (1 - DISPERSION.b),
    };
    const blurs = filter
      ? {
          r: Math.abs(DISPERSION.r - focus) * defocus,
          g: Math.abs(DISPERSION.g - focus) * defocus,
          b: Math.abs(DISPERSION.b - focus) * defocus,
        }
      : { r: 0, g: 0, b: 0 };

    const cx = (opts.cx == null ? 0.5 : opts.cx) * w;
    const cy = (opts.cy == null ? 0.5 : opts.cy) * h;

    // Room for the blur to reach into, at three sigma, where a Gaussian has
    // nothing left worth sampling.
    const worst = Math.max(blurs.r, blurs.g, blurs.b);
    const m = Math.ceil(worst * 3);
    const geom = { w, h, m, W: w + 2 * m, H: h + 2 * m, cx: cx + m, cy: cy + m };

    const parts = [
      channel(source, geom, TINT.r, scales.r, blurs.r),
      channel(source, geom, TINT.g, scales.g, blurs.g),
      channel(source, geom, TINT.b, scales.b, blurs.b),
    ];

    // Each part carries one channel and nothing else, so adding them is the
    // whole of the recombination.
    const merged = scratch('merged', w, h);
    const mctx = merged.getContext('2d');
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'lighter';
    for (const part of parts) mctx.drawImage(part, m, m, w, h, 0, 0, w, h);

    let result = merged;

    if (edges > 0 && filter) {
      // The mask has to be blurred by about as far as the fringe travels, or
      // it will not cover the ground the fringe lands on.
      const reach = Math.max(1, spreadOf(lateral, w, h, cx, cy));
      result = blendThrough(merged, source, edgeMask(source, w, h, reach, 6, edges), w, h);
    }

    if (opts.diff) {
      const shown = scratch('diff', w, h);
      const sctx = shown.getContext('2d');
      sctx.drawImage(source, 0, 0);
      sctx.globalCompositeOperation = 'difference';
      sctx.drawImage(result, 0, 0);
      result = shown;
    }

    report.ok = true;
    report.canvas = result;
    report.scales = scales;
    report.blurs = blurs;
    report.spread = spreadOf(lateral, w, h, cx, cy);
    report.pad = m;
    report.ms = performance.now() - started;
    return report;
  }

  /**
   * How far red and blue are pulled apart at the furthest corner, in pixels.
   *
   * The number a photographer would recognise, and the one worth showing:
   * lateral aberration is quoted as a separation at the edge of the frame,
   * not as a percentage.
   */
  function spreadOf(lateral, w, h, cx, cy) {
    const x = Math.max(cx, w - cx);
    const y = Math.max(cy, h - cy);
    return Math.hypot(x, y) * lateral;
  }

  global.Chromatic = {
    DISPERSION,
    supports,
    aberrate,
    spreadOf,
  };
})(window);
