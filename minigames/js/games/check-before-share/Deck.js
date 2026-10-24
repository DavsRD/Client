/* Check Before You Share: turns data/cards.json into SwipeStack cards.
 *
 *   const deck = new AG.checkShare.Deck(data, { level, expertId, golden })
 *   deck.cards(levelData, rnd)   → SwipeStack card specs, in play order (no long same-side runs)
 *   deck.relabel(root)           re-reads every card text after a language switch
 *   deck.clueText(card)          "ALL CAPS, no source, …" as { en, fil }
 *
 * MESSAGE cards: a chat / radio / note frame (9-slice art), the sender, the text. From level 2
 * the sender's SOURCE BADGE shows and forwarded messages get a "forwarded many times" tag.
 * Official-radio cards show the role expert holding a radio. ACTION cards: "What should you
 * do?" with 🏠. Golden source cards carry a ⭐ in the corner. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const CS = AG.checkShare, R = CS.rules;
  const S = (en, fil) => ({ en, fil });
  const texts = new WeakMap(); // element → { en, fil } (or a function giving one)

  const STR = {
    doWhat: S('What should you do?', 'Ano ang dapat mong gawin?'),
    forwarded: S('↪ Forwarded many times', '↪ Maraming beses nang naipasa'),
    golden: S('Golden source', 'Gintong pinagmulan'),
    from: S('Message from {src}', 'Mensahe mula kay {src}')
  };

  /** A text element that follows the site language. */
  function txt(tag, cls, spec) {
    const el = h(tag, { class: 'cbs-t ' + (cls || '') });
    texts.set(el, spec); el.textContent = AG.pick(typeof spec === 'function' ? spec() : spec);
    return el;
  }
  const both = (spec, f) => ({ en: f(spec.en, 'en'), fil: f(spec.fil || spec.en, 'fil') });
  const assetUrl = (key, w, hgt) => AG.assets.url(key) || (AG.assets.image(key), AG.assets.placeholderURL(key.split('.').pop(), w, hgt));

  class Deck {
    constructor(data, opts) {
      this.data = data; this.opts = opts || {};
      this.byId = new Map(data.cards.map(c => [c.id, c]));
    }
    source(card) { return this.data.sources[card.source] || { badge: 'unknown', name: S('?', '?') }; }
    clueText(card) {
      const list = R.cluesFor(card).map(k => this.data.clues[k]).filter(Boolean);
      return { en: list.map(c => c.en).join(', '), fil: list.map(c => c.fil || c.en).join(', ') };
    }

    cards(levelData, rnd) {
      const list = (levelData.cards || []).map(id => this.byId.get(id)).filter(Boolean);
      return R.order(list, rnd).map(c => ({ id: c.id, data: c, label: this.label(c), render: () => this.render(c) }));
    }
    /** Screen-reader text for the card, in both languages. */
    label(c) {
      if (c.type === 'action') return both(STR.doWhat, (s, l) => s + ' ' + (c.text[l] || c.text.en));
      const src = this.source(c).name;
      return both(STR.from, (s, l) => s.replace('{src}', src[l] || src.en) + ': ' + (c.text[l] || c.text.en));
    }

    render(c) {
      const golden = this.opts.golden && this.opts.golden.has(c.id);
      if (c.type === 'action') {
        return h('div', { class: 'cbs-card cbs-card--action' },
          txt('span', 'cbs-card__eyebrow', STR.doWhat),
          h('img', { class: 'ag-px cbs-card__icon', src: AG.pixelIcon('🏠', 36), alt: '', width: 36, height: 36 }),
          txt('p', 'cbs-card__text', c.text));
      }
      const src = this.source(c), badges = this.opts.level >= 2;
      const head = h('div', { class: 'cbs-card__head' },
        badges ? h('img', { class: 'ag-px cbs-card__badge', src: assetUrl('check-before-share.badge.' + src.badge, 24, 24), alt: '', width: 48, height: 48 }) : null,
        h('span', { class: 'cbs-card__who' },
          txt('b', 'cbs-card__src', src.name),
          badges && c.forwarded ? txt('span', 'cbs-card__fwd', STR.forwarded) : null));
      const el = h('div', { class: 'cbs-card cbs-card--' + (c.frame || 'chat') + (golden ? ' is-golden' : '') }, head, txt('p', 'cbs-card__text', c.text));
      el.style.setProperty('--cbs-frame', 'url("' + assetUrl('check-before-share.card.' + (c.frame || 'chat') + '_9slice', 24, 24) + '")');
      if (c.frame === 'radio') {
        // the role expert reads the official radio news
        const rig = new AG.CharacterRig(null, this.opts.expertId, 'portrait').play('hold:radio');
        const r = rig.info(performance.now() / 1000);
        el.append(h('div', { class: 'cbs-card__host', 'aria-hidden': 'true' }, rig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'cbs-card__prop') : null));
      }
      if (golden) el.append(h('img', { class: 'ag-px cbs-card__star', src: AG.icons.src('star'), alt: '', width: 36, height: 36, title: AG.pick(STR.golden) }));
      return el;
    }

    relabel(root) {
      root.querySelectorAll('.cbs-t').forEach(el => {
        const spec = texts.get(el);
        if (spec) el.textContent = AG.pick(typeof spec === 'function' ? spec() : spec);
      });
    }
  }

  CS.Deck = Deck;
  CS.txt = txt;
})(window.AG);
