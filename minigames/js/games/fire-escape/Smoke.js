/* Fire Escape Maze — SMOKE and the COUGH meter (World 2+). Pure (no DOM), tested in
 * fire-escape.test.js.
 *
 *   const cough = new AG.fireEscape.CoughMeter({ fillPerS: 0.25, decayPerS: 0.1, coughEveryS: 1.1 })
 *   cough.update(dt, inSmoke, crawling) → 'full' | 'cough' | null
 *   cough.value (0–1)  cough.max (the highest it reached this run)  cough.reset()
 *
 * Upright in smoke fills the meter by fillPerS (+25 % a second: full in 4 s). Crawling in
 * smoke adds nothing. Out of the smoke it slowly empties. 'cough' comes about once a second
 * while it is filling (the rig's oops + the cough sound); 'full' sends the player back to
 * the last checkpoint (the scene resets the meter). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};

  class CoughMeter {
    constructor(o) {
      o = o || {};
      this.fillPerS = o.fillPerS == null ? 0.25 : o.fillPerS;
      this.decayPerS = o.decayPerS == null ? 0.1 : o.decayPerS;
      this.coughEveryS = o.coughEveryS || 1.1;
      this.value = 0; this.max = 0; this.sinceCough = Infinity;
    }
    update(dt, inSmoke, crawling) {
      if (inSmoke && !crawling) {
        this.value = Math.min(1, this.value + this.fillPerS * dt);
        this.max = Math.max(this.max, this.value);
        this.sinceCough += dt;
        if (this.value >= 1) return 'full';
        if (this.sinceCough >= this.coughEveryS) { this.sinceCough = 0; return 'cough'; }
        return null;
      }
      this.sinceCough = Infinity;
      if (!inSmoke) this.value = Math.max(0, this.value - this.decayPerS * dt);
      return null;
    }
    reset() { this.value = 0; this.sinceCough = Infinity; }
  }

  FE.CoughMeter = CoughMeter;
  if (typeof module !== 'undefined') module.exports = CoughMeter;
})(typeof window !== 'undefined' ? window : globalThis);
