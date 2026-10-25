/* Go Bag Tetris — PACK PUZZLE (levels 1–3): the calm mode. Every item waits on the shelf; there is no clock to
 * beat (the time only counts for a Pro Packer sticker). Undo is on. Finish with Pack it! (it asks once more if
 * something you need is still on the shelf). Hints come from the solver (js/logic/go-bag-tetris/solve.js): the
 * spot for the biggest thing still to pack, or the decoy / extra that is in the way.
 * Plugs into GoBagScene.js:  new AG.goBag.PackPuzzle(scene). */
window.AG = window.AG || {};
(function (AG) {
  const GB = AG.goBag, GS = AG.logic.goBagSolve, SH = AG.logic.pieceShape;
  const pick = v => AG.pick(v);

  class PackPuzzle {
    constructor(scene) { this.s = scene; this.flagT = 0; }
    build() {}
    /** The role expert reads each scenario card in turn (L3). */
    start() {
      const s = this.s;
      s.cardEls.forEach((c, i) => s.timers.push(setTimeout(() => { if (!s.ended) s.readCard(c.s); }, 700 + i * 3800)));
    }
    canFinish() { return true; }
    isFront() { return false; }
    frontOnBelt() { return null; }
    picked() {}
    placed() {}
    returned() {}
    tossed() {}
    pause() {}

    hint() {
      const s = this.s, STR = GB.STR;
      const left = s.needed.filter(p => p.state !== 'placed').sort((a, b) => SH.size(b.shape) - SH.size(a.shape));
      if (!left.length) {
        // everything needed is in: is there room for a useful extra?
        const extra = s.pieces.find(p => s.kind(p) === 'nice' && s.tray.has(p) && s.nearestFit(p));
        if (extra) { const n = s.nearestFit(extra); s.showSpot(extra, n.x, n.y, n.rot); return s.sayHint(STR.hintTry, { name: extra.label }); }
        return s.sayHint(STR.hintDone);
      }
      const solve = free => GS.solve({ mask: s.spec.mask, pieces: left.map(p => ({ id: p.id, shape: p.data.shape })), blocked: s.blockedCells(free), maxNodes: 400000 });
      const r = solve([]);
      if (r.ok) {
        const p = left[0], at = r.placements.find(q => q.id === p.id);
        s.showSpot(p, at.x, at.y, at.rot);
        return s.sayHint(STR.hintTry, { name: p.label });
      }
      // something that doesn't belong is in the way: decoys first, then extras
      const extras = s.board.pieces.filter(p => !s.isNeeded(p)).sort((a, b) => (s.kind(a) === 'decoy' ? 0 : 1) - (s.kind(b) === 'decoy' ? 0 : 1));
      const culprit = extras.find(e => solve([e]).ok) || (extras.length && solve(extras).ok ? extras[0] : null);
      if (culprit) { this.flag(culprit); return s.sayHint(STR.hintRemove, { name: pick(culprit.data.label) }); }
      s.sayHint(STR.hintStuck);
    }
    /** A dashed frame on a bag item for a few seconds. */
    flag(p) {
      clearTimeout(this.flagT);
      this.s.board.pieces.forEach(q => q.el.classList.remove('gb-flag'));
      p.el.classList.add('gb-flag');
      this.flagT = setTimeout(() => p.el.classList.remove('gb-flag'), GB.tuning.hintMs);
    }
    stop() { clearTimeout(this.flagT); }
    destroy() { this.stop(); }
  }

  GB.PackPuzzle = PackPuzzle;
})(window.AG);
