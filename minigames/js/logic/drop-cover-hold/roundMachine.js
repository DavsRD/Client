/* Drop! Cover! Hold!: the pure round logic (no DOM, no timers: the scene feeds it dt and inputs).
 *   AG.logic.dropCoverHold.plan(levelData, rooms, { difficulty, level, seed }, tuning) → the level's rounds, seeded
 *   new AG.logic.dropCoverHold.RoundMachine(round, tuning).start(); m.update(dtMs); m.choose(spot); m.holdDown();
 *   m.holdUp(); m.pickExit(exit); m.answerCard(ok); m.drain() → events; m.r → the result for the scoring.
 * Phases: calm → warning → choose (or card) → move → hold → release → settle → exit → walk → toast → done,
 * with point (wrong spot / time-out) and an aftershock that can come back during release, settle or exit. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffle = (list, r) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const between = (range, r) => Math.round((range[0] + r() * (range[1] - range[0])) / 100) * 100;

  /** The level's rounds. The first listed round always comes first (level 1 starts very easy); the rest are shuffled
   *  by the seed. Easy drops the doorway myth and keeps the first N decoys; Advanced offers every exit of the room. */
  function plan(levelData, rooms, o, T) {
    T = T || AG.dropCoverHold.tuning;
    const diff = o.difficulty === 'advanced' ? 'advanced' : 'easy', L = clamp(o.level || levelData.level || 1, 1, 5), li = L - 1;
    const r = rng(o.seed);
    const list = levelData.rounds;
    const order = [list[0]].concat(shuffle(list.slice(1), r));
    return order.map((rd, i) => {
      const room = rooms[rd.room];
      if (!room) throw new Error('rooms.json has no room ' + rd.room);
      const rolls = [r(), r(), r(), r()]; // always the same draws, whatever this round uses
      const objs = (rd.spots || room.objects.map(x => x.id)).map(id => {
        const ob = room.objects.find(x => x.id === id);
        if (!ob) throw new Error(rd.room + ' has no spot ' + id);
        return Object.assign({}, ob, rd.override && rd.override[id]);
      });
      const cap = diff === 'easy' && rd.decoys != null ? rd.decoys : T.decoys[diff][li];
      let decoys = 0;
      const spots = objs.filter(ob => (ob.kind === 'myth' ? diff === 'advanced' : ob.kind === 'decoy' ? decoys++ < cap : true));
      const exitIds = diff === 'advanced' ? room.exits.slice(0, 4).map(e => e.id) : rd.exits;
      const exits = exitIds.map(id => { const e = room.exits.find(x => x.id === id); if (!e) throw new Error(rd.room + ' has no exit ' + id); return e; });
      const aftershock = !!rd.aftershock || (diff === 'advanced' && L !== 4 && !(L === 1 && i === 0) && rolls[0] < T.aftershock.advancedChance);
      return {
        index: i, room: rd.room, roomData: room, special: rd.special || null, difficulty: diff, level: L,
        spots, exits, aftershock,
        chooseMs: T.chooseMs[diff][li], warnMs: T.warnMs[diff], graceMs: T.graceMs[diff],
        holdMs: between(T.holdMs, () => rolls[1]),
        afterDelay: between(T.aftershock.delayMs, () => rolls[2]), afterLen: between(T.aftershock.lengthMs, () => rolls[3]),
        glow: diff === 'easy' && L <= T.glowLevels,
        cover: spots.find(s => s.kind === 'safe') || null,
        mythPresent: spots.some(s => s.kind === 'myth')
      };
    });
  }

  class RoundMachine {
    constructor(round, T) {
      this.s = round; this.T = T || AG.dropCoverHold.tuning;
      this.phase = null; this.t = 0; this.now = 0; this.events = [];
      this.holding = false; this.everHeld = false; this.graceFrom = 0;
      this.shake = null; this.quakeShake = null; this.quake = null;
      this.pending = !!round.aftershock; this.afterAt = Infinity; this.walkAfterQuake = false;
      this.exitT = 0; this.tries = 0; this.spot = null;
      this.r = {
        room: round.room, spotId: null, spotOk: false, chooseMs: 0, windowMs: round.special === 'wheelchair' ? this.T.cardMs : round.chooseMs,
        fullHold: false, release: null, releaseMs: null, exitTried: false, exitOk: false, exitId: null,
        aftershock: false, aftershockMiss: false, heartsLost: 0, fail: null, mythPresent: !!round.mythPresent, mythAvoided: false
      };
    }
    emit(type, data) { this.events.push(Object.assign({ type }, data)); }
    drain() { const e = this.events; this.events = []; return e; }
    go(phase) { this.phase = phase; this.t = 0; this.emit('phase', { phase }); }
    start() { this.go('calm'); return this; }
    get done() { return this.phase === 'done'; }
    get quaking() { return !!this.quake; }
    /** 0..1: ramps in, holds, eases out (whole-pixel offsets are the scene's job). */
    shakeLevel() {
      const lv = sh => (sh ? Math.min(clamp((this.now - sh.t0) / sh.ramp, 0, 1), sh.end == null ? 1 : clamp((sh.end - this.now) / sh.ease, 0, 1)) * sh.k : 0);
      return Math.max(lv(this.shake), lv(this.quakeShake));
    }
    /** Is the ground moving right now (also true while it is easing out)? */
    get shaking() { return this.shakeLevel() > 0; }
    startShake() { this.shake = { t0: this.now, end: null, ramp: this.T.rampMs, ease: this.T.easeMs, k: 1 }; this.emit('shake'); }
    windowLeft() {
      if (this.phase === 'choose') return 1 - this.t / this.s.chooseMs;
      if (this.phase === 'exit') return 1 - this.exitT / this.T.exitMs;
      if (this.quake && !this.quake.rehold && !this.quake.miss) return 1 - (this.quake.t - this.quake.from) / this.T.aftershock.reholdMs;
      return null;
    }

    update(dt) {
      if (!this.phase || this.phase === 'done') return;
      const T = this.T, s = this.s;
      this.now += dt; this.t += dt;
      if (this.quake) this.updateQuake(dt);
      else if (this.pending && this.now >= this.afterAt && (this.phase === 'release' || this.phase === 'settle' || this.phase === 'exit')) this.beginQuake();
      switch (this.phase) {
        case 'calm': if (this.t >= T.calmMs) this.go('warning'); break;
        case 'warning': if (this.t >= s.warnMs) { this.startShake(); this.go(s.special === 'wheelchair' ? 'card' : 'choose'); } break;
        case 'choose': if (this.t >= s.chooseMs) this.fail('timeout'); break;
        case 'move':
          if (this.t >= T.moveMs) { this.everHeld = this.holding; this.graceFrom = 0; this.shake.end = this.now - (this.t - T.moveMs) + s.holdMs; this.go('hold'); }
          break;
        case 'hold':
          if (!this.everHeld && this.t - this.graceFrom >= s.graceMs) this.fail('letgo');
          else if (this.now >= this.shake.end) {
            this.r.fullHold = true; this.stopAt = this.shake.end;
            if (this.pending) this.afterAt = this.stopAt + s.afterDelay;
            this.emit('stop');
            this.go('release');
            this.t = this.now - this.stopAt;
          }
          break;
        case 'release': if (this.t >= T.release.max) this.graded(this.t); break;
        case 'settle': if (!this.quake && this.t >= T.settleMs) this.go('exit'); break;
        case 'exit': if (!this.quake && !this.r.exitTried) { this.exitT += dt; if (this.exitT >= T.exitMs) this.pickExit(null); } break;
        case 'walk': if (this.t >= T.walkMs) this.go('toast'); break;
        case 'point': if (this.t >= T.pointMs) this.go('toast'); break;
        case 'toast': if (this.t >= T.toastMs) this.go('done'); break;
      }
    }

    /* ----- inputs (keyboard and touch call the same methods) ----- */
    /** CHOOSE: a cover spot (any selectable object, safe or not). */
    choose(spot) {
      if (this.phase !== 'choose' || !spot) return false;
      this.r.spotId = spot.id; this.r.chooseMs = this.t;
      if (spot.kind === 'safe') {
        this.r.spotOk = true; this.r.mythAvoided = this.r.mythPresent; this.spot = spot;
        this.emit('spot', { spot, ok: true }); this.go('move');
      } else { this.emit('spot', { spot, ok: false }); this.fail('wrong', spot); }
      return true;
    }
    /** Wheelchair round: the instruction card. Right on the first try = the spot points; a wrong card costs nothing. */
    answerCard(ok) {
      if (this.phase !== 'card') return false;
      this.tries++;
      if (!ok) { this.emit('card', { ok: false }); return true; }
      this.r.spotOk = this.tries === 1; this.r.chooseMs = this.t; this.r.spotId = this.s.cover && this.s.cover.id; this.spot = this.s.cover;
      this.emit('card', { ok: true, firstTry: this.tries === 1 }); this.go('move');
      return true;
    }
    holdDown() {
      if (this.holding) return;
      this.holding = true; this.emit('hold', { down: true });
      if (this.phase === 'hold') this.everHeld = true;
      const q = this.quake;
      if (q && !q.rehold && !q.miss) { q.rehold = true; this.emit('rehold', { ms: q.t - q.from }); }
    }
    holdUp() {
      if (!this.holding) return;
      this.holding = false; this.emit('hold', { down: false });
      const q = this.quake;
      if (q) { if (q.rehold && !q.miss) this.quakeMiss('early'); return; }
      if (this.phase === 'hold' && this.everHeld) this.fail('letgo');
      else if (this.phase === 'release') this.graded(this.t);
    }
    /** EXIT: an exit, or null when the time ran out. A pending aftershock comes back right as the player sets off. */
    pickExit(exit) {
      if (this.phase !== 'exit' || this.quake || this.r.exitTried) return false;
      this.r.exitTried = true; this.r.exitId = exit ? exit.id : null; this.r.exitOk = !!exit && exit.kind === 'safe';
      this.emit('exit', { exit, ok: this.r.exitOk, timeout: !exit });
      if (this.pending) { this.walkAfterQuake = true; this.beginQuake(); } else this.go('walk');
      return true;
    }
    /** After a pause (keys and buttons are released by the shell): a fresh chance to take hold again. */
    regrab() {
      this.holding = false;
      if (this.phase === 'hold') { this.everHeld = false; this.graceFrom = this.t; }
      const q = this.quake;
      if (q && !q.miss) {
        const A = this.T.aftershock;
        q.rehold = false; q.from = q.t;
        if (q.len < q.t + A.reholdMs + 500) { q.len = q.t + A.reholdMs + 500; this.quakeShake.end = this.now + A.reholdMs + 500; }
      }
    }

    /* ----- inside ----- */
    graded(ms) {
      const R = this.T.release;
      this.r.release = ms <= R.perfect ? 'perfect' : ms <= R.good ? 'good' : 'late';
      this.r.releaseMs = Math.round(ms);
      this.emit('release', { grade: this.r.release, ms: this.r.releaseMs });
      this.go('settle');
    }
    fail(kind, spot) {
      this.r.fail = kind; this.r.heartsLost++;
      if (this.shake && (this.shake.end == null || this.shake.end > this.now + this.T.easeMs)) this.shake.end = this.now + this.T.easeMs;
      this.pending = false;
      this.emit('fail', { kind, spot: spot || null });
      this.go(kind === 'letgo' ? 'toast' : 'point');
    }
    beginQuake() {
      const A = this.T.aftershock;
      this.pending = false; this.r.aftershock = true;
      if (this.phase === 'release') this.graded(this.t); // still holding when it came back: no longer a quick release
      this.quake = { t: 0, from: 0, len: this.s.afterLen, rehold: this.holding, miss: false };
      this.quakeShake = { t0: this.now, end: this.now + this.s.afterLen, ramp: A.rampMs, ease: A.easeMs, k: 0.7 };
      this.emit('aftershock', { holding: this.holding });
    }
    updateQuake(dt) {
      const q = this.quake;
      q.t += dt;
      if (!q.rehold && !q.miss && q.t - q.from >= this.T.aftershock.reholdMs) this.quakeMiss('late');
      if (q.t >= q.len) {
        this.quake = null;
        this.emit('aftershockEnd', { ok: !q.miss });
        if (this.walkAfterQuake) { this.walkAfterQuake = false; this.go('walk'); }
      }
    }
    quakeMiss(why) {
      const q = this.quake;
      q.miss = true; this.r.aftershockMiss = true; this.r.heartsLost++;
      this.emit('aftershockMiss', { why });
    }
  }

  AG.logic.dropCoverHold = { plan, RoundMachine, rng, shuffle };
  if (typeof module !== 'undefined') module.exports = AG.logic.dropCoverHold;
})(typeof window !== 'undefined' ? window : globalThis);
