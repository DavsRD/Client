/* Rubble Rescue: signalling by knocking on a pipe.
 *
 *   RR.knock.pattern(rnd, n, gaps) → [0, 350, 1050, …]  knock times in ms (pure)
 *   RR.knock.judge(pattern, taps, tolerance) → { ok, count, errors: [ms…] }  (pure)
 *   const round = new RR.KnockRound({ pattern, tolerance, rest, onPhase(phase), onEnd(result) })
 *   round.update(dt) each frame · round.tap(timeStamp) on Space or a pipe tap · round.draw(g, box)
 *
 * A round: 'lead' (the rescuer's radio call) → 'listen' (the knocks play, shown and heard) →
 * 'answer' (the player knocks back) → onEnd({ ok, rest, count, errors }). The player's knocks
 * are judged by their gaps, not by when the first one lands, so they can start when ready.
 * Space and a tap both pass the DOM event's timeStamp (keydown / pointerdown), so the timing is
 * the same on every device. Playback is driven by the game loop, so it stops while paused;
 * the scene calls restart() on pause so a pattern is never judged across a pause. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const RR = AG.rubbleRescue = AG.rubbleRescue || {};

  /** n knocks; each gap is short or long, with at least one long gap so it is a rhythm. */
  function pattern(rnd, n, gaps) {
    const [short, long] = gaps, out = [0];
    const longAt = 1 + Math.floor(rnd() * (n - 1)); // this gap is always long
    for (let i = 1; i < n; i++) out.push(out[i - 1] + (i === longAt || rnd() < 0.35 ? long : short));
    return out;
  }
  /** Every knock's gap from the first knock must match the pattern's within the tolerance. */
  function judge(pat, taps, tol) {
    if (taps.length !== pat.length) return { ok: false, count: taps.length, errors: [] };
    const errors = taps.map((t, i) => Math.round((t - taps[0]) - pat[i]));
    return { ok: errors.every(e => Math.abs(e) <= tol), count: taps.length, errors };
  }
  RR.knock = { pattern, judge };
  if (typeof module !== 'undefined') module.exports = { pattern, judge };
  if (typeof window === 'undefined') return;

  const T = () => RR.tuning.knock;
  const LIT_MS = 260;

  class KnockRound {
    constructor(o) {
      this.o = o; this.pattern = o.pattern; this.tol = o.tolerance; this.rest = !!o.rest;
      this.restart();
    }
    restart() {
      this.phase = 'lead'; this.t = 0; this.played = 0; this.litAt = []; this.taps = []; this.result = null; this.waited = 0;
      if (this.o.onPhase) this.o.onPhase('lead');
    }
    get last() { return this.pattern[this.pattern.length - 1]; }
    update(dt) {
      if (this.phase === 'done') return;
      this.t += dt * 1000;
      if (this.phase === 'lead' && this.t >= T().leadMs) { this.phase = 'listen'; this.t = 0; this.o.onPhase && this.o.onPhase('listen'); }
      if (this.phase === 'listen') {
        while (this.played < this.pattern.length && this.t >= this.pattern[this.played]) {
          this.litAt[this.played] = performance.now();
          this.played++;
          AG.sfx.play('rubble-rescue.sfx.knock');
        }
        if (this.t >= this.last + 600) { this.phase = 'answer'; this.t = 0; this.o.onPhase && this.o.onPhase('answer'); }
      }
      if (this.phase === 'answer') {
        if (!this.taps.length && this.t >= T().firstTapMs) this.finish();
        else if (this.taps.length && performance.now() - this.taps[0] > this.last + this.tol + T().afterMs) this.finish();
      }
    }
    /** A knock from the player: Space (keydown) or a tap on the pipe (pointerdown). */
    tap(ts) {
      if (this.phase !== 'answer') return false;
      this.taps.push(ts != null ? ts : performance.now());
      AG.sfx.play('rubble-rescue.sfx.knock');
      if (this.taps.length >= this.pattern.length) this.finish();
      return true;
    }
    finish() {
      if (this.phase === 'done') return;
      this.phase = 'done';
      this.result = Object.assign(judge(this.pattern, this.taps, this.tol), { rest: this.rest });
      this.o.onEnd(this.result);
    }

    /** The pattern as knock icons spaced by their timing, the player's knocks below it. */
    draw(g, box) {
      const now = performance.now(), last = this.last || 1, span = box.w - 18;
      const xAt = ms => Math.round(box.x + Math.min(1, ms / last) * span);
      g.fillStyle = 'rgba(30, 21, 56, .72)'; g.fillRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
      g.fillStyle = '#ffd23f'; g.fillRect(box.x - 4, box.y - 4, box.w + 8, 1); g.fillRect(box.x - 4, box.y + box.h + 3, box.w + 8, 1);
      this.pattern.forEach((ms, i) => {
        const lit = this.phase === 'listen' && this.litAt[i] && now - this.litAt[i] < LIT_MS;
        const heard = i < this.played || this.phase === 'answer' || this.phase === 'done';
        g.globalAlpha = lit ? 1 : heard ? 0.75 : 0.3;
        AG.assets.draw(g, 'rubble-rescue.ui.knock', xAt(ms), box.y + (lit ? 1 : 2), 18, 18);
        g.globalAlpha = 1;
      });
      // the player's knocks: a mark each, ✓ / ✗ once judged (shape, not colour alone)
      const t0 = this.taps[0];
      this.taps.forEach((t, i) => {
        const x = xAt(t - t0) + 5, y = box.y + 24;
        if (this.result && this.result.errors.length) {
          const good = Math.abs(this.result.errors[i]) <= this.tol;
          g.drawImage(AG.pixelIcon(good ? '✔️' : '✖️', 10, true), x - 1, y);
        } else { g.fillStyle = '#ffd23f'; g.fillRect(x, y + 2, 8, 6); g.fillStyle = '#1e1538'; g.fillRect(x, y + 8, 8, 1); }
      });
    }
  }
  RR.KnockRound = KnockRound;
})(typeof window !== 'undefined' ? window : globalThis);
