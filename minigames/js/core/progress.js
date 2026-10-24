/* Progress rules: level records, level unlocks, the next level to play, XP, badges, star
 * unlocks and the Daily Challenge seed. The pure rules (AG.progress.rules) take plain data
 * and are tested in kalasag-dev/minigames/tests/; the rest read and write AG.store.
 *
 * - Levels (KALASAG O12, no worlds): 5 levels per game, ids '<gameId>:<n>'. Level 1 is open;
 *   level N+1 opens when level N has ≥ 1 star. Teacher/demo mode (#unlockAll=1) opens all.
 *   Records saved under the old '<gameId>:<w>-<l>' ids are ignored (no migration).
 * - XP = max(5, round(score / 10)) + stars × 5 + bonusXP (effort is never worth zero). It is
 *   added to the SITE's XP (KALASAG O6); ranks are computed from the site XP by the host.
 * - Star unlocks (O4): 15 / 30 / 60 / 120 stars = card frames, 200 = the gold name plate. */
(function (AG) {
  const LEVELS = 5; // KALASAG O12: 5 levels per game (15 stars)
  const S = (en, fil) => ({ en, fil });

  const rules = {
    LEVELS,
    levelId: (gameId, n) => gameId + ':' + n,
    /** True for a current '<gameId>:<n>' record id (old '<gameId>:<w>-<l>' ids are ignored). */
    isLevelId: id => /:[1-5]$/.test(id),
    stars: (levels, gameId, n) => (levels[rules.levelId(gameId, n)] || {}).stars || 0,
    levelOpen(levels, gameId, n, unlockAll) {
      if (!Number.isInteger(n) || n < 1 || n > LEVELS) return false;
      if (n === 1 || unlockAll) return true;
      return rules.stars(levels, gameId, n - 1) >= 1;
    },
    gameStars(levels, gameId) { let n = 0; for (let l = 1; l <= LEVELS; l++) n += rules.stars(levels, gameId, l); return n; },
    totalStars(levels) { let n = 0; for (const k in levels) if (rules.isLevelId(k)) n += levels[k].stars || 0; return n; },
    played: (levels, gameId) => { for (let l = 1; l <= LEVELS; l++) if (levels[rules.levelId(gameId, l)]) return true; return false; },
    /** "Play level 1" for a new game, otherwise "Continue" at the next unplayed open level
     *  (or, when every open level was played, the last open one). */
    nextLevel(levels, gameId, unlockAll) {
      for (let l = 1; l <= LEVELS; l++) if (!levels[rules.levelId(gameId, l)] && rules.levelOpen(levels, gameId, l, unlockAll)) return { level: l, fresh: !rules.played(levels, gameId) };
      let l = LEVELS;
      while (l > 1 && !rules.levelOpen(levels, gameId, l, unlockAll)) l--;
      return { level: l, fresh: false };
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
    { stars: 15, id: 'frame-bronze', name: S('Bronze card frame', 'Bronseng frame ng card') },
    { stars: 30, id: 'frame-silver', name: S('Silver card frame', 'Pilak na frame ng card') },
    { stars: 60, id: 'frame-gold', name: S('Gold card frame', 'Gintong frame ng card') },
    { stars: 120, id: 'frame-rainbow', name: S('Rainbow card frame', 'Bahagharing frame ng card') },
    { stars: 200, id: 'plate-gold', name: S('Gold name plate', 'Gintong name plate') }
  ];

  const levels = () => AG.store.get('levels');
  AG.progress = {
    rules,
    level: (gameId, n) => levels()[rules.levelId(gameId, n)] || null,
    levelOpen: (gameId, n, unlockAll) => rules.levelOpen(levels(), gameId, n, unlockAll),
    gameStars: gameId => rules.gameStars(levels(), gameId),
    totalStars: () => rules.totalStars(levels()),
    played: gameId => rules.played(levels(), gameId),
    nextLevel: (gameId, unlockAll) => rules.nextLevel(levels(), gameId, unlockAll),
    xpFor: rules.xp,
    /** Saves one finished level. Returns what changed so the results screen can celebrate it. */
    record(gameId, hazardId, n, res, mode) {
      const s = AG.store.all();
      const id = rules.levelId(gameId, n);
      const prev = s.levels[id];
      const starsBefore = rules.totalStars(s.levels);
      if (mode === 'daily') {
        const key = AG.progress.todayStamp() + ':' + gameId;
        s.daily[key] = { best: Math.max((s.daily[key] || {}).best || 0, res.score || 0) };
      } else {
        s.levels[id] = rules.merge(prev, res);
      }
      s.last = { gameId, hazardId, level: n };
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
