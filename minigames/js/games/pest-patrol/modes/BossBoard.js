/* Pest Patrol Match — BREEDING-SITE BOSS BOARD (world 5).
 *
 * An Onet board (as in world 4) where some tiles hide dirty mosquito breeding sites: an old
 * tire, a flower vase, a blocked gutter, an open drum. Clearing the tile on top shows the
 * site; select it (Enter or tap) to clean it: "Search & destroy!" and the clean sprite.
 * Win = the board is clear AND every site is clean. The results add the 4S anti-dengue
 * message. Cleaned sites count toward the four-s badge (40 in all). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const PP = AG.pestPatrol, T = PP.tuning, R = PP.rules;
  const S = (en, fil) => ({ en, fil });

  const KINDS = ['tire', 'vase', 'gutter', 'drum'];
  const STR = {
    prompt: S('Clear tiles to find mosquito breeding sites, then select each one to clean it.', 'Mag-alis ng tiles para makita ang pinamumugaran ng lamok, saka piliin ang bawat isa para linisin.'),
    board: S('Breeding-site board', 'Board ng pinamumugaran'),
    start: S('Mosquitoes are hiding eggs in standing water under these tiles. Search and destroy!', 'Nagtatago ang lamok ng itlog sa naipong tubig sa ilalim ng tiles. Hanapin at sirain!'),
    sites: S('Sites cleaned', 'Nalinis na lugar'),
    found: S('A breeding site! Select it to clean it.', 'May pinamumugaran! Piliin ito para linisin.'),
    destroy: S('Search & destroy! No more standing water here.', 'Hanapin at sirain! Wala nang naipong tubig dito.'),
    lastSites: S('Board clear! Now clean the last breeding sites.', 'Malinis ang board! Linisin na ang natitirang pinamumugaran.'),
    dirty: S('Dirty', 'Marumi'), clean: S('Clean', 'Malinis'),
    names: { tire: S('Old tire', 'Lumang gulong'), vase: S('Flower vase', 'Plorera'), gutter: S('Blocked gutter', 'Baradong alulod'), drum: S('Open water drum', 'Bukas na drum') },
    win: S('Board clear and every breeding site is clean!', 'Malinis ang board at ang bawat pinamumugaran!'),
    dirtyLeft: S('Some breeding sites were still dirty. Clean every one to win.', 'May maruming pinamumugaran pa. Linisin lahat para manalo.'),
    fourS: S('Remember the 4S against dengue: Search and destroy breeding sites, use Self-protection (long sleeves, repellent), Seek early check-up for fever, and Support fogging only in hotspot areas.',
      'Tandaan ang 4S laban sa dengue: Hanapin at sirain ang pinamumugaran (Search and destroy), Sariling proteksyon (mahabang manggas, repellent), Sumangguni agad kapag nilagnat (Seek early consultation), at Suportahan ang fogging sa mga hotspot lamang.')
  };

  class BossBoard extends PP.Onet {
    constructor(scene, data) {
      super(scene, data);
      this.str = Object.assign({}, PP.OnetSTR, { prompt: STR.prompt, board: STR.board, start: STR.start });
      this.seconds = T.onet.bossTime[scene.adv ? 'advanced' : 'easy'];
      this.cleaned = 0;
    }
    /** Picks the site cells once the board is dealt. */
    setup() {
      const cells = R.sites(this.board, this.lv.sites || 3, this.s.rnd);
      this.sites = new Map(cells.map((i, k) => [i, { kind: KINDS[k % KINDS.length], clean: false, seen: false }]));
    }
    siteAt(x, y) { return this.sites.get(y * this.board.w + x); }
    under(x, y) {
      const site = this.siteAt(x, y);
      if (!site) return null;
      const state = site.clean ? 'clean' : 'dirty';
      const url = this.s.assetUrl('pest-patrol.breed.' + site.kind + '.' + state);
      return h('span', { class: 'pp-site is-' + state },
        AG.cards.face(url ? { img: url } : { emoji: site.clean ? '✨' : '🪣' }),
        h('b', {}, AG.pick(site.clean ? STR.clean : STR.dirty)));
    }
    decorate(card, tile, i) {
      super.decorate(card, tile, i);
      const site = tile == null && this.sites.get(i);
      if (!site) return;
      card.el.classList.add(site.clean ? 'pp-clean' : 'pp-dirty');
      card.el.setAttribute('aria-label', AG.pick(STR.names[site.kind]) + ', ' + AG.pick(site.clean ? STR.clean : STR.dirty));
      if (!site.clean && !site.seen) { site.seen = true; this.s.ctx.say('warning', STR.found, { ms: T.toastMs }); }
    }
    updateLabel() {
      if (!this.sites) return super.updateLabel();
      this.s.setLabel(STR.sites, this.cleaned + '/' + this.sites.size);
    }
    /** Selecting an uncovered dirty site cleans it. */
    onEmpty({ x, y }) {
      const s = this.s, site = this.siteAt(x, y);
      if (!site || site.clean || s.ended || AG.paused) return;
      site.clean = true; this.cleaned++;
      AG.sfx.play('pest-patrol.sfx.clean');
      s.ctx.say('success', STR.destroy, { sound: false, ms: T.toastMs });
      s.react('cheer', 1200);
      s.ctx.safe();
      this.view.refresh();
      this.updateLabel();
      if (AG.logic.onet.isClear(this.board) && this.extraDone) this.finish(true);
    }
    get extraDone() { return [...this.sites.values()].every(x => x.clean); }
    onClear() {
      if (this.extraDone) { this.finish(true); return; }
      this.s.ctx.say('instruction', STR.lastSites);
    }
    finish(cleared) {
      // a clear board with dirty sites left is not a clear yet (time ran out on the sites)
      super.finish(cleared && this.extraDone);
    }
    finishExtra(passed) {
      const all = this.extraDone, clear = AG.logic.onet.isClear(this.board);
      const msg = clear && all ? STR.win : passed ? PP.OnetSTR.passTime : !all ? STR.dirtyLeft : PP.OnetSTR.lose;
      return {
        sites: this.cleaned,
        detail: [{ label: PP.OnetSTR.cleared, value: Math.round((100 * this.cleared) / this.totalTiles) + '%' }, { label: STR.sites, value: this.cleaned + '/' + this.sites.size }],
        message: { en: msg.en + ' ' + STR.fourS.en, fil: msg.fil + ' ' + STR.fourS.fil },
        learned: [...this.s.facted].map(id => (this.s.sets.get(id) || {}).fact).filter(Boolean).concat([STR.fourS])
      };
    }
  }

  PP.BossBoard = BossBoard;
})(window.AG);
