/* Hazard Symbol Jigsaw: level 5, the sliding-tile puzzle. Same level flow as the jigsaw (Round in JigsawScene.js:
 * scene, reveal, question, upwind finale, home card, results), but the puzzle is the pieces engine's SlidingBoard
 * over AG.logic.SlidingTilePuzzle: 3 × 3 on Easy, 4 × 4 on Advanced, a seeded shuffle that is always solvable, and a
 * timer. Arrows slide a tile INTO the gap; tap a tile next to the gap. 💡 Peek shows the faint picture for a moment.
 * There are no misplacements here, so the counter shows moves. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SJ = AG.symbolJigsaw, T = SJ.tuning, SC = SJ.scoring, P = AG.pieces, STR = SJ.STR;
  const K = 'symbol-jigsaw.';
  const pick = v => AG.pick(v);

  class SlideScene extends SJ.Round {
    counterLabel() { return STR.moves; }

    async prepare() {
      const { spec, sign } = this;
      AG.sfx.preload(['slide', 'reveal'].map(k => K + 'sfx.' + k));
      this.grid = await P.cutGrid(sign.art, { cols: spec.cols, rows: spec.rows });
      const rec = await AG.assets.loadImage(sign.art);
      this.peekArt = SJ.ditherCanvas(rec.ok ? rec.img : P.canvas(this.grid.tw * spec.cols, this.grid.th * spec.rows), this.grid.tw * spec.cols, this.grid.th * spec.rows, T.ghost);
    }

    startPuzzle() {
      const { ctx, spec } = this;
      this.puzzle = new AG.logic.SlidingTilePuzzle({ cols: spec.cols, rows: spec.rows, seed: ctx.seed + SJ.util.hash(this.sign.id) });
      this.board = new P.SlidingBoard({
        puzzle: this.puzzle, tiles: this.grid.tiles, maxScale: T.maxScale, label: { en: 'Sliding tiles' },
        sfx: { slide: K + 'sfx.slide', bump: 'soft' },
        onMove: () => { this.counter = this.puzzle.moves; this.hud.set({ label: this.counter }); this.react('think', 400); }, // moves are shown, never counted as mistakes
        onSolved: () => { this.board.enabled = false; this.puzzleDone(); }
      });
      this.peekBox = h('div', { class: 'sj-peek', hidden: true }, P.copy(this.peekArt, 2, 'sj-peek__art'));
      this.peekBox.firstChild.setAttribute('role', 'img'); this.peekBox.firstChild.setAttribute('aria-label', pick(STR.peekAlt));
      const peek = h('button', { type: 'button', class: 'ag-btn ag-btn--alt sj-peekbtn' }, AG.ui.icon('bulb', 18, '', 'sj-ico'), h('span', {}, pick(STR.peek)));
      this.offs.push(SJ.onPress(peek, () => this.peek()));
      this.puzzleHost.append(this.board.el, this.peekBox, peek);
      this.say(STR.slidePick, { par: SC.mmss(this.par * 1000) });
      this.hud.set({ label: 0 });
      this.board.focus();
    }
    peek() {
      if (!this.peekBox || this.over) return;
      this.peekBox.hidden = false;
      clearTimeout(this.peekT);
      this.peekT = setTimeout(() => { if (this.peekBox) this.peekBox.hidden = true; }, T.peekMs);
      if (this.board) this.board.focus();
    }
    teardownPuzzle() {
      clearTimeout(this.peekT);
      if (this.board) { this.board.enabled = false; this.board.destroy(); this.board = null; }
    }
  }

  SJ.SlideScene = SlideScene;
})(window.AG);
