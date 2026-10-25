/* E5 PIECES ENGINE — jigsaw cuts, pure (no DOM): which way each tab points (seeded) and the
 * pixel-stepped mask of every piece. The cutter (engines/pieces/cutter.js) paints the art through
 * these masks. Tested in kalasag-dev/minigames/tests/pieces.test.js.
 *
 *   const J = AG.logic.jigsaw
 *   J.layout(cols, rows, seed) → { cols, rows, right: [r][c] ±1, down: [r][c] ±1 }   (+1 = the tab sticks out right / down)
 *   J.edges(layout, c, r) → { top, right, bottom, left }   (+1 = tab out, -1 = hole, 0 = flat border)
 *   J.tabSize(pw, ph) → t   J.knob(len, t) → [{ d, a, b }]   (row d into the neighbour covers a ≤ i < b)
 *   J.mask(layout, c, r, pw, ph, t) → { w, h, ox: t, oy: t, data: Uint8Array }   (1 = inside; the body starts at ox, oy)
 *   J.outline(mask) → Uint8Array (1 = an edge pixel: inside, with a 4-neighbour outside) */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function rng(seed) { // mulberry32, the same as AG.util.mulberry32 (kept here so the file stays pure)
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function layout(cols, rows, seed) {
    const rnd = rng(seed == null ? 1 : seed), right = [], down = [];
    for (let r = 0; r < rows; r++) { right.push([]); down.push([]); for (let c = 0; c < cols; c++) { right[r].push(rnd() < 0.5 ? 1 : -1); down[r].push(rnd() < 0.5 ? 1 : -1); } }
    return { cols, rows, right, down };
  }
  function edges(L, c, r) {
    return {
      top: r > 0 ? -L.down[r - 1][c] : 0,
      right: c < L.cols - 1 ? L.right[r][c] : 0,
      bottom: r < L.rows - 1 ? L.down[r][c] : 0,
      left: c > 0 ? -L.right[r][c - 1] : 0
    };
  }
  /** About a fifth of the shorter side, never under 3 px. */
  const tabSize = (pw, ph) => Math.max(3, Math.round(Math.min(pw, ph) * 0.22));
  /** A round head on a narrow neck, in whole pixels: row d (0 = next to the edge) spans a ≤ i < b along an edge of len px.
   *  Neighbours share the edge, so one piece's tab and the other's hole are the same pixels. */
  function knob(len, t) {
    const r = t / 2, c = t / 2, neck = Math.max(1, Math.round(t * 0.3)), mid = len / 2, rows = [];
    for (let d = 0; d < t; d++) {
      const dy = d + 0.5 - c, half = Math.max(neck, Math.sqrt(Math.max(0, r * r - dy * dy)) * 1.1);
      const a = Math.round(mid - half), b = Math.round(mid + half);
      rows.push({ d, a: Math.max(1, a), b: Math.min(len - 1, b) });
    }
    return rows;
  }
  function mask(L, c, r, pw, ph, t) {
    t = t || tabSize(pw, ph);
    const w = pw + 2 * t, h = ph + 2 * t, data = new Uint8Array(w * h), e = edges(L, c, r);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = v; };
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) data[(y + t) * w + x + t] = 1;
    const kh = knob(pw, t), kv = knob(ph, t);
    // each side: +1 paints the knob outside the body, -1 cuts the same knob out of it
    for (const k of kh) for (let i = k.a; i < k.b; i++) {
      if (e.top) set(t + i, e.top > 0 ? t - 1 - k.d : t + k.d, e.top > 0 ? 1 : 0);
      if (e.bottom) set(t + i, e.bottom > 0 ? t + ph + k.d : t + ph - 1 - k.d, e.bottom > 0 ? 1 : 0);
    }
    for (const k of kv) for (let i = k.a; i < k.b; i++) {
      if (e.left) set(e.left > 0 ? t - 1 - k.d : t + k.d, t + i, e.left > 0 ? 1 : 0);
      if (e.right) set(e.right > 0 ? t + pw + k.d : t + pw - 1 - k.d, t + i, e.right > 0 ? 1 : 0);
    }
    return { w, h, ox: t, oy: t, t, data, edges: e };
  }
  function outline(m) {
    const out = new Uint8Array(m.w * m.h), inn = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.data[y * m.w + x] === 1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (inn(x, y) && (!inn(x - 1, y) || !inn(x + 1, y) || !inn(x, y - 1) || !inn(x, y + 1))) out[y * m.w + x] = 1;
    return out;
  }

  AG.logic.jigsaw = { layout, edges, tabSize, knob, mask, outline };
  if (typeof module !== 'undefined') module.exports = AG.logic.jigsaw;
})(typeof window !== 'undefined' ? window : globalThis);
