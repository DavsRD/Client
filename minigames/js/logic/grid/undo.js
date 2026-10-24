/* E1 GRID ENGINE — UndoStack, pure (no DOM). Tested in kalasag-dev/minigames/tests/grid.test.js.
 *
 *   const undo = new AG.logic.UndoStack({ limit: 200, onChange })
 *   undo.push({ undo() {…}, redo() {…}, label })   command style: undo() / redo() call them
 *   undo.push({ from: …, to: … })                  data style: the game applies what comes back
 *   undo.undo() → the entry (or null)   undo.redo() → the entry (or null)
 *   undo.canUndo  undo.canRedo  undo.size  undo.used (successful undos, e.g. "zero undo" stars)
 *   undo.peek()  undo.clear()
 * A new push drops the redo list. Past the limit the oldest entry is forgotten. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  class UndoStack {
    constructor(opts) {
      opts = opts || {};
      this.limit = opts.limit || 200; this.onChange = opts.onChange || null;
      this.done = []; this.undone = []; this.used = 0;
    }
    get canUndo() { return this.done.length > 0; }
    get canRedo() { return this.undone.length > 0; }
    get size() { return this.done.length; }
    peek() { return this.done.length ? this.done[this.done.length - 1] : null; }
    push(entry) {
      this.done.push(entry); this.undone.length = 0;
      if (this.done.length > this.limit) this.done.shift();
      this.changed('push', entry);
      return entry;
    }
    undo() {
      const e = this.done.pop();
      if (!e) return null;
      if (typeof e.undo === 'function') e.undo();
      this.undone.push(e); this.used++;
      this.changed('undo', e);
      return e;
    }
    redo() {
      const e = this.undone.pop();
      if (!e) return null;
      if (typeof e.redo === 'function') e.redo();
      this.done.push(e);
      this.changed('redo', e);
      return e;
    }
    /** Forget everything (a new level). used is kept unless resetUsed. */
    clear(resetUsed) { this.done.length = 0; this.undone.length = 0; if (resetUsed) this.used = 0; this.changed('clear', null); }
    changed(kind, entry) { if (this.onChange) this.onChange({ kind, entry, canUndo: this.canUndo, canRedo: this.canRedo, size: this.size }); }
  }

  AG.logic.UndoStack = UndoStack;
  if (typeof module !== 'undefined') module.exports = UndoStack;
})(typeof window !== 'undefined' ? window : globalThis);
