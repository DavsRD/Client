/* Evac Convoy: the Daily Challenge (pure, tested in evac-convoy.test.js). generateDaily(seed) gives a plan
 * (seed = YYYYMMDD, so the same on every device); dailyBuild(plan, templates) turns it into a level entry:
 * one of the 10 template maps, seeded residents (1–3 per house, a priority mix) and 2 random closures,
 * with BFS keeping every house reachable. The scene loads data/templates.json and calls dailyBuild. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const EC = AG.evacConvoy = AG.evacConvoy || {};

  EC.generateDaily = function (seed) {
    seed = seed >>> 0;
    const rnd = AG.util.mulberry32(seed ^ 0xec0c);
    return { daily: true, pending: true, seed, level: seed % 5 + 1, template: Math.floor(rnd() * EC.tuning.daily.templates) };
  };

  EC.dailyBuild = function (plan, templates) {
    const T = EC.tuning, D = T.daily, R = EC.rules;
    const rnd = AG.util.mulberry32((plan.seed >>> 0) ^ 0xd41);
    const tpl = templates[plan.template % templates.length];
    const m = R.parse(tpl.map);

    // residents: 1–3 per house, about a third of them priority (at least two in all)
    let residents = m.houses.map(() => {
      const n = D.residents[0] + Math.floor(rnd() * (D.residents[1] - D.residents[0] + 1));
      let p = 0;
      for (let i = 0; i < n; i++) if (rnd() < D.priorityShare) p++;
      return { n, p };
    });
    let total = residents.reduce((s, r) => s + r.p, 0);
    for (let guard = 0; total < D.minPriority && guard < 50; guard++) {
      const r = residents[Math.floor(rnd() * residents.length)];
      if (r.p < r.n) { r.p++; total++; }
    }

    // closures: two road tiles (a tree falls, or a bridge floods) that leave every house reachable
    const closed = new Set(), closures = [];
    const near = (x, y) => m.center.some(c => Math.abs(c.x - x) + Math.abs(c.y - y) <= 2);
    const cand = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const ch = m.at(x, y);
      if ((ch === '.' || ch === 'B') && !near(x, y)) cand.push({ x, y, ch });
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    D.closures.forEach(([lo, hi]) => {
      const at = lo + Math.floor(rnd() * (hi - lo + 1));
      for (let i = 0; i < cand.length; i++) {
        const c = cand[i], k = R.key(c.x, c.y);
        if (closed.has(k)) continue;
        const test = new Set(closed); test.add(k);
        const seen = R.reach(m, test);
        if (m.houses.every(h => seen.has(R.key(h.x, h.y)))) { closed.add(k); closures.push({ at, kind: c.ch === 'B' ? 'bridge' : 'tree', x: c.x, y: c.y }); cand.splice(i, 1); return; }
      }
    });

    // three lost pets on roads, above the water line when there is room
    const spots = cand.filter(c => c.ch === '.' && c.y < tpl.finalRow);
    const pool = spots.length >= D.pets ? spots : cand.filter(c => c.ch === '.');
    const pets = [];
    for (let i = 0; i < D.pets && pool.length; i++) { const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; pets.push({ x: c.x, y: c.y }); }

    const all = residents.reduce((s, r) => s + r.n, 0);
    return {
      daily: true, seed: plan.seed >>> 0, level: plan.level, template: plan.template,
      name: { en: 'Daily convoy' }, map: tpl.map, residents, closures: closures.sort((a, b) => a.at - b.at),
      finalRow: tpl.finalRow, pulse: plan.level === 4 ? [1.3, 0.7, 1.2, 0.6, 1.1, 0.8, 1.2] : [1],
      target: Math.ceil(all * 0.6), pets, night: plan.level === 5
    };
  };

  if (typeof module !== 'undefined') module.exports = { generateDaily: EC.generateDaily, dailyBuild: EC.dailyBuild };
})(typeof window !== 'undefined' ? window : globalThis);
