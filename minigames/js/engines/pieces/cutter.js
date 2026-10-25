/* E5 PIECES ENGINE — the jigsaw cutter: paints a picture through AG.logic.jigsaw's pixel-stepped
 * tab masks (seeded), outlines every piece with 1 px of the theme's --ink, and caches the canvases
 * (the same picture, grid, seed and ink are cut once per page). Also plain grid cuts for sliding tiles.
 *
 *   const cut = await AG.pieces.cutJigsaw('symbol-jigsaw.sign.toxic', { cols: 3, rows: 3, seed, tab, paper: '#fff8e6' })
 *        → { pieces: [{ index, canvas, ox, oy }], pw, ph, w, h, layout }   (source: an asset key, a path or a canvas)
 *   const pieces = await AG.pieces.jigsawPieces(src, { cols, rows, seed, label(i), rot(i) }) → [AG.pieces.Piece]
 *   const tiles = await AG.pieces.cutGrid(src, { cols, rows }) → { tiles: [canvas], tw, th } */
window.AG = window.AG || {};
(function (AG) {
  const P = AG.pieces, J = AG.logic.jigsaw;
  const cache = new Map();

  function rgb(css) {
    css = (css || '').trim();
    let m = css.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { let s = m[1]; if (s.length === 3) s = s.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); }
    m = css.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    return m ? [+m[1], +m[2], +m[3]] : [30, 21, 56];
  }
  /** The picture as a canvas at its own size (a missing asset becomes the labelled placeholder). */
  async function source(src) {
    if (src && src.getContext) return src;
    if (src && src.naturalWidth) { const cv = P.canvas(src.naturalWidth, src.naturalHeight); cv.getContext('2d').drawImage(src, 0, 0); return cv; }
    const rec = await AG.assets.loadImage(src);
    const w = rec.w || (rec.img && rec.img.naturalWidth) || 120, h = rec.h || (rec.img && rec.img.naturalHeight) || 120;
    const cv = P.canvas(w, h), c = cv.getContext('2d');
    if (rec.ok) c.drawImage(rec.img, 0, 0, w, h); else AG.assets.placeholder(c, String(src), 0, 0, w, h);
    return cv;
  }
  const keyOf = (src, parts) => (typeof src === 'string' ? src : src && src.src ? src.src : '#' + (src._agpId || (src._agpId = Math.random().toString(36).slice(2)))) + '|' + parts.join('|');

  function cutJigsaw(src, o) {
    o = o || {};
    const cols = o.cols || 3, rows = o.rows || 3, seed = o.seed == null ? 1 : o.seed, ink = rgb(o.ink || P.ink()), paper = rgb(o.paper || '#fff8e6');
    const k = keyOf(src, ['jig', cols, rows, seed, ink.join(','), paper.join(','), o.tab || '']);
    if (!cache.has(k)) cache.set(k, source(src).then(cv => {
      const W = cv.width, H = cv.height, pw = Math.floor(W / cols), ph = Math.floor(H / rows), t = o.tab || J.tabSize(pw, ph);
      const img = cv.getContext('2d').getImageData(0, 0, W, H).data, layout = J.layout(cols, rows, seed), pieces = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const m = J.mask(layout, c, r, pw, ph, t), edge = J.outline(m), out = P.canvas(m.w, m.h), oc = out.getContext('2d');
        const id = oc.createImageData(m.w, m.h), d = id.data;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
          const i = y * m.w + x; if (!m.data[i]) continue;
          const o4 = i * 4;
          if (edge[i]) { d[o4] = ink[0]; d[o4 + 1] = ink[1]; d[o4 + 2] = ink[2]; d[o4 + 3] = 255; continue; }
          const sx = c * pw - t + x, sy = r * ph - t + y;
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          // see-through art sits on paper, so every piece is solid
          const s4 = (sy * W + sx) * 4, a = img[s4 + 3] / 255;
          for (let ch = 0; ch < 3; ch++) d[o4 + ch] = Math.round(img[s4 + ch] * a + paper[ch] * (1 - a));
          d[o4 + 3] = 255;
        }
        oc.putImageData(id, 0, 0);
        pieces.push({ index: r * cols + c, canvas: out, ox: m.ox, oy: m.oy, edges: m.edges });
      }
      return { pieces, pw, ph, w: pw * cols, h: ph * rows, t, layout, cols, rows };
    }));
    return cache.get(k);
  }

  async function jigsawPieces(src, o) {
    o = o || {};
    const cut = await cutJigsaw(src, o);
    return cut.pieces.map(q => new P.Piece({
      id: (o.idPrefix || 'j') + q.index, kind: 'image', art: q.canvas, home: q.index, ox: q.ox, oy: q.oy,
      rot: o.rot ? o.rot(q.index) : 0, rotatable: o.rotatable !== false,
      label: o.label ? o.label(q.index) : AG.t('pieces.piece', { n: String(q.index + 1) }), data: { cut }
    }));
  }

  function cutGrid(src, o) {
    o = o || {};
    const cols = o.cols || 3, rows = o.rows || 3, ink = rgb(o.ink || P.ink());
    const k = keyOf(src, ['grid', cols, rows, ink.join(','), o.paper || '']);
    if (!cache.has(k)) cache.set(k, source(src).then(cv => {
      const tw = Math.floor(cv.width / cols), th = Math.floor(cv.height / rows), tiles = [], inkCss = 'rgb(' + ink.join(',') + ')';
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const t = P.canvas(tw, th), tc = t.getContext('2d');
        tc.imageSmoothingEnabled = false;
        tc.fillStyle = o.paper || '#fff8e6'; tc.fillRect(0, 0, tw, th);
        tc.drawImage(cv, c * tw, r * th, tw, th, 0, 0, tw, th);
        tc.strokeStyle = inkCss; tc.lineWidth = 1; tc.strokeRect(0.5, 0.5, tw - 1, th - 1);
        tiles.push(t);
      }
      return { tiles, tw, th, cols, rows };
    }));
    return cache.get(k);
  }

  Object.assign(P, { cutJigsaw, jigsawPieces, cutGrid, cutCache: cache });
})(window.AG);
