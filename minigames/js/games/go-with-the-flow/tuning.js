/* 17 Go With the Flow (go-with-the-flow): every number, art key and sound in one place. Pure data, no drawing.
 * The pressure recipe itself (the per-second rules, stars, score, badges) is js/logic/go-with-the-flow/pressure.js, the model and the scene are
 * CrowdScene.js, the buddy and the marshals Buddy.js / Marshals.js, the five levels levels.json, the walkable masks the starter file
 * assets/games/go-with-the-flow/data/maps.json. Distances are map px (960 × 540, 20 px cells); the canvas is 480 × 270. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const G = AG.goWithTheFlow = AG.goWithTheFlow || {};
  const K = 'go-with-the-flow.';

  G.tuning = {
    id: 'go-with-the-flow',
    W: 480, H: 270, mapW: 960, mapH: 540, cell: 20,
    hearts: 3,
    camera: { dzw: 110, dzh: 60 },                        // the deadzone around the player where the view does not scroll
    player: { speed: 70, brace: 0.7, r: 6 },               // brace: speed × 0.7. Follow-finger speed is the same number.
    drag: { free: 3, per: 0.07, min: 0.4 },                // a packed crowd slows everyone alike: speed × (1 − 0.07 per agent above 3)
    carry: { free: 4, span: 6, k: 0.9 },                   // above 4 agents near you the crowd carries you with the flow (up to its own speed × 0.9)
    crowd: {
      count: { easy: [80, 90, 100, 110, 120], advanced: [140, 155, 170, 185, 200] },
      speed: [30, 33, 37, 41, 45],                         // px/s towards the exits (the agents spread ±15 %)
      exitRate: [5, 5, 4, 4, 6],                           // people per second the exits let through: the rest queue (the crush)
      sepRadius: 11, push: 11, floor: 40, maxMul: 1.6, step: 1 / 30,
      thin: { ms: 3000, r: 40 }                            // after a lost heart: nobody stands within 40 px of the checkpoint for 3 s
    },
    buddy: { speed: 75, follow: 60, lost: 100, lostMs: 2000, hold: 21, meetSpeed: 60, r: 5, drag: { free: 3, per: 0.09, min: 0.3 } },
    marshal: { r: 60, ms: 350, minSpeed: 10, show: 80 },
    item: { r: 15 },
    star: { r: 12 },
    checkpoint: { r: 40 },
    fall: { tapGuard: 150 },
    parSec: [40, 45, 50, 55, 60],                          // the time bonus is 5 points per second under this
    art: {
      map: n => K + 'map.' + ['hallway', 'procession', 'stadium', 'doors', 'surge'][n - 1],
      crowd: ['a', 'b', 'c', 'd'].map(v => K + 'crowd.' + v + '_2f'),
      marshal: K + 'marshal_2f', meet: K + 'meetpoint', pressure: K + 'ui.pressure'
    },
    sfx: ['murmur_loop', 'loud_noise_soft', 'whistle', 'reunite', 'pressure'].map(n => K + 'sfx.' + n),
    sfxKey: { murmur: K + 'sfx.murmur_loop', noise: K + 'sfx.loud_noise_soft', whistle: K + 'sfx.whistle', reunite: K + 'sfx.reunite', pressure: K + 'sfx.pressure' },
    badges: {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
