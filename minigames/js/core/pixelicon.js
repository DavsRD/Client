/* AG.pixelIcon(emoji, size) — the stand-in for icons not drawn yet.
 * Game prompts name emoji (📚, 💡 …) meaning "an icon of this". If AG.icons has no pixel
 * icon for it, this draws the emoji with the device's own emoji font, shrinks it to the
 * icon grid, snaps every pixel to the AG.icons palette and adds the 1 px ink outline, so it
 * sits next to the hand-drawn icons. No Twemoji files are shipped, so no CC-BY credit is
 * needed. Each one is listed once in the console for kalasag-dev/minigames/docs/ASSET_STATUS.md.
 *
 *   AG.pixelIcon('📚')        → data URL (18×18 by default)
 *   AG.pixelIcon('📚', 18, true) → the canvas, for drawing on a game canvas */
window.AG = window.AG || {};
(function (AG) {
  const cache = new Map();
  let pal = null;
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function palette() {
    if (!pal) pal = Object.values(AG.icons.PAL).filter((c, i, a) => a.indexOf(c) === i).map(hex);
    return pal;
  }
  function nearest(r, g, b) {
    let best = null, bd = Infinity;
    for (const p of palette()) { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }

  function build(emoji, size) {
    const inner = size - 2, big = inner * 8;
    const src = document.createElement('canvas'); src.width = src.height = big;
    const g = src.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = Math.round(big * 0.86) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
    g.fillText(emoji, big / 2, big / 2 + big * 0.04);
    const data = g.getImageData(0, 0, big, big).data;
    // average each 8×8 block (opaque pixels only) into one icon pixel
    const grid = [];
    for (let y = 0; y < inner; y++) {
      grid.push([]);
      for (let x = 0; x < inner; x++) {
        let r = 0, gg = 0, b = 0, a = 0, n = 0;
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
          const i = ((y * 8 + yy) * big + (x * 8 + xx)) * 4;
          if (data[i + 3] > 40) { r += data[i]; gg += data[i + 1]; b += data[i + 2]; n++; }
          a += data[i + 3];
        }
        grid[y].push(a / 64 > 90 && n ? nearest(r / n, gg / n, b / n) : null);
      }
    }
    const out = document.createElement('canvas'); out.width = out.height = size;
    const o = out.getContext('2d');
    const ink = hex(AG.icons.PAL.k);
    const at = (x, y) => (grid[y] && grid[y][x]) || null;
    for (let y = -1; y <= inner; y++) for (let x = -1; x <= inner; x++) {
      let c = at(x, y);
      if (!c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) c = ink;
      if (c) { o.fillStyle = 'rgb(' + c.join(',') + ')'; o.fillRect(x + 1, y + 1, 1, 1); }
    }
    AG.warnOnce('emoji:' + emoji, 'pixel icon drawn from emoji (draw a real one into AG.icons):', emoji);
    return out;
  }

  AG.pixelIcon = function (emoji, size, asCanvas) {
    size = size || 18;
    const key = emoji + '@' + size;
    if (!cache.has(key)) { const cv = build(emoji, size); cache.set(key, { cv, url: cv.toDataURL() }); }
    const rec = cache.get(key);
    return asCanvas ? rec.cv : rec.url;
  };
})(window.AG);
