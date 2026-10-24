/* Asset loader. Games code against asset KEYS (as the game prompts name them) and assume
 * every file exists. If one is missing, a labelled placeholder is drawn, a warning is
 * logged once, and the game keeps running (GOVERNING non-negotiable 8).
 *
 *   await AG.assets.ready()                 loads minigames/assets/asset-manifest.json
 *   AG.assets.resolve('water-ways.pipe.straight.empty') → manifest entry (or null)
 *   AG.assets.url(keyOrPath)                → file path, or null
 *   AG.assets.image(keyOrPath)              → { img, ok, loaded, entry, frames, frameW, w, h }
 *   AG.assets.draw(ctx, keyOrPath, x, y, w, h, frame)   draws a frame, or the placeholder
 *   AG.assets.placeholder(ctx, label, x, y, w, h)
 *   AG.assets.placeholderURL(label, w, h)   for <img> in DOM games
 *   AG.assets.listForGame(gameId)           every file a game needs (offline saving)
 *
 * Key resolution follows the starter pack's file naming: a variant written with dots in a
 * prompt is written with "_" in the pack (pipe.straight.empty → pipe.straight_empty);
 * strips end in _<n>f, 9-slices in _9slice; a numbered set (bg.volcano → bg.volcano_1..5)
 * resolves to its first member. kalasag-dev/minigames/tools/asset_status.py uses the
 * same rules. */
