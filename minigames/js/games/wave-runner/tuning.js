/* 03 Wave Runner (wave-runner): every number and every art key in one place (speeds, the wave, the head start, scoring, power-ups,
 * the three scene looks). Pure data, no drawing: the rules that use it are in rules.js, the run in WaveRunnerScene.js, the
 * warning at the start in IntroScene.js. The E3 side-scroll engine does the running. Tested in wave-runner.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const WR = AG.waveRunner = AG.waveRunner || {};
  const TK = 'wave-runner.tiles.', BG = 'wave-runner.bg.', K = 'wave-runner.';

  const tuning = {
    id: 'wave-runner',
    hearts: 3,
    rigH: 42,                                  // AGILA draws her 40 px frames at 1×; the heroes at 0.4× (100×130 → 40×52): whole pixels
    px: 25,                                    // 25 px = 1 m
    /* run speed px/s, level 1 → 5 */
    speed: { easy: [130, 140, 150, 160, 170], advanced: [160, 175, 190, 205, 220] },
    /* the wave: speed = factor × the runner's nominal run speed; rubber-band x 1.05 when it is more than 350 px behind */
    chaser: { easy: 0.92, advanced: 0.97, rubber: { gap: 350, factor: 1.05 }, w: 160, h: 210, frames: 4, fps: 6 },
    /* the second wave of level 5 (starts behind after the mid checkpoint) */
    wave2: { gap: 330, plus: 0.03 },           // 3 % faster than the first wave, so it matters if you are slowed
    /* head start: gap = baseGap + max(0, 2.0 − reaction) × 60; no press in 4 s = the run starts alone with baseGap */
    baseGap: { easy: 210, advanced: 150 }, headPerSec: 60, reactionWindow: 2.0, autoMs: 4000,
    /* endless: +2 % speed per 100 m, never more than +50 % */
    endless: { perHundred: 0.02, cap: 1.5, bandEvery: 3, hearts: 3 },
    checkpointEvery: 3,
    score: { perMetre: 10, coin: 10, reactionMax: 300, noHit: 500, wait: 200, waitRetry: 100 },
    stars: { reaction: 2 },                    // 2 stars: at most 1 heart lost AND a reaction under 2 s
    /* power-ups: 10 % per chunk slot */
    power: { chance: 0.10, kinds: ['helmet', 'shoes', 'magnet'], helmetHits: 1, shoesMs: 10000, magnetMs: 10000, magnetR: 100 },
    badges: { quickSec: 0.8, quickCount: 5, waitCount: 10 },
    introMs: { warnAt: 700, quakeMs: 1800, retreatMs: 2600 },
    toastEveryMs: 2500,
    /* a power-up pickup's look */
    icons: { helmet: 'helmet', shoes: 'shoes', magnet: '🧲', coin: 'star', pet: '🐾' },

    /* art keys per scene: the tile set and the three parallax layers (sky, far, near) */
    scenes: {
      beach: {
        bg: [{ key: BG + 'beach_1_sky', factor: 0 }, { key: BG + 'beach_2_far', factor: 0.2 }, { key: BG + 'beach_3_near', factor: 0.5 }],
        end: [{ key: BG + 'hill_2_far', factor: 0.2 }, { key: BG + 'hill_3_near', factor: 0.5 }]      // fades in as the hill gets near
      },
      town: {
        bg: [{ key: BG + 'town_1_sky', factor: 0 }, { key: BG + 'town_2_far', factor: 0.2 }, { key: BG + 'town_3_near', factor: 0.5 }]
      },
      night: {
        bg: [{ key: BG + 'night_1_sky', factor: 0 }, { key: BG + 'night_2_far', factor: 0.2 }, { key: BG + 'night_3_near', factor: 0.5 }],
        dark: { radius: 130, color: '#0a0b1f', rings: 3, ringWidth: 4 }
      }
    },
    tiles: {
      groundTop: TK + 'street_top', ground: TK + 'street', block: TK + 'crate', oneway: TK + 'oneway', ladder: TK + 'ladder',
      stairs: TK + 'stairs', crumble: TK + 'crumble_2f', moving: TK + 'raft', checkpoint: K + 'flag_2f'
    },
    art: {
      wave: K + 'wave_4f', flag: K + 'flag_2f', sign: K + 'sign_route', intro: ['calm', 'shake', 'retreat', 'roar'].map(n => K + 'intro.' + n),
      sfx: ['roar', 'rush_loop', 'checkpoint', 'jump', 'hit'].map(n => K + 'sfx.' + n)
    },
    warnings: ['shake', 'retreat', 'roar']
  };

  WR.tuning = tuning;
  if (typeof module !== 'undefined') module.exports = tuning;
})(typeof window !== 'undefined' ? window : globalThis);
