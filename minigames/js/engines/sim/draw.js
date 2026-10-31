/* E7 SIMULATION ENGINE — pixel drawing helpers on AG.sim.draw (whole pixels, no smoothing): the
 * progress ring around a working task, a bar meter whose markers differ by SHAPE (▲ danger, ● safe),
 * task bubbles, selection brackets, Bresenham lines (dashed too), flow-field arrows; and SpriteBatch,
 * a tiny-person atlas built once so a crowd of 200 is 200 drawImage calls from one canvas.
 * Docs: kalasag-dev/minigames/docs/engines/sim.md */
window.AG = window.AG || {};
(function (AG) {
  const INK = '#1e1538', PANEL = '#fff8e6', HAT = '#ffd23f', SAFE = '#2f8a4a', WARN = '#ff7a1a', ALERT = '#e0245e';
  const R = Math.round;

  /** A 1-px (size) Bresenham line; dash = [on, off] pixels. */
  function line(ctx, x0, y0, x1, y1, o) {
    o = o || {};
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    const size = o.size || 1, dash = o.dash, half = Math.floor(size / 2);
    ctx.fillStyle = o.color || INK;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (let guard = 0; guard < 4096; guard++) {
      if (!dash || (n % (dash[0] + dash[1])) < dash[0]) ctx.fillRect(x0 - half, y0 - half, size, size);
      n++;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  const draw = {
    line,
    polyline(ctx, pts, o) { for (let i = 1; i < pts.length; i++) line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, o); },
    /** Stepped ring of dots around cx, cy, lit clockwise from the top for p (0..1). */
    ring(ctx, cx, cy, r, p, o) {
      o = o || {};
      const segs = o.segments || Math.max(8, R(r * 1.4)), dot = o.dot || 2, lit = Math.ceil(Math.max(0, Math.min(1, p)) * segs);
      for (let i = 0; i < segs; i++) {
        const a = -Math.PI / 2 + (i + 0.5) / segs * Math.PI * 2, x = R(cx + Math.cos(a) * r) - (dot >> 1), y = R(cy + Math.sin(a) * r) - (dot >> 1);
        ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, dot + 2, dot + 2);
        ctx.fillStyle = i < lit ? (o.color || SAFE) : (o.off || '#6b6488');
        ctx.fillRect(x, y, dot, dot);
      }
    },
    /** Pixel bar (ink border) filled to ratio; markers [{ at, kind }] drawn above it as ▲ (danger) or ● (safe). */
    bar(ctx, x, y, w, h, ratio, o) {
      o = o || {};
      x = R(x); y = R(y); w = R(w); h = R(h);
      const v = Math.max(0, Math.min(1, ratio)), marks = o.markers || [], danger = marks.find(m => m.kind === 'danger');
      ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = o.back || '#3a3358'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = o.fill || (danger && v >= danger.at ? ALERT : danger && v >= danger.at * 0.8 ? WARN : SAFE);
      if (o.vertical) { const f = R((h - 2) * v); ctx.fillRect(x + 1, y + h - 1 - f, w - 2, f); }
      else ctx.fillRect(x + 1, y + 1, R((w - 2) * v), h - 2);
      marks.forEach(m => {
        const mx = o.vertical ? x + w + 1 : x + 1 + R((w - 2) * m.at), my = o.vertical ? y + h - 1 - R((h - 2) * m.at) : y - 4;
        ctx.fillStyle = m.kind === 'danger' ? ALERT : SAFE;
        if (m.kind === 'danger') { // ▲ 5 × 3 (points at the bar when horizontal)
          if (o.vertical) { ctx.fillRect(mx, my - 2, 1, 5); ctx.fillRect(mx + 1, my - 1, 1, 3); ctx.fillRect(mx + 2, my, 1, 1); }
          else { ctx.fillRect(mx - 2, my, 5, 1); ctx.fillRect(mx - 1, my + 1, 3, 1); ctx.fillRect(mx, my + 2, 1, 1); }
        } else { const cx = o.vertical ? mx : mx - 1, cy = o.vertical ? my - 1 : my; ctx.fillRect(cx, cy, 3, 3); }
      });
    },
    /** Corner brackets around a box (the selection cue: a shape, not only a colour). */
    brackets(ctx, x, y, w, h, o) {
      o = o || {};
      const c = o.color || HAT, k = o.len || 5, s = o.size || 2, pad = o.pad == null ? 2 : o.pad;
      x = R(x - pad); y = R(y - pad); w = R(w + pad * 2); h = R(h + pad * 2);
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.fillStyle = INK; ctx.fillRect(sx > 0 ? cx - 1 : cx - k - 1, sy > 0 ? cy - 1 : cy - s - 1, k + 2, s + 2); ctx.fillRect(sx > 0 ? cx - 1 : cx - s - 1, sy > 0 ? cy - 1 : cy - k - 1, s + 2, k + 2);
        ctx.fillStyle = c; ctx.fillRect(sx > 0 ? cx : cx - k, sy > 0 ? cy : cy - s, k, s); ctx.fillRect(sx > 0 ? cx : cx - s, sy > 0 ? cy : cy - k, s, k);
      });
    },
    /** A task bubble whose tail points down at x, y. o: { icon | art, size: 22, badge, dashed, dim, highlight }.
     *  → its box { x, y, w, h } for hit tests. */
    bubble(ctx, x, y, o) {
      o = o || {};
      const s = o.size || 22, bx = R(x - s / 2), by = R(y - s - 4);
      ctx.save();
      if (o.dim) ctx.globalAlpha = 0.55;
      ctx.fillStyle = INK; ctx.fillRect(bx - 1, by - 1, s + 2, s + 2); ctx.fillRect(R(x) - 2, by + s, 5, 2); ctx.fillRect(R(x) - 1, by + s + 2, 3, 2);
      ctx.fillStyle = o.fill || PANEL; ctx.fillRect(bx, by, s, s); ctx.fillRect(R(x) - 1, by + s, 3, 1); ctx.fillRect(R(x), by + s + 1, 1, 2);
      if (o.dashed) { ctx.fillStyle = PANEL; for (let i = 2; i < s; i += 4) { ctx.fillRect(bx + i, by - 1, 2, 1); ctx.fillRect(bx + i, by + s, 2, 1); ctx.fillRect(bx - 1, by + i, 1, 2); ctx.fillRect(bx + s, by + i, 1, 2); } }
      const k = s >= 22 ? 1 : 0;
      if (o.art && AG.assets) AG.assets.draw(ctx, o.art, bx + 2, by + 2, s - 4, s - 4);
      else if (o.icon && AG.gfx && k) AG.gfx.drawIcon(ctx, o.icon, bx + R((s - 18) / 2), by + R((s - 18) / 2), 1);
      ctx.restore();
      if (o.badge != null && AG.gfx) {
        ctx.fillStyle = INK; ctx.fillRect(bx + s - 7, by - 6, 12, 12); ctx.fillStyle = o.badgeFill || HAT; ctx.fillRect(bx + s - 6, by - 5, 10, 10);
        AG.gfx.text(ctx, String(o.badge), bx + s - 1, by - 5, { size: 10, align: 'center', color: INK, bold: true });
      }
      if (o.highlight) draw.brackets(ctx, bx, by, s, s, { pad: 3 });
      return { x: bx, y: by, w: s, h: s + 4 };
    },
    /** Debug arrows for a FlowField: one short pixel line per cell (every `step` cells). */
    arrows(ctx, flow, o) {
      o = o || {};
      const st = o.step || 1, c = flow.cell, L = c * 0.36;
      for (let cy = 0; cy < flow.h; cy += st) for (let cx = 0; cx < flow.w; cx += st) {
        const d = flow.dirAt(cx, cy);
        if (!d.x && !d.y) continue;
        const x = cx * c + c / 2, y = cy * c + c / 2;
        line(ctx, x - d.x * L, y - d.y * L, x + d.x * L, y + d.y * L, { color: o.color || 'rgba(30,21,56,.55)' });
        ctx.fillStyle = o.head || INK; ctx.fillRect(R(x + d.x * L) - 1, R(y + d.y * L) - 1, 2, 2);
      }
    }
  };

  /* a tiny person, 5 × 7 (h hair, s skin, c shirt, p pants); the two walk frames differ in the legs */
  const KID = ['.hhh.', '.sss.', 'ccccc', '.ccc.', '.ppp.'];
  const LEGS = [['.p.p.', '.p.p.'], ['.p.p.', 'p...p']];
  const SHIRTS = ['#3ec7ff', '#ff6b8b', '#7ee08a', '#ffd23f', '#c4b5ff', '#ff9f1c'], HAIR = ['#2b1d0e', '#5a3a1a', '#1e1538'], SKIN = ['#f1c27d', '#c68642', '#8d5524'];

  /** One atlas canvas: rows = variants, columns = frames. o: { palettes: [{ h, s, c, p }], outline: true }
   *  or a ready sheet { image, fw, fh, frames, variants }. draw(ctx, x, y, variant, frame) centres the sprite. */
  class SpriteBatch {
    constructor(o) {
      o = o || {};
      if (o.image) { Object.assign(this, { atlas: o.image, fw: o.fw, fh: o.fh, frames: o.frames || 1, variants: o.variants || 1 }); return; }
      const pals = o.palettes || SHIRTS.flatMap((c, i) => [{ c, h: HAIR[i % 3], s: SKIN[i % 3], p: '#3b4a6b' }, { c, h: HAIR[(i + 1) % 3], s: SKIN[(i + 2) % 3], p: '#5b3b2a' }]);
      const pad = o.outline === false ? 0 : 1;
      this.fw = 5 + pad * 2; this.fh = 7 + pad * 2; this.frames = LEGS.length; this.variants = pals.length;
      const cv = document.createElement('canvas'); cv.width = this.fw * this.frames; cv.height = this.fh * this.variants;
      const g = cv.getContext('2d');
      pals.forEach((pal, v) => LEGS.forEach((legs, f) => {
        const rows = KID.concat(legs), ox = f * this.fw + pad, oy = v * this.fh + pad;
        if (pad) { g.fillStyle = INK; rows.forEach((r, y) => r.split('').forEach((ch, x) => { if (ch !== '.') g.fillRect(ox + x - 1, oy + y - 1, 3, 3); })); }
        rows.forEach((r, y) => r.split('').forEach((ch, x) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(ox + x, oy + y, 1, 1); } }));
      }));
      this.atlas = cv;
    }
    draw(ctx, x, y, variant, frame) {
      const v = (variant | 0) % this.variants, f = (frame | 0) % this.frames;
      ctx.drawImage(this.atlas, f * this.fw, v * this.fh, this.fw, this.fh, R(x - this.fw / 2), R(y - this.fh / 2), this.fw, this.fh);
    }
  }

  AG.sim = AG.sim || {};
  AG.sim.draw = draw;
  AG.sim.SpriteBatch = SpriteBatch;
})(window.AG);
