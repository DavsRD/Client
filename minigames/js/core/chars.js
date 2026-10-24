/* READY SQUAD + AGILA — roster, selection and sprite drawing (ported from the prototype).
 *
 * Art (minigames/assets/):
 *   characters/ready-squad-sprites/<dir>/1x/  5 heroes × 17 frames, 100×130, feet on a pedestal
 *                                              (menus, cards, dialogue portraits)
 *   characters/ready-squad-nobase/<dir>/      the same frames without the pedestal (gameplay);
 *                                              feet on row 112
 *   characters/ready-squad-top/<id>/          top-down minis 20×20, walk_{down,up,right}_2f
 *   agila/*_geared.png                        AGILA, ALWAYS geared (KALASAG O4): 40×40 poses
 *                                              (feet on row 37), 40×38 expressions, 20×15 mini
 *
 * The heroes have no walk, run or jump frames, so movement is drawn from the still frames
 * with a step bob, lean and squash. AGILA has a real two-frame run. js/core/rig.js wraps
 * all of this as AG.CharacterRig. */
window.AG = window.AG || {};
(function (AG) {
  const BASE = AG.path('assets/characters/');
  const AGILA_DIR = AG.path('assets/agila/');
  const FRAMES = ['expr_idle', 'expr_happy', 'expr_wink', 'expr_worried', 'expr_determined',
    'pose_idle', 'pose_wave', 'pose_point', 'pose_cheer', 'pose_duck_cover', 'pose_alert',
    'prop_radio', 'prop_first_aid', 'prop_go_bag', 'prop_flashlight', 'prop_megaphone', 'prop_extinguisher'];
  const AGILA_FRAMES = ['pose_idle_geared', 'pose_run_flap_1_geared', 'pose_run_flap_2_geared', 'pose_closed_wings_geared',
    'pose_low_crawl_geared', 'pose_duck_cover_geared', 'pose_wing_over_beak_geared', 'pose_stop_wing_geared', 'pose_point_geared',
    'pose_head_flip_1_geared', 'pose_head_flip_2_geared', 'pose_alert_geared', 'prop_on_sweat_drop_geared',
    'prop_on_magnifier_geared', 'prop_on_face_mask_geared', 'expr_happy_geared', 'expr_wink_geared'];

  /* Menu / dialogue states → frames. The rig has the full gameplay action table. */
  const SQUAD_STATE = {
    idle: 'pose_idle', talk: 'expr_idle', wave: 'pose_wave', point: 'pose_point', cheer: 'pose_cheer', win: 'pose_cheer',
    happy: 'expr_happy', wink: 'expr_wink', worried: 'expr_worried', oops: 'expr_worried', hurt: 'expr_worried',
    determined: 'expr_determined', think: 'expr_determined', alert: 'pose_alert', duck: 'pose_duck_cover', duck_cover: 'pose_duck_cover'
  };
  const AGILA_STATE = {
    idle: 'pose_idle_geared', talk: 'pose_idle_geared', wave: 'expr_happy_geared', point: 'pose_point_geared',
    cheer: 'expr_happy_geared', win: 'expr_happy_geared', happy: 'expr_happy_geared', wink: 'expr_wink_geared',
    worried: 'prop_on_sweat_drop_geared', oops: 'prop_on_sweat_drop_geared', hurt: 'prop_on_sweat_drop_geared',
    determined: 'pose_stop_wing_geared', think: 'prop_on_magnifier_geared', alert: 'pose_alert_geared',
    duck: 'pose_duck_cover_geared', duck_cover: 'pose_duck_cover_geared'
  };

  const S = (en, fil) => ({ en, fil });
  AG.CHARS = {
    comms: { id: 'comms', name: 'COMMS', role: S('Emergency communication', 'Komunikasyon sa emergency'), gear: S('Emergency radio', 'Radyong pang-emergency'), gearProp: 'prop_radio', icon: 'radio', color: '#3ec7ff', dir: '01_comms', prefix: 'comms_',
      bio: S('Keeps everyone informed. Listens for official alerts and passes on the right message.', 'Pinapaalam sa lahat ang balita. Nakikinig sa opisyal na alerto at ipinapasa ang tamang mensahe.') },
    medic: { id: 'medic', name: 'MEDIC', role: S('First aid', 'Pangunang lunas'), gear: S('First-aid kit', 'First-aid kit'), gearProp: 'prop_first_aid', icon: 'first_aid', color: '#ff6b8b', dir: '02_medic', prefix: 'medic_',
      bio: S('Knows first aid and keeps the kit stocked. Reminds the squad to stay healthy and clean.', 'Marunong ng pangunang lunas at laging puno ang kit. Pinapaalalahanan ang squad na manatiling malusog at malinis.') },
    logistics: { id: 'logistics', name: 'LOGISTICS', role: S('Supplies and go-bags', 'Mga suplay at go bag'), gear: S('Go-bag', 'Go bag'), gearProp: 'prop_go_bag', icon: 'go_bag', color: '#ff9f1c', dir: '03_logistics', prefix: 'logistics_',
      bio: S('Packs the go-bags and tracks supplies, so the squad has what it needs when it is time to leave.', 'Nag-iimpake ng go bag at nagbabantay ng suplay, para handa ang squad kapag oras nang umalis.') },
    rescue: { id: 'rescue', name: 'RESCUE', role: S('Navigation and rescue awareness', 'Pag-alam ng daan at pagsagip'), gear: S('Flashlight + megaphone', 'Flashlight at megaphone'), gearProp: 'prop_megaphone', icon: 'flashlight', color: '#b8ec5a', dir: '04_rescue', prefix: 'rescue_',
      bio: S('Knows the evacuation routes and safe places. Calls trained rescuers instead of taking risks.', 'Alam ang mga daan ng paglikas at ligtas na lugar. Tumatawag sa sinanay na rescuer sa halip na makipagsapalaran.') },
    firesafety: { id: 'firesafety', name: 'FIRE SAFETY', role: S('Fire safety and prevention', 'Kaligtasan at pag-iwas sa sunog'), gear: S('Fire extinguisher', 'Pamatay-sunog'), gearProp: 'prop_extinguisher', icon: 'extinguisher', color: '#ff5a3c', dir: '05_fire_safety', prefix: 'fire_safety_',
      bio: S('Spots fire hazards before they start and knows how to get out fast if a fire happens.', 'Napapansin ang panganib ng sunog bago ito magsimula at alam kung paano lumabas agad kapag may sunog.') },
    agila: { id: 'agila', name: 'AGILA', role: S('Official mascot and preparedness guide', 'Opisyal na maskot at gabay sa kahandaan'), gear: S('Hard hat + safety vest', 'Hard hat at safety vest'), gearProp: 'expr_happy_geared', icon: 'hard_hat', color: '#ffd23f', agila: true,
      bio: S('The AGILA eagle. Guides every lesson and cheers you on when you make a safe choice.', 'Ang agilang si AGILA. Gabay sa bawat aralin at pumapalakpak kapag ligtas ang pinili mo.') }
  };
  AG.CHAR_ORDER = ['comms', 'medic', 'logistics', 'rescue', 'firesafety', 'agila'];

  const get = id => AG.CHARS[id] || AG.CHARS.agila;
  /** A frame name for a menu state (or any frame name passed straight through). */
  function frameName(c, state) {
    if (c.agila) return AGILA_STATE[state] || (AGILA_FRAMES.includes(state) || state === 'mini_top_down_geared' ? state : 'pose_idle_geared');
    return SQUAD_STATE[state] || (FRAMES.includes(state) ? state : 'pose_idle');
  }
  /** Path of a frame. base = the pedestal-free gameplay copy (squad only). */
  function src(id, state, base) {
    const c = get(id), f = frameName(c, state);
    if (c.agila) return AGILA_DIR + f + '.png';
    return base ? BASE + 'ready-squad-nobase/' + c.dir + '/' + c.prefix + f + '.png' : BASE + 'ready-squad-sprites/' + c.dir + '/1x/' + c.prefix + f + '.png';
  }
  const topSrc = (id, facing) => {
    const c = get(id);
    if (c.agila) return AGILA_DIR + 'mini_top_down_geared.png';
    return BASE + 'ready-squad-top/' + c.id + '/walk_' + (facing === 'left' ? 'right' : facing || 'down') + '_2f.png';
  };

  /* image cache for canvas drawing; a missing file falls back to idle with one warning */
  const cache = {};
  function image(path) {
    if (!cache[path]) {
      const i = new Image(); i.decoding = 'async'; i.src = path; cache[path] = i;
      i.addEventListener('error', () => AG.warnOnce('char:' + path, 'missing character frame', path));
    }
    return cache[path];
  }
  const usable = img => img.complete && img.naturalWidth > 0;

  AG.chars = {
    FRAMES, AGILA_FRAMES,
    list: () => AG.CHAR_ORDER.map(id => AG.CHARS[id]),
    get,
    selected() { const id = AG.store.get('character'); return AG.CHARS[id] ? id : 'agila'; },
    select(id) { if (AG.CHARS[id]) { AG.store.set('character', id); AG.emit('ag:character', { id }); } },
    src, topSrc, frameName, image, usable,
    /** Every frame of one character (selection preview and the asset check). */
    frames(id) { return get(id).agila ? AGILA_FRAMES.slice() : FRAMES.slice(); },
    /** Preload one character's gameplay frames. */
    preload(id) {
      const c = get(id);
      const paths = c.agila ? AGILA_FRAMES.map(f => AGILA_DIR + f + '.png').concat(topSrc(id)) : FRAMES.map(f => src(id, f, true)).concat(['down', 'up', 'right'].map(d => topSrc(id, d)));
      return Promise.all(paths.map(p => { const i = image(p); return i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }); }));
    },
    /** <img> of a menu frame. scale is a whole multiple: squad 100×130 × scale, AGILA 40 px × 2 × scale. */
    img(id, state, scale, cls) {
      const c = get(id), s = scale || 1, f = frameName(c, state);
      const w = c.agila ? 80 * s : 100 * s, hgt = c.agila ? (f.startsWith('expr_') ? 76 : 80) * s : 130 * s;
      return AG.util.h('img', { class: 'ag-px ag-charimg ' + (c.agila ? 'is-agila ' : '') + (cls || ''), src: src(id, state), alt: '', width: w, height: hgt, draggable: 'false' });
    },
    /**
     * Draw a character (side view) standing on feetY, using a frame name.
     * height = body height in game px (every character uses the same one in a game).
     * opts: flip, t (seconds), moving (step bob + lean), squash (0..1), airborne, alpha.
     */
    drawFrame(ctx, id, frame, x, feetY, height, opts) {
      opts = opts || {};
      const c = get(id);
      let img = image(c.agila ? AGILA_DIR + frame + '.png' : BASE + 'ready-squad-nobase/' + c.dir + '/' + c.prefix + frame + '.png');
      if (!usable(img)) img = image(c.agila ? AGILA_DIR + 'pose_idle_geared.png' : src(id, 'pose_idle', true));
      if (!usable(img)) return false;
      let w, h, ox, oy;
      if (c.agila) {
        const k = Math.max(1, Math.round(height / 48)); // her 40 px frames at whole multiples
        w = img.naturalWidth * k; h = img.naturalHeight * k; ox = -w / 2; oy = -(img.naturalHeight - 3) * k;
      } else { const k = height / 105; w = 100 * k; h = 130 * k; ox = -w / 2; oy = -112 * k; }
      let bob = 0, lean = 0, sx = 1, sy = 1;
      const t = opts.t || 0;
      if (opts.moving && !opts.airborne && !c.agila) { const ph = Math.sin(t * 16); bob = -Math.abs(ph) * height * 0.05; lean = ph * 0.05; }
      if (opts.hop) bob -= opts.hop;
      if (opts.squash) { sx = 1 + opts.squash * 0.18; sy = 1 - opts.squash * 0.15; }
      if (opts.airborne && !c.agila) { sx = 0.94; sy = 1.06; }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
      ctx.translate(Math.round(x), Math.round(feetY + bob));
      if (lean) ctx.rotate(lean * (opts.flip ? -1 : 1));
      ctx.scale((opts.flip ? -1 : 1) * sx, sy);
      ctx.drawImage(img, Math.round(ox), Math.round(oy), Math.round(w), Math.round(h));
      ctx.restore();
      return true;
    },
    /** Top view, centred on x, y. facing: up | down | left | right. */
    drawTop(ctx, id, x, y, facing, opts) {
      opts = opts || {};
      const c = get(id), img = image(topSrc(id, facing));
      if (!usable(img)) return false;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x), Math.round(y - (opts.hop || 0)));
      if (c.agila) {
        const rot = { down: 0, left: 1, up: 2, right: 3 }[facing || 'down'] || 0; // 90° steps only
        ctx.rotate(rot * Math.PI / 2);
        ctx.drawImage(img, -10, -8, 20, 15);
      } else {
        const frame = opts.moving ? Math.floor((opts.t || 0) * 6) % 2 : 0;
        if (facing === 'left') ctx.scale(-1, 1);
        ctx.drawImage(img, frame * 20, 0, 20, 20, -10, -10, 20, 20);
      }
      ctx.restore();
      return true;
    },
    /** Width of the shared hitbox for a body height (identical for all six). */
    bodyWidth(height) { return Math.round(height * 0.42); }
  };
})(window.AG);