window.AG = window.AG || {};
(function (AG) {
  let byKey = null, byPath = null, manifest = [];
  let readyPromise = null;
  const images = new Map();
  const missing = new Set();

  function ready() {
    if (!readyPromise) {
      readyPromise = AG.data.json(AG.path('assets/asset-manifest.json'))
        .then(list => { manifest = list; byKey = new Map(list.map(a => [a.key, a])); byPath = new Map(list.map(a => [a.path, a])); })
        .catch(err => { console.warn('[AG] asset manifest missing', err); byKey = new Map(); byPath = new Map(); });
    }
    return readyPromise;
  }

  const isPath = s => s.includes('/');

  function resolve(key) {
    if (!byKey) return null;
    if (byKey.has(key)) return byKey.get(key);
    const parts = key.split('.');
    const flat = parts.length > 3 ? parts.slice(0, 3).join('.') + '_' + parts.slice(3).join('_') : key;
    for (const cand of [key, flat]) {
      if (byKey.has(cand)) return byKey.get(cand);
      for (const suffix of ['_9slice']) if (byKey.has(cand + suffix)) return byKey.get(cand + suffix);
      for (const [k, v] of byKey) if (k.startsWith(cand + '_') && /^_\d+f$/.test(k.slice(cand.length))) return v;
    }
    for (const [k, v] of byKey) if (k.startsWith(flat + '_')) return v; // numbered set
    return null;
  }

  function url(keyOrPath) {
    if (!keyOrPath) return null;
    if (isPath(keyOrPath)) return keyOrPath;
    const e = resolve(keyOrPath);
    return e ? e.path : null;
  }

  function markMissing(label, why) {
    if (!missing.has(label)) { missing.add(label); AG.warnOnce('asset:' + label, 'missing asset', label, why || ''); AG.emit('ag:assetmissing', { key: label }); }
  }

  function image(keyOrPath) {
    if (images.has(keyOrPath)) return images.get(keyOrPath);
    const entry = isPath(keyOrPath) ? (byPath && byPath.get(keyOrPath)) || null : resolve(keyOrPath);
    const src = url(keyOrPath);
    const rec = { key: keyOrPath, entry, img: new Image(), ok: false, loaded: false, frames: (entry && entry.frames) || 1, w: entry && entry.w, h: entry && entry.h };
    rec.frameW = entry && entry.frameWidth ? entry.frameWidth : (rec.w ? rec.w / rec.frames : 0);
    images.set(keyOrPath, rec);
    if (!src) { rec.loaded = true; markMissing(keyOrPath, '(not in the manifest)'); return rec; }
    rec.img.decoding = 'async';
    rec.img.onload = () => {
      rec.ok = true; rec.loaded = true;
      rec.w = rec.w || rec.img.naturalWidth; rec.h = rec.h || rec.img.naturalHeight;
      rec.frameW = rec.frameW || rec.w / rec.frames;
    };
    rec.img.onerror = () => { rec.loaded = true; markMissing(keyOrPath, src); };
    rec.img.src = src;
    return rec;
  }

  /** Resolves when the image has loaded or failed (never rejects). */
  function loadImage(keyOrPath) {
    const rec = image(keyOrPath);
    if (rec.loaded) return Promise.resolve(rec);
    return new Promise(res => { const done = () => res(rec); rec.img.addEventListener('load', done, { once: true }); rec.img.addEventListener('error', done, { once: true }); });
  }

  /** A checker box with a label: shows exactly which art is still to be drawn. */
  function placeholder(ctx, label, x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.save();
    ctx.fillStyle = '#c4b5ff'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ab9cf0';
    for (let yy = 0; yy < h; yy += 4) for (let xx = (yy / 4) % 2 ? 4 : 0; xx < w; xx += 8) ctx.fillRect(x + xx, y + yy, Math.min(4, w - xx), Math.min(4, h - yy));
    ctx.strokeStyle = '#1e1538'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (w >= 24 && h >= 12) {
      ctx.fillStyle = '#1e1538'; ctx.font = '10px "Pixelify Sans", monospace'; ctx.textBaseline = 'top';
      const text = String(label).split('.').slice(-2).join('.');
      ctx.fillText(text.length * 5 > w - 4 ? text.slice(0, Math.max(1, Math.floor((w - 4) / 5))) : text, x + 2, y + 2);
    }
    ctx.restore();
  }

  const phCache = new Map();
  function placeholderURL(label, w, h) {
    const k = label + w + 'x' + h;
    if (!phCache.has(k)) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      placeholder(cv.getContext('2d'), label, 0, 0, w, h);
      phCache.set(k, cv.toDataURL());
    }
    return phCache.get(k);
  }

  function draw(ctx, keyOrPath, x, y, w, h, frame) {
    const rec = image(keyOrPath);
    if (!rec.ok) { if (rec.loaded) placeholder(ctx, keyOrPath, x, y, w || rec.w || 16, h || rec.h || 16); return false; }
    const fw = rec.frameW || rec.img.naturalWidth, fh = rec.img.naturalHeight, f = (frame || 0) % rec.frames;
    ctx.drawImage(rec.img, f * fw, 0, fw, fh, Math.round(x), Math.round(y), Math.round(w || fw), Math.round(h || fh));
    return true;
  }

  /** Every runtime file one game needs: its scripts and JSON (from the registry), its asset
   *  folder, and the shared files, characters and icons. Used by "Save game for offline". */
  async function listForGame(gameId) {
    await ready();
    const g = AG.registry && AG.registry.get(gameId);
    const own = 'minigames/assets/games/' + gameId + '/';
    const shared = ['minigames/assets/shared/', 'minigames/assets/characters/', 'minigames/assets/agila/', 'minigames/assets/icons/'];
    const files = manifest.map(a => a.path).filter(p => p.startsWith(own) || shared.some(s => p.startsWith(s)));
    if (g) {
      (g.scripts || []).forEach(s => files.push(s));
      (g.data || []).forEach(d => files.push(AG.path('js/games/' + gameId + '/' + d)));
      const eng = AG.registry.engineScripts(g.engine);
      eng.forEach(s => files.push(s));
    }
    return [...new Set(files)];
  }

  /** For ?debug=assets: which of these files load. */
  async function check(paths) {
    return Promise.all(paths.map(p => fetch(p, { method: 'HEAD' }).then(r => ({ path: p, ok: r.ok })).catch(() => ({ path: p, ok: false }))));
  }

  AG.assets = {
    ready, resolve, url, image, loadImage, draw, placeholder, placeholderURL, listForGame, check,
    missing: () => [...missing],
    manifest: () => manifest
  };
})(window.AG);
