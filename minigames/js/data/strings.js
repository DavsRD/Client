/* Shell strings for the game overview, play shell, pause menu and results, in English and
 * Filipino. Read with AG.t(key, vars). Game content lives in each game's data as { en, fil }.
 * Debug panels (?debug=…) are developer tools and stay in English.
 * The Filipino still needs a native-speaker review, like the rest of the site. */
window.AG = window.AG || {};
(function (AG) {
  const S = (en, fil) => ({ en, fil });
  AG.STRINGS = {
    /* overview */
    'ov.eyebrow': S('{genre} · Mini-game', '{genre} · Mini-game'),
    'ov.howTo': S('How to play', 'Paano laruin'),
    'ov.or': S('or', 'o'),
    'ov.help': S('Controls and help', 'Kontrol at tulong'),
    'ov.save': S('Save game for offline', 'I-save ang laro para sa offline'),
    'ov.saving': S('Saving… {pct}%', 'Sine-save… {pct}%'),
    'ov.saved': S('Saved for offline', 'Naka-save para sa offline'),
    'ov.saveFailed': S("Couldn't save. Try again", 'Hindi na-save. Subukang muli'),
    'ov.soonTitle': S('Coming soon', 'Malapit na'),
    'ov.soonText': S('Agila is still building this game. Watch the video and read the lesson while you wait!', 'Ginagawa pa ni Agila ang larong ito. Manood ng video at basahin ang aralin habang naghihintay!'),
    'ov.loading': S('Loading the game…', 'Inihahanda ang laro…'),

    /* character selection */
    'pick.title': S('Choose your character', 'Piliin ang iyong karakter'),
    'pick.sub': S('Change any time, even between games', 'Puwedeng palitan kahit kailan, kahit sa pagitan ng mga laro'),
    'pick.label': S('Play as {name}', 'Maglaro bilang {name}'),
    'pick.intro': S("I'm **{name}**! {role} · {gear}. {bio} Every game works with every character.", 'Ako si **{name}**! {role} · {gear}. {bio} Gumagana ang bawat laro sa bawat karakter.'),
    'pick.expert': S('{name} will help you in this game.', 'Tutulungan ka ni {name} sa larong ito.'),
    'pick.expertSwap': S('You picked {name}, so AGILA will help you in this game.', 'Pinili mo si {name}, kaya si AGILA ang tutulong sa iyo sa larong ito.'),

    /* level + tutorial */
    'lvl.title': S('Level', 'Antas'),
    'lvl.easy': S('Easy', 'Madali'),
    'lvl.advanced': S('Advanced', 'Mahirap'),
    'lvl.tutorial': S('Show the tutorial first', 'Ipakita muna ang tutorial'),

    /* world map */
    'map.title': S('Worlds', 'Mga Mundo'),
    'map.world': S('World {n}', 'Mundo {n}'),
    'map.locked': S('Get {n} more ⭐ in World {w} to open', 'Kumuha ng {n} pang ⭐ sa Mundo {w} para mabuksan'),
    'map.level': S('Level {w}-{l}', 'Antas {w}-{l}'),
    'map.stars': S('{n} of 3 stars', '{n} sa 3 bituin'),
    'map.lockedLevel': S('Locked', 'Naka-lock'),
    'map.demo': S('Teacher mode: every world is open.', 'Teacher mode: bukas ang lahat ng mundo.'),
    'map.poster': S('Poster: {title}', 'Poster: {title}'),
    'map.posterLocked': S('Clear all 5 levels to unlock this world\'s poster', 'Tapusin ang 5 antas para mabuksan ang poster ng mundong ito'),
    'play.start': S('Play {w}-{l}', 'Laruin ang {w}-{l}'),
    'play.continue': S('Continue {w}-{l}', 'Ituloy ang {w}-{l}'),

    /* play shell */
    'sh.back': S('Back to the game overview', 'Bumalik sa pangkalahatang-tanaw ng laro'),
    'sh.pause': S('Pause', 'I-pause'),
    'sh.resume': S('Resume', 'Ituloy'),
    'sh.restart': S('Restart', 'Ulitin'),
    'sh.focus': S('Focus mode', 'Focus mode'),
    'sh.exitFocus': S('Leave focus mode', 'Umalis sa focus mode'),
    'sh.playingAs': S('Playing as', 'Naglalaro bilang'),
    'sh.daily': S('Daily Challenge', 'Hamon ng Araw'),
    'sh.loadFailed': S("This game couldn't start: {msg}", 'Hindi masimulan ang larong ito: {msg}'),
    'sh.locked': S('That level is still locked.', 'Naka-lock pa ang antas na iyan.'),

    /* pause + settings */
    'pause.title': S('Paused', 'Naka-pause'),
    'pause.settings': S('Settings', 'Mga Setting'),
    'pause.quit': S('Quit', 'Umalis'),
    'set.touch': S('Touch controls', 'Touch controls'),
    'set.touch.auto': S('Auto', 'Awtomatiko'),
    'set.touch.always': S('Always', 'Palagi'),
    'set.touch.never': S('Never', 'Hindi kailanman'),
    'set.dpad': S('Show the D-pad', 'Ipakita ang D-pad'),
    'set.autoBrace': S('Auto-brace (the game holds on for you)', 'Auto-brace (ang laro ang kakapit para sa iyo)'),
    'set.bigText': S('Bigger text', 'Mas malaking teksto'),
    'set.plainFont': S('Plain font in messages', 'Simpleng font sa mga mensahe'),
    'set.typewriter': S('Typing text', 'Teksto na parang tinatype'),

    /* intro + tutorial */
    'tut.title': S('Tutorial', 'Tutorial'),
    'tut.skip': S('Skip tutorial', 'Laktawan ang tutorial'),
    'intro.skip': S('Skip', 'Laktawan'),
    'intro.default1': S("Let's play **{title}**! I'm with you.", 'Laruin natin ang **{title}**! Kasama mo ako.'),
    'intro.default2': S('I know this hazard well. Listen for my tips!', 'Kilala ko ang panganib na ito. Pakinggan ang mga tip ko!'),

    /* results */
    'res.perfect': S('Perfect!', 'Perpekto!'),
    'res.wellDone': S('Well done!', 'Magaling!'),
    'res.goodTry': S('Good try!', 'Magandang subok!'),
    'res.score': S('Score', 'Puntos'),
    'res.xp': S('XP', 'XP'),
    'res.time': S('Time', 'Oras'),
    'res.newRank': S('New rank: {rank}!', 'Bagong ranggo: {rank}!'),
    'res.newBest': S('New best score!', 'Bagong pinakamataas na puntos!'),
    'res.badge': S('Badge unlocked: {name}', 'Bagong badge: {name}'),
    'res.unlock': S('Unlocked: {name}', 'Na-unlock: {name}'),
    'res.learned': S('What you learned', 'Ang iyong natutunan'),
    'res.again': S('Play again', 'Maglaro muli'),
    'res.next': S('Next level', 'Susunod na antas'),
    'res.changeChar': S('Change character', 'Palitan ang karakter'),
    'res.backLesson': S('Back to the lesson', 'Bumalik sa aralin'),
    'res.sayWin': S('Well done! {msg}', 'Magaling! {msg}'),
    'res.sayLose': S("Don't give up! {msg} Try again and you will get it.", 'Huwag sumuko! {msg} Subukan muli at kaya mo iyan.'),

    /* help dialog */
    'help.title': S('Controls and help', 'Kontrol at tulong'),
    'help.thisGame': S('This game', 'Ang larong ito'),
    'help.everyGame': S('Every game', 'Bawat laro'),
    'help.action': S('What to do', 'Gagawin'),
    'help.keyboard': S('Keyboard', 'Keyboard'),
    'help.touch': S('Touch', 'Touch'),
    'help.pauseRow': S('Pause', 'I-pause'),
    'help.focusRow': S('Focus mode (full screen)', 'Focus mode (buong screen)'),
    'help.choiceRow': S('Pick an answer card', 'Pumili ng sagot'),
    'help.messages': S('What the message boxes mean', 'Ano ang ibig sabihin ng mga kahon ng mensahe'),
    'help.credits': S('Credits', 'Pagkilala'),
    'help.creditChars': S('Characters: the READY SQUAD and Agila the eagle.', 'Mga karakter: ang READY SQUAD at si Agila ang agila.'),
    'help.creditFonts': S('Fonts: Pixelify Sans and Nunito, under the SIL Open Font License.', 'Mga font: Pixelify Sans at Nunito, sa ilalim ng SIL Open Font License.'),
    'help.creditAudio': S('Music and sounds: made for Kalasag Kids from its teaser theme.', 'Musika at tunog: ginawa para sa Kalasag Kids mula sa teaser theme nito.'),
    'help.creditSafety': S('Safety advice follows PAGASA, PHIVOLCS, NDRRMC, DOH, BFP and MMDA public guidance.', 'Ang payong pangkaligtasan ay batay sa pampublikong gabay ng PAGASA, PHIVOLCS, NDRRMC, DOH, BFP at MMDA.'),
    'help.tapButton': S('the on-screen button', 'ang button sa screen'),

    'common.close': S('Close', 'Isara')
  };
})(window.AG);
