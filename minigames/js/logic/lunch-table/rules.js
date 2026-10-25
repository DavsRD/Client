/* 18 Lunch Table Logic: the seating rules, pure (no DOM). Tested in
 * kalasag-dev/minigames/tests/lunch-table.test.js. Attaches to AG.logic.lunchRules.
 *
 *   const board = L.buildBoard(level)            seats as a graph: tables, seats, adjacency, aisle seats
 *   const ctx = { board, ids, students, seating, attrs }   seating: studentId → seatId | null
 *   L.evaluate(rule, ctx)  → 'met' | 'broken' | 'pending'      (partial = true: only what can never be undone)
 *   L.summary(rules, ctx)  → { statuses, met, total, happiness, solved, moods, alone }
 * Rule types: nobodyAlone, withFriendly(id), sameTable(a,b), shareInterest(a,b,trait), apart(a,b),
 * besides(a,b), tableSize(min,max), accessibleSeat(id), fairTeams(attr,tol). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const MET = 'met', BROKEN = 'broken', PENDING = 'pending';

  /* ---------- the seat graph ---------- */
  function cellsOf(t) {
    const out = [];
    if (t.shape === 'row') for (let i = 0; i < t.n; i++) out.push({ c: i, r: 0 });
    else if (t.shape === 'col') for (let i = 0; i < t.n; i++) out.push({ c: 0, r: i });
    else if (t.shape === 'rows') for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) out.push({ c, r });
    else if (t.shape === 'ring') { // clockwise round the edge of a cols × rows block
      const w = t.cols, h = t.rows;
      for (let c = 0; c < w; c++) out.push({ c, r: 0 });
      for (let r = 1; r < h; r++) out.push({ c: w - 1, r });
      if (h > 1) for (let c = w - 2; c >= 0; c--) out.push({ c, r: h - 1 });
      if (w > 1) for (let r = h - 2; r >= 1; r--) out.push({ c: 0, r });
    } else throw new Error('unknown table shape ' + t.shape);
    return out;
  }
  const sizeOf = t => (t.shape === 'row' ? { w: t.n, h: 1 } : t.shape === 'col' ? { w: 1, h: t.n } : { w: t.cols, h: t.rows });

  /** level.tables: [{ id, name, shape: 'row' | 'col' | 'rows' | 'ring', n | cols, rows, x, y, aisle: 'ends' | [1-based seats] }] */
  function buildBoard(level) {
    const seats = {}, tables = [], order = [];
    let W = 0, H = 0;
    for (const t of level.tables) {
      const cells = cellsOf(t), sz = sizeOf(t), ids = cells.map((_, i) => t.id + '.' + (i + 1));
      const adj = ids.map(() => []);
      const link = (i, j) => { if (!adj[i].includes(ids[j])) { adj[i].push(ids[j]); adj[j].push(ids[i]); } };
      if (t.shape === 'ring') { for (let i = 0; i < ids.length; i++) if (ids.length > 1) link(i, (i + 1) % ids.length); }
      else for (let i = 1; i < ids.length; i++) if (cells[i].r === cells[i - 1].r && cells[i].c === cells[i - 1].c + 1 || cells[i].c === cells[i - 1].c && cells[i].r === cells[i - 1].r + 1) link(i - 1, i);
      const aisle = new Set();
      if (t.aisle === 'ends') cells.forEach((cell, i) => { if (t.shape === 'row' || t.shape === 'col' ? i === 0 || i === ids.length - 1 : t.shape === 'rows' && (cell.c === 0 || cell.c === t.cols - 1)) aisle.add(i); });
      else (t.aisle || []).forEach(n => aisle.add(n - 1));
      cells.forEach((cell, i) => {
        seats[ids[i]] = { id: ids[i], table: t.id, i, c: cell.c, r: cell.r, x: t.x + cell.c, y: t.y + cell.r, adj: adj[i], aisle: aisle.has(i) };
        order.push(ids[i]);
      });
      tables.push({ id: t.id, name: t.name, shape: t.shape, x: t.x, y: t.y, w: sz.w, h: sz.h, seats: ids, aisle: ids.filter((_, i) => aisle.has(i)) });
      W = Math.max(W, t.x + sz.w); H = Math.max(H, t.y + sz.h);
    }
    order.sort((a, b) => seats[a].y - seats[b].y || seats[a].x - seats[b].x);
    const tableById = {}; tables.forEach(t => { tableById[t.id] = t; });
    return { seats, tables, tableById, order, w: level.cols || W, h: level.rows || H };
  }

  /* ---------- reading a seating ---------- */
  /** Where a student sits. A virtual seat 'T.*' means "somewhere at table T" (the solver's first pass). */
  function loc(ctx, sid) {
    if (!sid) return null;
    const s = ctx.board.seats[sid];
    if (s) return { table: s.table, seat: s };
    return sid.endsWith('.*') ? { table: sid.slice(0, -2), seat: null } : null;
  }
  const allSeated = ctx => ctx.ids.every(id => ctx.seating[id]);
  const friendly = (ctx, id) => !!(ctx.students[id] && (ctx.students[id].traits || []).includes('friendly'));
  /** tableId → [studentIds] for every occupied table. */
  function groups(ctx) {
    const g = {};
    for (const id of ctx.ids) { const l = loc(ctx, ctx.seating[id]); if (l) (g[l.table] = g[l.table] || []).push(id); }
    return g;
  }
  const sizes = ctx => { const g = groups(ctx); return Object.keys(g).map(k => g[k].length); };
  const both = (ctx, a, b) => { const la = loc(ctx, ctx.seating[a]), lb = loc(ctx, ctx.seating[b]); return la && lb ? [la, lb] : null; };

  /* ---------- the nine rules ---------- */
  const CHECKS = {
    /** every occupied table has ≥ 2; still waiting students keep it pending */
    nobodyAlone(r, ctx, partial) {
      const s = sizes(ctx);
      if (!partial && s.some(n => n === 1)) return BROKEN;
      if (!allSeated(ctx)) return PENDING;
      return s.every(n => n >= 2) ? MET : BROKEN;
    },
    /** at least one OTHER friendly 😊 student at the table (waiting friendly students keep it pending) */
    withFriendly(r, ctx) {
      const l = loc(ctx, ctx.seating[r.id]);
      if (!l) return PENDING;
      if (groups(ctx)[l.table].some(o => o !== r.id && friendly(ctx, o))) return MET;
      return ctx.ids.some(o => o !== r.id && !ctx.seating[o] && friendly(ctx, o)) ? PENDING : BROKEN;
    },
    sameTable(r, ctx) { const p = both(ctx, r.a, r.b); return !p ? PENDING : p[0].table === p[1].table ? MET : BROKEN; },
    /** the same as sameTable; the level data makes sure both really have the interest (validateLevel) */
    shareInterest(r, ctx) { return CHECKS.sameTable(r, ctx); },
    /** "give space today": different tables */
    apart(r, ctx) { const p = both(ctx, r.a, r.b); return !p ? PENDING : p[0].table !== p[1].table ? MET : BROKEN; },
    /** side by side: adjacent seats (a virtual seat only knows the table) */
    besides(r, ctx) {
      const p = both(ctx, r.a, r.b);
      if (!p) return PENDING;
      if (p[0].table !== p[1].table) return BROKEN;
      return p[0].seat && p[1].seat ? (p[0].seat.adj.includes(p[1].seat.id) ? MET : BROKEN) : MET;
    },
    tableSize(r, ctx) {
      const s = sizes(ctx), max = r.max == null ? Infinity : r.max, min = r.min || 1;
      if (s.some(n => n > max)) return BROKEN;
      if (!allSeated(ctx)) return PENDING;
      return s.every(n => n >= min) ? MET : BROKEN;
    },
    /** a wheelchair user sits at an aisle-end seat */
    accessibleSeat(r, ctx) {
      const l = loc(ctx, ctx.seating[r.id]);
      if (!l) return PENDING;
      return (l.seat ? l.seat.aisle : ctx.board.tableById[l.table].aisle.length > 0) ? MET : BROKEN;
    },
    /** teams = occupied tables: the totals of a numeric attribute differ by at most tol */
    fairTeams(r, ctx) {
      if (!allSeated(ctx)) return PENDING;
      const g = groups(ctx), vals = ctx.attrs && ctx.attrs[r.attr] || {};
      const totals = Object.keys(g).map(k => g[k].reduce((n, id) => n + (vals[id] || 0), 0));
      return totals.length >= 2 && Math.max(...totals) - Math.min(...totals) <= (r.tol || 0) ? MET : BROKEN;
    }
  };
  const TYPES = Object.keys(CHECKS);

  function evaluate(rule, ctx, partial) {
    const f = CHECKS[rule.type];
    if (!f) throw new Error('unknown rule type ' + rule.type);
    return f(rule, ctx, !!partial);
  }

  /** The students a rule is about; the table-level rules (nobodyAlone, tableSize, fairTeams) name nobody. */
  const involves = rule => [rule.a, rule.b, rule.id].filter(Boolean);
  const isSeatRule = rule => rule.type === 'besides' || rule.type === 'accessibleSeat';

  /** Totals per occupied table for fairTeams: { tableId: n } (for the team captions). */
  function teamTotals(ctx, attr) {
    const g = groups(ctx), vals = ctx.attrs && ctx.attrs[attr] || {}, out = {};
    Object.keys(g).forEach(k => { out[k] = g[k].reduce((n, id) => n + (vals[id] || 0), 0); });
    return out;
  }

  /** 'neutral' (waiting, or a rule about them is still open) · 'lonely' (alone at a table)
   *  · 'sad' (a rule about them is broken) · 'happy'. */
  function moods(rules, ctx, statuses) {
    const g = groups(ctx), out = {};
    for (const id of ctx.ids) {
      const l = loc(ctx, ctx.seating[id]);
      if (!l) { out[id] = 'neutral'; continue; }
      if (g[l.table].length === 1) { out[id] = 'lonely'; continue; }
      let broken = false, open = false;
      rules.forEach((r, i) => {
        const st = statuses[i];
        if (involves(r).includes(id)) { if (st === BROKEN) broken = true; else if (st === PENDING) open = true; }
        else if (r.type === 'tableSize' && r.max != null && g[l.table].length > r.max) broken = true;
      });
      out[id] = broken ? 'sad' : open ? 'neutral' : 'happy';
    }
    return out;
  }

  function summary(rules, ctx) {
    const statuses = rules.map(r => evaluate(r, ctx));
    const met = statuses.filter(s => s === MET).length;
    const g = groups(ctx), alone = [];
    Object.keys(g).forEach(k => { if (g[k].length === 1) alone.push(g[k][0]); });
    return {
      statuses, met, total: rules.length, happiness: rules.length ? met / rules.length : 0,
      solved: allSeated(ctx) && met === rules.length, moods: moods(rules, ctx, statuses), alone
    };
  }

  /* ---------- rule text (kind: nobody is described as unkind) ---------- */
  /** data = { templates: { type: { en } }, traits: { id: { icon, en } }, adult: 'Teacher Mae' }; names: id → display name. */
  function describe(rule, names, data) {
    const T = data.templates, tr = (data.traits || {})[rule.trait] || {};
    const tpl = rule.text || (rule.type === 'tableSize' && (rule.min || 1) <= 1 ? T.tableSizeMax : T[rule.type]);
    const vars = {
      a: names[rule.a || rule.id], b: names[rule.b], adult: rule.adult || data.adult,
      min: rule.min, max: rule.max, tol: rule.tol, icon: tr.icon, trait: tr.en
    };
    return { en: tpl.en.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k]))) };
  }

  /** Problems with a level entry (empty = fine): unknown students or rules, interests nobody has, a wheelchair seat for
   *  someone without one, more students than seats, missing team numbers. */
  function validateLevel(level, studentMap) {
    const errs = [], ids = level.students || [];
    const has = id => ids.includes(id);
    ids.forEach(id => { if (!studentMap[id]) errs.push('unknown student ' + id); });
    if (new Set(ids).size !== ids.length) errs.push('a student is listed twice');
    let board = null;
    try { board = buildBoard(level); } catch (e) { errs.push(e.message); }
    if (board && ids.length > board.order.length) errs.push('more students than seats');
    (level.rules || []).forEach((r, i) => {
      const tag = 'rule ' + (i + 1) + ' (' + r.type + '): ';
      if (!CHECKS[r.type]) { errs.push(tag + 'unknown type'); return; }
      involves(r).forEach(id => { if (!has(id)) errs.push(tag + id + ' is not in this level'); });
      if (r.type === 'shareInterest' && [r.a, r.b].some(id => !((studentMap[id] || {}).traits || []).includes(r.trait))) errs.push(tag + 'both need the ' + r.trait + ' interest');
      if (r.type === 'accessibleSeat' && !(studentMap[r.id] || {}).wheelchair) errs.push(tag + r.id + ' has no wheelchair');
      if (r.type === 'accessibleSeat' && board && !board.tables.some(t => t.aisle.length)) errs.push(tag + 'no aisle seat on the board');
      if (r.type === 'fairTeams' && !ids.every(id => level.attrs && level.attrs[r.attr] && typeof level.attrs[r.attr][id] === 'number')) errs.push(tag + 'every student needs a number for ' + r.attr);
      if (r.type === 'withFriendly' && !ids.some(id => id !== r.id && ((studentMap[id] || {}).traits || []).includes('friendly'))) errs.push(tag + 'nobody friendly to sit with');
      if ((r.type === 'apart' || r.type === 'sameTable' || r.type === 'besides' || r.type === 'shareInterest') && r.a === r.b) errs.push(tag + 'needs two different students');
    });
    return errs;
  }

  const api = {
    MET, BROKEN, PENDING, TYPES,
    buildBoard, loc, groups, allSeated, evaluate, involves, isSeatRule, summary, moods, teamTotals, describe, validateLevel
  };
  AG.logic.lunchRules = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
