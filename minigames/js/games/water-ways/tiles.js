/* Water Ways: the tile art, names and icons.
 *   WW.tiles.tileset()            every tile the board can show (art × state × rotation) + dry soil
 *   WW.tiles.id(tile, state, leakShown)   the tile id for a cell: 'water-ways.pipe.tee.full@2'
 *   WW.tiles.ICON[kind]           the destination icons (🏠 🐄 🌾 🧺)
 *   WW.tiles.name(tile, leakShown)  { en, fil } for the cursor's live region
 * Pipe art is drawn at rot 0 as the water model reads it (flow.js BASE) and only ever turned in
 * 90° steps by the TileMap. A hidden leak looks like a plain straight pipe until water shows it. */
window.AG = window.AG || {};
(function (AG) {
  const WW = AG.waterWays = AG.waterWays || {};
  const S = (en, fil) => ({ en, fil });
  const PIPES = ['straight', 'corner', 'tee', 'cross', 'end', 'valve', 'drip', 'grey', 'rain', 'leak'];
  const STILL = ['water-ways.dest.base', 'water-ways.source.reservoir', 'water-ways.source.barrel', 'water-ways.canal.open', 'water-ways.canal.covered'];

  function art(t, state, leakShown) {
    if (t.type === 'dest') return 'water-ways.dest.base';
    if (t.source && t.type !== 'rain') return 'water-ways.source.' + t.type;
    if (t.type === 'canal') return 'water-ways.canal.' + (t.open ? 'open' : 'covered');
    const type = t.leak && !t.fixed && leakShown ? 'leak' : t.type;
    return 'water-ways.pipe.' + type + '.' + (state === 'full' ? 'full' : 'empty');
  }
  const id = (t, state, leakShown) => art(t, state, leakShown) + '@' + t.rot;

  /** Dry, cracked soil under the pipes: two browns and a crack that differs per cell. */
  function soil(ctx, px, py, size, t, x, y) {
    ctx.fillStyle = (x + y) % 2 ? '#c99a5b' : '#c4945a'; ctx.fillRect(px, py, size, size);
    ctx.fillStyle = '#a97a44';
    const k = (x * 7 + y * 13) % 4, cx = px + 6 + k * 5, cy = py + 8 + ((k * 3) % 4) * 4;
    for (let i = 0; i < 6; i++) ctx.fillRect(cx + i, cy + (i % 3 === 2 ? 1 : 0) + Math.floor(i / 3), 1, 1);
    ctx.fillRect(px + 22 - k * 3, py + 24 - k, 3, 1);
  }

  function tileset() {
    const keys = [];
    PIPES.forEach(p => ['empty', 'full'].forEach(s => keys.push('water-ways.pipe.' + p + '.' + s)));
    STILL.forEach(k => keys.push(k));
    const defs = [{ id: 'soil', frame: soil }];
    keys.forEach(k => [0, 1, 2, 3].forEach(r => defs.push({ id: k + '@' + r, frame: k, rot: r })));
    return new AG.grid.Tileset(defs);
  }

  const ICON = { house: '🏠', animals: '🐄', field: '🌾', laundry: '🧺' };
  const KIND = {
    house: S('House: drinking water', 'Bahay: inuming tubig'), animals: S('Animals', 'Mga hayop'),
    field: S('Rice field', 'Palayan'), laundry: S('Laundry', 'Labahan')
  };
  const NAMES = {
    straight: S('Straight pipe', 'Tuwid na tubo'), corner: S('Corner pipe', 'Kurbadang tubo'), tee: S('T pipe', 'Tubong T'),
    cross: S('Cross pipe', 'Krus na tubo'), end: S('End cap', 'Takip ng tubo'), valve: S('Pipe with a valve', 'Tubong may balbula'),
    drip: S('Drip pipe: the field needs half the water', 'Tubong patak-patak: kalahati lang ng tubig ang kailangan ng palayan'),
    grey: S('Greywater pipe: reuses laundry water', 'Tubo ng gamit nang tubig: ginagamit muli ang tubig-labahan'),
    rain: S('Rain catcher', 'Saluhan ng ulan'), leak: S('Leaking pipe', 'Tumutulong tubo'), fixed: S('Fixed pipe', 'Naayos na tubo'),
    open: S('Open canal: loses water in the heat', 'Bukas na kanal: natutuyo sa init'), covered: S('Covered canal', 'Natatakpang kanal'),
    reservoir: S('Water tank', 'Imbakan ng tubig'), barrel: S('Water barrel', 'Bariles ng tubig'),
    locked: S('locked', 'nakakandado')
  };
  function name(t, leakShown) {
    if (!t) return S('Dry ground', 'Tuyong lupa');
    if (t.type === 'dest') return KIND[t.kind];
    if (t.type === 'canal') return NAMES[t.open ? 'open' : 'covered'];
    if (t.leak && leakShown) return NAMES[t.fixed ? 'fixed' : 'leak'];
    return NAMES[t.type];
  }

  WW.tiles = { art, id, tileset, soil, ICON, KIND, NAMES, name };
})(window.AG);
