/* 03 Wave Runner: the Daily Challenge (an endless run). Pure, tested in wave-runner.test.js.
 *   AG.waveRunner.generateDaily(seed) → { daily, endless, seed, level, theme, warning, start, sequence }
 * seed = the date (YYYYMMDD), so every device gets the same warning and the same chunks. `sequence` is the first chunk ids the
 * endless Stitcher will place (it needs chunks.json, which index.js caches in AG.waveRunner.chunks; the scene fills it in otherwise).
 * endlessStitcher() is the one place that decides which chunks an endless run draws, so the scene and the tests agree. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const WR = AG.waveRunner = AG.waveRunner || {};

  const START = { beach: 'start-beach', town: 'start-town', night: 'start-town', multiwave: 'start-beach' };
  /** The endless pool has no vertical climb, so the climb level (3) plays the town pool. */
  const poolLevel = level => (level === 3 ? 2 : level);
  /** The lost pets are only collectibles in a stage; in an endless run they are just coins. */
  const endlessChunks = chunks => chunks.map(c => Object.assign({}, c, { objects: c.objects.map(o => (o.id === 'pet' ? Object.assign({}, o, { id: 'coin', icon: 'star' }) : o)) }));

  /** A Stitcher for an endless run of a level, already standing at the end of the start chunk. */
  function endlessStitcher(chunks, seed, level) {
    const S = AG.logic.sidescroll, R = WR.rules, theme = R.themeOf(level);
    const lib = new S.ChunkLibrary(endlessChunks(chunks)), start = lib.get(START[theme]);
    const st = new S.Stitcher(lib, { seed: seed >>> 0, level: poolLevel(level), band: R.bandAt(0), tags: [theme], startY: start.exitY });
    st.x = start.width * S.TILE; st.prev = start; st.index = 1;
    return { stitcher: st, start };
  }
  /** The first `count` chunk ids of an endless run (start chunk first). The band widens as the index grows, as in the scene. */
  function dailySequence(chunks, seed, level, count) {
    const { stitcher, start } = endlessStitcher(chunks, seed, level), out = [start.id];
    for (let i = 1; i < count; i++) { stitcher.band = WR.rules.bandAt(i); out.push(stitcher.next().chunk.id); }
    return out;
  }

  function generateDaily(seed) {
    const R = WR.rules, level = (seed % 5) + 1, theme = R.themeOf(level);
    const d = { daily: true, endless: true, seed: seed >>> 0, level, theme, warning: R.warningFor((seed >>> 0) ^ 0xda11), start: START[theme] };
    if (WR.chunks) d.sequence = dailySequence(WR.chunks, seed, level, 12);
    return d;
  }

  Object.assign(WR, { generateDaily, dailySequence, endlessStitcher, endlessChunks, poolLevel });
  if (typeof module !== 'undefined') module.exports = generateDaily;
})(typeof window !== 'undefined' ? window : globalThis);
