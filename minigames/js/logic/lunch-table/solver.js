/* 18 Lunch Table Logic: the backtracking solver, pure (no DOM). Tested in
 * kalasag-dev/minigames/tests/lunch-table.test.js. Needs js/logic/lunch-table/rules.js first.
 *
 *   const m = S.make(level, studentMap)       the level as a model
 *   S.solve(m)            → { ok, seating, par }          first seating that meets every rule
 *   S.nearest(m, seating) → { seating, score }            the solution that agrees most with what is seated now
 *   S.hint(m, seating)    → { rule, student, seat, ... }  one open rule and where to seat one student
 *   S.validate(level, studentMap) → { ok, errors, par, stored }   what the tests run on every level
 * Pass 1 puts students at TABLES (so identical seats are never tried twice); pass 2 finds the seats at each table
 * (only besides and accessibleSeat care which seat). par = the number of students. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const L = AG.logic.lunchRules;

  function make(level, studentMap) {
    const board = L.buildBoard(level), ids = level.students.slice(), students = {};
    ids.forEach(id => { students[id] = studentMap[id] || { id, traits: [] }; });
    return { board, ids, students, rules: level.rules || [], attrs: level.attrs || {} };
  }
  const ctxOf = (m, seating) => ({ board: m.board, ids: m.ids, students: m.students, seating, attrs: m.attrs });

  /** Most-talked-about students first, so a wrong guess fails early. */
  function order(m) {
    const n = {}; m.ids.forEach(id => { n[id] = 0; });
    m.rules.forEach(r => L.involves(r).forEach(id => { n[id] = (n[id] || 0) + (r.type === 'apart' ? 1 : 2); }));
    return m.ids.slice().sort((a, b) => n[b] - n[a] || m.ids.indexOf(a) - m.ids.indexOf(b));
  }

  /** Every way to put the students at tables that no rule can still break (callback gets { id: 'T.*' };
   *  return false to stop). breakSymmetry skips tables that are copies of an empty one. */
  function partitions(m, onFull, opts) {
    opts = opts || {};
    const budget = opts.budget || 200000, seq = order(m), tables = m.board.tables, asg = {}, used = {};
    const ctx = ctxOf(m, asg), sig = t => t.shape + ':' + t.seats.length + ':' + t.aisle.length;
    tables.forEach(t => { used[t.id] = 0; });
    let nodes = 0, stop = false;
    const open = () => m.rules.every(r => L.evaluate(r, ctx, true) !== L.BROKEN);
    (function dfs(k) {
      if (stop || ++nodes > budget) { stop = true; return; }
      if (k === seq.length) { if (m.rules.every(r => L.evaluate(r, ctx, true) === L.MET) && onFull(Object.assign({}, asg)) === false) stop = true; return; }
      const id = seq[k], tried = new Set();
      for (const t of tables) {
        if (used[t.id] >= t.seats.length) continue;
        if (opts.breakSymmetry && used[t.id] === 0) { if (tried.has(sig(t))) continue; tried.add(sig(t)); }
        asg[id] = t.id + '.*'; used[t.id]++;
        if (open()) dfs(k + 1);
        used[t.id]--; delete asg[id];
        if (stop) return;
      }
    })(0);
    return { truncated: nodes > budget };
  }

  /** Seats for one table's students, as close to pref (id → seatId) as the seat rules allow. null when impossible. */
  function seatTable(m, table, group, pref) {
    const rules = m.rules.filter(r => L.isSeatRule(r) && L.involves(r).some(id => group.includes(id)));
    const res = {}, taken = new Set(), ctx = ctxOf(m, res);
    let best = null, bestScore = -1;
    const lead = group.slice().sort((a, b) => (pref && pref[b] ? 1 : 0) - (pref && pref[a] ? 1 : 0));
    (function dfs(k, score) {
      if (bestScore === group.length) return;
      if (k === lead.length) { if (score > bestScore) { bestScore = score; best = Object.assign({}, res); } return; }
      const id = lead[k], wish = pref && pref[id];
      const seats = table.seats.slice().sort((a, b) => (b === wish ? 1 : 0) - (a === wish ? 1 : 0));
      for (const s of seats) {
        if (taken.has(s)) continue;
        taken.add(s); res[id] = s;
        if (rules.every(r => L.evaluate(r, ctx, true) !== L.BROKEN)) dfs(k + 1, score + (s === wish ? 1 : 0));
        taken.delete(s); delete res[id];
      }
    })(0, 0);
    return best && { seating: best, score: bestScore };
  }

  /** A full seating from a table-level partition, or null. */
  function seatAll(m, part, pref) {
    const byTable = {};
    Object.keys(part).forEach(id => { const t = part[id].slice(0, -2); (byTable[t] = byTable[t] || []).push(id); });
    const seating = {};
    let score = 0;
    for (const t of Object.keys(byTable)) {
      const r = seatTable(m, m.board.tableById[t], byTable[t], pref);
      if (!r) return null;
      Object.assign(seating, r.seating); score += r.score;
    }
    return L.summary(m.rules, ctxOf(m, seating)).solved ? { seating, score } : null;
  }

  function solve(m) {
    let found = null;
    partitions(m, part => { found = seatAll(m, part, null); return !found; }, { breakSymmetry: true });
    return found ? { ok: true, seating: found.seating, par: m.ids.length } : { ok: false, seating: null, par: m.ids.length };
  }

  /** How many table-level solutions there are (up to limit, tables that are copies of each other counted once). */
  function count(m, limit) {
    let n = 0;
    partitions(m, part => { if (seatAll(m, part, null)) n++; return n < (limit || 1000); }, { breakSymmetry: true });
    return n;
  }

  function nearest(m, seating) {
    let best = null;
    partitions(m, part => {
      const r = seatAll(m, part, seating);
      if (r && (!best || r.score > best.score)) best = r;
      return !best || best.score < m.ids.length;
    });
    return best;
  }

  /** One open rule (broken before waiting) and a student to move: someone that rule is about who is not where the
   *  nearest solution has them, else anyone who is misplaced. null when already solved. */
  function hint(m, seating) {
    const ctx = ctxOf(m, seating), st = m.rules.map(r => L.evaluate(r, ctx));
    let idx = st.indexOf(L.BROKEN);
    if (idx < 0) idx = st.indexOf(L.PENDING);
    if (idx < 0) return null;
    const near = nearest(m, seating);
    if (!near) return null;
    const off = id => seating[id] !== near.seating[id];
    const who = L.involves(m.rules[idx]).filter(off)[0] || m.ids.filter(off)[0];
    return who ? { rule: idx, student: who, seat: near.seating[who], solution: near.seating } : null;
  }

  /** Does the level hold up? Valid data, a solution the solver finds, a stored solution that really works, par = students. */
  function validate(level, studentMap) {
    const errors = L.validateLevel(level, studentMap);
    if (errors.length) return { ok: false, errors };
    const m = make(level, studentMap), s = solve(m);
    if (!s.ok) errors.push('no seating meets every rule');
    if (level.par !== m.ids.length) errors.push('par should be ' + m.ids.length + ' (the number of students)');
    if (!level.solution) errors.push('no stored solution');
    else if (!L.summary(m.rules, ctxOf(m, level.solution)).solved) errors.push('the stored solution does not meet every rule');
    return { ok: !errors.length, errors, par: m.ids.length, found: s.seating, solutions: errors.length ? 0 : count(m, 500) };
  }

  const api = { make, ctxOf, partitions, seatTable, solve, count, nearest, hint, validate };
  AG.logic.lunchSolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
