/* Canvas helpers for the action games (ported from the prototype): a crisp pixel canvas,
 * a frame loop that stops while paused or hidden, icon drawing at whole-number scales, and
 * simple themed scenery. Characters are drawn through AG.CharacterRig (js/core/rig.js).
 * Action games use AG.gfx.canvas(480, 270): 16:9 logical pixels, scaled by CSS. */
window.AG = window.AG || {};
(function (AG) {
  AG.gfx = {
    /** Resolves when the kit icons and the selected character's frames have loaded. */
    ready() {
      const kit = AG.icons.names().filter(n => AG.icons.isKit(n)).map(n => AG.icons.image(n).img);
      const waits = kit.map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; }));
      return Promise.all(waits.concat([AG.chars.preload(AG.chars.selected()), AG.assets.ready()]));
    },
    /** Pixel canvas with logical size W × H, stretched to the stage width by CSS. */
    canvas(W, H, cls) {
      const cv = AG.util.h('canvas', { class: 'ag-canvas ag-px ' + (cls || ''), width: W, height: H });
      cv.style.maxWidth = 'calc(62vh * ' + (W / H).toFixed(4) + ')';
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      return { cv, ctx, W, H, toLocal(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; } };
    },
    /** requestAnimationFrame loop; dt is capped so a slow frame never jumps the game. */
    loop(step) {
      let last = performance.now(), raf = 0, on = true;
      const tick = now => {
        if (!on) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!document.hidden && !AG.paused) { for (let i = 0; i < (AG.timeScale || 1); i++) step(dt); AG.fps = AG.fps ? AG.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1 : 60; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { on = false; cancelAnimationFrame(raf); };
    },
    /** Draw an icon with its top-left at x, y at whole-number scale k (k = 1 → 18 px). */
    drawIcon(ctx, name, x, y, k) {
      k = k || 1;
      const cv = AG.icons.canvas(name);
      if (cv) { ctx.drawImage(cv, Math.round(x), Math.round(y), 18 * k, 18 * k); return; }
      if (!AG.icons.has(name)) { ctx.drawImage(AG.pixelIcon(/[^\x00-\x7f]/.test(name) ? name : '❓', 18, true), Math.round(x), Math.round(y), 18 * k, 18 * k); return; }
      const rec = AG.icons.image(name);
      if (!rec.img.complete || !rec.img.naturalWidth) return;
      const w = rec.img.naturalWidth / rec.scale * k, hh = rec.img.naturalHeight / rec.scale * k;
      ctx.drawImage(rec.img, Math.round(x + (18 * k - w) / 2), Math.round(y + (18 * k - hh) / 2), w, hh);
    },
    /** Banded pixel sky, like the kit backgrounds. */
    sky(ctx, W, H, bands) {
      const n = bands.length, bh = Math.ceil(H / n);
      bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh + 1); });
    },
    /** Stepped hill silhouette (scrolls with offset). */
    hills(ctx, W, baseY, color, amp, period, offset) {
      ctx.fillStyle = color;
      for (let x = 0; x < W; x += 4) {
        const t = (x + offset) / period;
        const y = baseY - Math.round((Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1) * 0.4 + 1) * amp / 4) * 4;
        ctx.fillRect(x, y, 4, baseY - y + 1);
      }
    },
    rain(ctx, W, H, t, color, density, slant) {
      ctx.fillStyle = color;
      const n = Math.round((density || 40) * (AG.reducedMotion() ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const x = ((i * 53 + t * 220 * (slant || 0.4)) % (W + 40)) - 20;
        const y = ((i * 97 + t * 260) % (H + 20)) - 10;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 5);
      }
    },
    /** Canvas text: Pixelify Sans at whole-pixel sizes (≥ 10 px). */
    text(ctx, str, x, y, opts) {
      opts = opts || {};
      ctx.save();
      ctx.font = (opts.bold ? '700 ' : '') + Math.max(10, Math.round(opts.size || 10)) + 'px "Pixelify Sans", monospace';
      ctx.fillStyle = opts.color || '#1e1538'; ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.baseline || 'top';
      if (opts.outline) { ctx.strokeStyle = opts.outline; ctx.lineWidth = 2; ctx.strokeText(AG.pick(str), Math.round(x), Math.round(y)); }
      ctx.fillText(AG.pick(str), Math.round(x), Math.round(y));
      ctx.restore();
    }
  };
})(window.AG);
