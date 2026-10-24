/* AG.CharacterRig — the player character in every game, for all six characters.
 *
 *   const rig = new AG.CharacterRig(stage, ctx.characterId, 'side' | 'top' | 'portrait', { height: 48 });
 *   rig.play('run');  rig.play('hold:radio');  rig.play('carry:water')
 *   rig.setFacing('left');  rig.setGear('hard_hat');  rig.blink(800)
 *   rig.draw(ctx2d, x, y, tSeconds)   side: y = the feet line; top: y = the centre
 *   rig.img(2)                         portrait view: an <img> of the current action
 *   rig.hitbox()                       the same for every character (fairness)
 *
 * Actions (GOVERNING "CHARACTER ART & THE RIG", with KALASAG O4: AGILA is always geared):
 *   idle walk run jump fall slide crawl duck_cover hold_on cover_head cover_mouth mask_on
 *   stop wave point look_left look_right alert oops worried think happy cheer wink
 *   hold:<prop> carry:<icon>
 * The heroes have no walk, jump, crawl or gear frames: they use the fallbacks in the table
 * (the prototype's bob / lean / squash, a gear icon beside them). A missing frame falls
 * back to idle with one console warning. AG.rig.resolve() is the pure lookup (tested in
 * kalasag-dev/minigames/tests/). */
