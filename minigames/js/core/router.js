/* Hash routes on a hazard page (courses.html?hazard=<id>), KALASAG O1. Pure functions:
 * js/ui/game-host.js listens for hashchange and calls AG.host with the parsed route.
 *
 *   ''                    → { view: 'overview' }
 *   '#game'               → { view: 'overview', scroll: true }
 *   '#play/2-3'           → { view: 'play', world: 2, level: 3 }
 *   '#daily'              → { view: 'daily' }
 *   '#unlockAll=1'        → teacher/demo mode; combine as '#game&unlockAll=1'
 *   anything else ('#infographic') → { view: 'overview', other: 'infographic' } */
(function (AG) {
  function parse(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    const parts = raw.split('&');
    const unlockAll = parts.includes('unlockAll=1');
    const main = parts.filter(p => p !== 'unlockAll=1')[0] || '';
    let m;
    if (main === '') return { view: 'overview', unlockAll };
    if (main === 'game') return { view: 'overview', scroll: true, unlockAll };
    if ((m = main.match(/^play\/([1-5])-([1-5])$/))) return { view: 'play', world: +m[1], level: +m[2], unlockAll };
    if (main === 'daily') return { view: 'daily', unlockAll };
    return { view: 'overview', other: main, unlockAll };
  }
  const playHash = (w, l) => '#play/' + w + '-' + l;
  AG.router = { parse, playHash };
  if (typeof module !== 'undefined') module.exports = AG.router;
})(typeof window !== 'undefined' ? (window.AG = window.AG || {}) : {});
