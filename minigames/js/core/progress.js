/* Progress rules: level records, world unlocks, the next level to play, XP, badges, star
 * unlocks and the Daily Challenge seed. The pure rules (AG.progress.rules) take plain data
 * and are tested in kalasag-dev/minigames/tests/; the rest read and write AG.store.
 *
 * - Worlds: world 1 is open; world N+1 opens at ≥ 5 stars in world N or when all five of
 *   its levels are cleared. Teacher/demo mode (#unlockAll=1) opens everything.
 * - XP = max(5, round(score / 10)) + stars × 5 + bonusXP (effort is never worth zero). It is
 *   added to the SITE's XP (KALASAG O6); ranks are computed from the site XP by the host.
 * - Star unlocks (O4): 25 / 50 / 100 / 200 stars = card frames, 300 = the gold name plate. */
(function (AG) {
  const WORLDS = 3, LEVELS = 5; // KALASAG: 3 worlds × 5 levels (45 stars per game)
  const S = (en, fil) => ({ en, fil });

  const rules = {
    WORLDS, LEVELS,
    levelId: (gameId, w, l) => gameId + ':' + w + '-' + l,
    worldStars(levels, gameId, w) { let n = 0; for (let l = 1; l <= LEVELS; l++) n += (levels[rules.levelId(gameId, w, l)] || {}).stars || 0; return n; },
    worldCleared(levels, gameId, w) { for (let l = 1; l <= LEVELS; l++) if (!((levels[rules.levelId(gameId, w, l)] || {}).stars > 0)) return false; return true; },
    worldOpen(levels, gameId, w, unlockAll) {
      if (w > WORLDS || w < 1) return false;
      if (w === 1 || unlockAll) return true;
      return rules.worldStars(levels, gameId, w - 1) >= 5 || rules.worldCleared(levels, gameId, w - 1);
    },
    gameStars(levels, gameId) { let n = 0; for (const k in levels) if (k.startsWith(gameId + ':')) n += levels[k].stars || 0; return n; },
    totalStars(levels) { let n = 0; for (const k in levels) n += levels[k].stars || 0; return n; },
    /** "Play 1-1" for a new game, otherwise "Continue" at the level after the last one played. */
    nextLevel(levels, gameId, last, unlockAll) {
      if (!last || last.gameId !== gameId) {
        for (let w = 1; w <= WORLDS; w++) for (let l = 1; l <= LEVELS; l++) if (!levels[rules.levelId(gameId, w, l)] && rules.worldOpen(levels, gameId, w, unlockAll)) return { world: w, level: l, fresh: w === 1 && l === 1 && !rules.gameStars(levels, gameId) };
        return { world: 1, level: 1, fresh: false };
      }
      let w = last.world, l = last.level + 1;
      if (l > LEVELS) { w++; l = 1; }
      if (w > WORLDS || !rules.worldOpen(levels, gameId, w, unlockAll)) return { world: last.world, level: last.level, fresh: false };
      return { world: w, level: l, fresh: false };
    },
    xp: res => Math.max(5, Math.round((res.score || 0) / 10)) + (res.stars || 0) * 5 + (res.bonusXP || 0),
    merge(prev, res) {
      prev = prev || { stars: 0, best: 0, plays: 0, collectibles: 0 };
      const bits = (res.collectibles || []).reduce((n, b, i) => n | (b ? 1 << i : 0), 0);
      return { stars: Math.max(prev.stars, res.stars || 0), best: Math.max(prev.best, res.score || 0), plays: prev.plays + 1, last: Date.now(), collectibles: (prev.collectibles || 0) | bits };
    }
  };

  AG.BADGES = [
    { id: 'first', name: S('First Steps', 'Unang Hakbang'), icon: 'check', desc: S('Finish any level.', 'Tapusin ang kahit anong antas.'), test: s => s.stats.games >= 1 },
    { id: 'squad', name: S('Full Squad', 'Buong Squad'), icon: 'hard_hat', desc: S('Play as all six characters.', 'Maglaro bilang lahat ng anim na karakter.'), test: s => Object.keys(s.stats.used || {}).length >= 6 },
    { id: 'stars25', name: S('Star Collector', 'Kolektor ng Bituin'), icon: 'star', desc: S('Earn 25 stars.', 'Makakuha ng 25 bituin.'), test: s => rules.totalStars(s.levels) >= 25 },
    { id: 'advanced', name: S('Advanced Hero', 'Mahusay na Bayani'), icon: 'trophy', desc: S('Get 3 stars on Advanced.', 'Makakuha ng 3 bituin sa Mahirap.'), test: s => !!s.stats.advanced3 },
    { id: 'safe50', name: S('Safe Choices', 'Ligtas na Pasya'), icon: 'heart', desc: S('Make 50 safe choices.', 'Gumawa ng 50 ligtas na pasya.'), test: s => (s.stats.safeChoices || 0) >= 50 },
    { id: 'daily', name: S('Daily Champ', 'Kampeon ng Araw'), icon: 'sun', desc: S('Finish a Daily Challenge.', 'Tapusin ang isang Hamon ng Araw.'), test: s => Object.keys(s.daily || {}).length >= 1 }
  ];
  AG.STAR_UNLOCKS = [
    { stars: 25, id: 'frame-bronze', name: S('Bronze card frame', 'Bronseng frame ng card') },
    { stars: 50, id: 'frame-silver', name: S('Silver card frame', 'Pilak na frame ng card') },
    { stars: 100, id: 'frame-gold', name: S('Gold card frame', 'Gintong frame ng card') },
    { stars: 200, id: 'frame-rainbow', name: S('Rainbow card frame', 'Bahagharing frame ng card') },
    { stars: 300, id: 'plate-gold', name: S('Gold name plate', 'Gintong name plate') }
  ];

  const levels = () => AG.store.get('levels');
  AG.progress = {
    rules,
    level: (gameId, w, l) => levels()[rules.levelId(gameId, w, l)] || null,
    worldStars: (gameId, w) => rules.worldStars(levels(), gameId, w),
    worldOpen: (gameId, w, unlockAll) => rules.worldOpen(levels(), gameId, w, unlockAll),
    gameStars: gameId => rules.gameStars(levels(), gameId),
    totalStars: () => rules.totalStars(levels()),
    nextLevel: (gameId, unlockAll) => rules.nextLevel(levels(), gameId, (AG.store.get('lastByGame') || {})[gameId], unlockAll),
    xpFor: rules.xp,
    /** Saves one finished level. Returns what changed so the results screen can celebrate it. */
    record(gameId, hazardId, w, l, res, mode) {
      const s = AG.store.all();
      const id = rules.levelId(gameId, w, l);
      const prev = s.levels[id];
      const starsBefore = rules.totalStars(s.levels);
      if (mode === 'daily') {
        const key = AG.progress.todayStamp() + ':' + gameId;
        s.daily[key] = { best: Math.max((s.daily[key] || {}).best || 0, res.score || 0) };
      } else {
        s.levels[id] = rules.merge(prev, res);
        s.lastByGame = s.lastByGame || {};
        s.lastByGame[gameId] = { gameId, world: w, level: l };
      }
      s.last = { gameId, hazardId, world: w, level: l };
      s.stats.games = (s.stats.games || 0) + 1;
      AG.store.set('stats', s.stats); // saves everything above
      const starsAfter = rules.totalStars(s.levels);
      return {
        newBest: !!prev && (res.score || 0) > prev.best,
        newStars: !prev || (res.stars || 0) > prev.stars,
        unlocks: AG.STAR_UNLOCKS.filter(u => starsBefore < u.stars && starsAfter >= u.stars)
      };
    },
    /** Shell badges plus a game's own badges (from done({ badgeEvents })). Returns new ones. */
    checkBadges(gameId, gameBadges, events) {
      const s = AG.store.all(), got = s.badges, out = [];
      AG.BADGES.forEach(b => { if (!got[b.id] && b.test(s)) { got[b.id] = Date.now(); out.push(b); } });
      (events || []).forEach(ev => {
        const def = (gameBadges || []).find(b => b.id === ev); const key = gameId + ':' + ev;
        if (def && !got[key]) { got[key] = Date.now(); out.push(def); }
      });
      if (out.length) AG.store.set('badges', got);
      return out;
    },
    badgeCount: () => Object.keys(AG.store.get('badges')).length,
    unlocked: () => AG.STAR_UNLOCKS.filter(u => AG.progress.totalStars() >= u.stars),
    /* ---------- Daily Challenge ---------- */
    todayStamp(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    dailySeed: d => AG.util.seedFromDate(d),
    /** Today's game: the same on every device for the same local date. */
    dailyGame(d) { const list = AG.registry.daily(); return list.length ? list[AG.util.seedFromDate(d) % list.length] : null; }
  };
  if (typeof module !== 'undefined') module.exports = rules;
})(typeof window !== 'undefined' ? (window.AG = window.AG || {}) : { util: {} });