window.AG = window.AG || {};
(function (AG) {
  const G = f => f + '_geared';
  const AGILA = {
    idle: { frame: G('pose_idle') },
    walk: { frames: [G('pose_run_flap_1'), G('pose_run_flap_2')], fps: 6 },
    run: { frames: [G('pose_run_flap_1'), G('pose_run_flap_2')], fps: 10 },
    jump: { frame: G('pose_run_flap_1'), airborne: true },
    fall: { frame: G('pose_closed_wings'), airborne: true },
    slide: { frame: G('pose_low_crawl') }, crawl: { frame: G('pose_low_crawl') },
    duck_cover: { frame: G('pose_duck_cover') }, hold_on: { frame: G('pose_duck_cover') }, cover_head: { frame: G('pose_duck_cover') },
    cover_mouth: { frame: G('pose_wing_over_beak') },
    mask_on: { frame: G('prop_on_face_mask') },
    stop: { frame: G('pose_stop_wing') },
    wave: { frame: G('pose_point') }, point: { frame: G('pose_point') },
    look_left: { frame: G('pose_head_flip_1') }, look_right: { frame: G('pose_head_flip_2') },
    alert: { frame: G('pose_alert') },
    oops: { frame: G('prop_on_sweat_drop') }, worried: { frame: G('prop_on_sweat_drop') },
    think: { frame: G('prop_on_magnifier') },
    happy: { frame: 'expr_happy_geared' }, cheer: { frame: 'expr_happy_geared', hop: 2 }, wink: { frame: 'expr_wink_geared' }
  };
  const SQUAD = {
    idle: { frame: 'pose_idle' },
    walk: { frame: 'pose_idle', moving: true }, run: { frame: 'pose_idle', moving: true },
    jump: { frame: 'pose_cheer', airborne: true }, fall: { frame: 'pose_alert', airborne: true },
    slide: { frame: 'pose_duck_cover' }, crawl: { frame: 'pose_duck_cover' },
    duck_cover: { frame: 'pose_duck_cover' }, hold_on: { frame: 'pose_duck_cover' }, cover_head: { frame: 'pose_duck_cover' },
    cover_mouth: { frame: 'expr_determined', icon: 'facemask', at: 'head' },
    mask_on: { frame: 'pose_idle', icon: 'facemask', at: 'head' },
    stop: { frame: 'pose_alert', emoji: '✋', at: 'side' },
    wave: { frame: 'pose_wave' }, point: { frame: 'pose_point' },
    look_left: { frame: 'pose_idle', flip: true }, look_right: { frame: 'pose_idle', flip: false },
    alert: { frame: 'pose_alert' },
    oops: { frame: 'expr_worried' }, worried: { frame: 'expr_worried' },
    think: { frame: 'expr_determined' },
    happy: { frame: 'expr_happy' }, cheer: { frame: 'pose_cheer' }, wink: { frame: 'expr_wink' }
  };
  /* hold:<prop>: heroes have six prop frames; AGILA has no geared prop frames, so she
   * (and any other prop) stands idle with the prop's icon beside her. */
  const SQUAD_PROPS = { radio: 'prop_radio', first_aid: 'prop_first_aid', go_bag: 'prop_go_bag', flashlight: 'prop_flashlight', megaphone: 'prop_megaphone', extinguisher: 'prop_extinguisher' };
  const ACTIONS = Object.keys(AGILA).concat(['hold:radio', 'hold:first_aid', 'hold:go_bag', 'hold:flashlight', 'hold:whistle', 'carry:water']);

  /** Pure lookup: which frame and extras an action uses for a character. */
  function resolve(characterId, action, t) {
    const c = AG.chars.get(characterId), table = c.agila ? AGILA : SQUAD;
    const idle = c.agila ? G('pose_idle') : 'pose_idle';
    let row, extra = {};
    if (action && action.startsWith('hold:')) {
      const prop = action.slice(5);
      row = !c.agila && SQUAD_PROPS[prop] ? { frame: SQUAD_PROPS[prop] } : { frame: idle, icon: prop, at: 'side' };
    } else if (action && action.startsWith('carry:')) {
      row = { frame: idle, moving: !c.agila, icon: action.slice(6), at: 'above' };
    } else row = table[action];
    if (!row) { AG.warnOnce('rig:' + action, 'unknown rig action', action, '→ idle'); row = { frame: idle }; }
    const tt = Math.max(0, t || 0); // a time just before the action started counts as its start
    let frame = row.frame;
    if (row.frames) frame = row.frames[Math.floor(tt * row.fps) % row.frames.length];
    return Object.assign({ frame, flip: row.flip, icon: row.icon, emoji: row.emoji, at: row.at, hop: row.hop ? (Math.floor(tt * 4) % 2 ? row.hop : 0) : 0, moving: !!row.moving, airborne: !!row.airborne }, extra);
  }

  const GEAR_ICONS = { hard_hat: 'hard_hat', vest: 'vest', mask: 'facemask', facemask: 'facemask', whistle: 'whistle', go_bag: 'go_bag' };

  class CharacterRig {
    constructor(stage, characterId, view, opts) {
      opts = opts || {};
      this.stage = stage; this.id = characterId || AG.chars.selected(); this.view = view || 'side';
      this.height = opts.height || 48;
      this.facing = this.view === 'top' ? 'down' : 'right';
      this.action = 'idle'; this.t0 = 0; this.gear = null; this.blinkUntil = 0; this.opts = {};
      AG.chars.preload(this.id);
    }
    get agila() { return !!AG.chars.get(this.id).agila; }
    play(action, opts) { if (action === this.action && !(opts && opts.restart)) return this; this.action = action; this.opts = opts || {}; this.t0 = performance.now() / 1000; return this; }
    setFacing(f) { this.facing = f; return this; }
    /** Gear: AGILA is always geared (no-op). Heroes show the gear's icon beside them. */
    setGear(id) { this.gear = this.agila ? null : (id || null); return this; }
    blink(ms) { this.blinkUntil = performance.now() + (ms || 800); return this; }
    /** Identical for all six characters, so timing and collisions never depend on the choice. */
    hitbox() { return this.view === 'top' ? { w: 14, h: 14 } : { w: AG.chars.bodyWidth(this.height), h: Math.round(this.height * 0.6) }; }
    info(t) { return resolve(this.id, this.action, t - this.t0); }

    draw(ctx, x, y, t) {
      t = t == null ? performance.now() / 1000 : t;
      const r = this.info(t);
      const alpha = performance.now() < this.blinkUntil && !AG.reducedMotion() ? (Math.floor(t * 12) % 2 ? 0.3 : 1) : 1;
      if (this.view === 'top') {
        ctx.save(); ctx.globalAlpha = alpha;
        const moving = ['walk', 'run'].includes(this.action);
        const hop = moving ? Math.floor(t * 8) % 2 : 0; // 1 px step bob
        AG.chars.drawTop(ctx, this.id, x, y, this.facing, { t, moving, hop });
        ctx.restore();
        return;
      }
      const flip = r.flip != null ? r.flip : this.facing === 'left';
      AG.chars.drawFrame(ctx, this.id, r.frame, x, y, this.height, { flip, t, moving: r.moving, airborne: r.airborne, hop: r.hop, alpha, squash: this.opts.squash });
      const headY = y - this.height - 4;
      if (r.icon || r.emoji) {
        const ix = r.at === 'side' ? x + (flip ? -1 : 1) * (this.height * 0.4) - 9 : x - 9;
        const iy = r.at === 'above' ? headY - 18 : r.at === 'head' ? headY + 6 : y - this.height * 0.6;
        if (r.emoji) ctx.drawImage(AG.pixelIcon(r.emoji, 18, true), Math.round(ix), Math.round(iy));
        else AG.gfx.drawIcon(ctx, r.icon, ix, iy, 1);
      }
      if (this.gear && GEAR_ICONS[this.gear]) AG.gfx.drawIcon(ctx, GEAR_ICONS[this.gear], x + this.height * 0.3, headY + 2, 1);
    }

    /** Portrait view (menus, cards, dialogue): the pedestal frame for heroes, geared AGILA. */
    img(scale, cls) {
      const r = this.info(performance.now() / 1000);
      return AG.chars.img(this.id, r.frame, scale || 1, cls);
    }
  }

  AG.CharacterRig = CharacterRig;
  AG.rig = { ACTIONS, resolve, AGILA, SQUAD };
})(window.AG);
