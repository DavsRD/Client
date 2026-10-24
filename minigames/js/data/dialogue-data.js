/* READY SQUAD + AGILA — speakers, word-box styles and the message library (ported from the
 * prototype; every text is { en, fil }). Text supports:
 *   **word**      → highlighted emphasis
 *   :icon_name:   → a small inline pixel icon (any name in js/data/icons.js)
 * Add a message by pushing to a category's `items`, or a category with AG.dialogue.addCategory(). */
window.AG = window.AG || {};
(function (AG) {
  const S = (en, fil) => ({ en, fil });
  /* Each message style shows a matching frame: happy for success, determined for retry,
   * pointing for instructions, alert for warnings. AGILA always uses her geared frames. */
  const SQUAD_FRAMES = { standard: 'expr_idle', success: 'expr_happy', encouragement: 'expr_wink', retry: 'expr_determined', instruction: 'pose_point', warning: 'pose_alert', info: 'expr_idle', congratulations: 'pose_cheer' };
  const AGILA_FRAMES = { standard: 'pose_idle_geared', success: 'expr_happy_geared', encouragement: 'expr_wink_geared', retry: 'pose_point_geared', instruction: 'pose_point_geared', warning: 'pose_alert_geared', info: 'pose_idle_geared', congratulations: 'expr_happy_geared' };

  AG.SPEAKERS = {};
  AG.CHAR_ORDER.forEach(id => {
    const c = AG.CHARS[id];
    AG.SPEAKERS[id] = { name: c.name, role: c.role, item: c.gear, icon: c.icon, color: c.color, agila: !!c.agila, frames: c.agila ? AGILA_FRAMES : SQUAD_FRAMES, w: c.agila ? 40 : 100, h: c.agila ? 40 : 130, person: '' };
  });
  /** Image path for a speaker in a message style (or a specific frame). */
  AG.speakerSrc = (key, style, frame) => {
    const sp = AG.SPEAKERS[key] ? key : 'agila';
    return AG.chars.src(sp, frame || AG.SPEAKERS[sp].frames[style] || AG.SPEAKERS[sp].frames.standard);
  };

  /* Word-box styles. `role` sets the ARIA role: warnings are announced right away. */
  AG.WORDBOX = {
    success: { label: S('Correct!', 'Tama!'), icon: 'check', role: 'status', use: S('Praise and correct answers', 'Papuri at tamang sagot') },
    encouragement: { label: S('Keep going!', 'Ituloy mo!'), icon: 'heart', role: 'status', use: S('Motivation and positive reinforcement', 'Pampasigla') },
    retry: { label: S('Try again!', 'Subukan muli!'), icon: 'retry', role: 'status', use: S('Mistakes and another chance (never a punishment)', 'Mali at panibagong pagkakataon (hindi parusa)') },
    instruction: { label: S('How to play', 'Paano laruin'), icon: 'clipboard', role: 'note', use: S('Directions and explanations', 'Mga tagubilin at paliwanag') },
    warning: { label: S('Safety first', 'Kaligtasan muna'), icon: 'warning', role: 'alert', use: S('Important safety reminders', 'Mahahalagang paalala sa kaligtasan') },
    info: { label: S('Did you know?', 'Alam mo ba?'), icon: 'bulb', role: 'note', use: S('Helpful facts and learning', 'Kapaki-pakinabang na kaalaman') },
    congratulations: { label: S('Congratulations!', 'Binabati kita!'), icon: 'trophy', role: 'status', use: S('Finished tasks and achievements', 'Natapos na gawain at tagumpay') }
  };

  const M = (en, fil, style) => ({ text: S(en, fil), style });
  AG.MESSAGES = {
    positive: {
      label: S('Positive feedback', 'Papuri'), style: 'success', items: [
        M('Very good!', 'Napakagaling!'), M('Good job!', 'Magaling!'), M('Great job!', 'Ang galing mo!'), M('You did it!', 'Nagawa mo!'),
        M("That's correct!", 'Tama iyan!'), M('Well done!', 'Mahusay!'), M('Excellent!', 'Napakahusay!'), M('Awesome!', 'Astig!'),
        M('Great effort!', 'Ang sipag mo!', 'encouragement'), M("You're doing amazing!", 'Ang galing ng ginagawa mo!', 'encouragement'),
        M('Keep it up!', 'Ipagpatuloy mo!', 'encouragement'), M('Keep going!', 'Ituloy mo!', 'encouragement'), M("You're a real hero!", 'Isa kang tunay na bayani!', 'congratulations')]
    },
    encouragement: {
      label: S('Encouragement and retry', 'Pampasigla at muling subok'), style: 'encouragement', items: [
        M('Try again!', 'Subukan muli!', 'retry'), M('Almost there!', 'Malapit na!'), M("Don't give up!", 'Huwag sumuko!'),
        M("Let's try another way!", 'Subukan natin ang ibang paraan!', 'retry'), M('Take your time!', 'Dahan-dahan lang!'),
        M('Think carefully!', 'Mag-isip nang mabuti!', 'retry'), M('You can do it!', 'Kaya mo iyan!'), M('Keep trying!', 'Patuloy na subukan!', 'retry'),
        M("You're getting better!", 'Gumagaling ka na!')]
    },
    safety: {
      label: S('Safety and preparedness', 'Kaligtasan at kahandaan'), style: 'warning', items: [
        M('Stay safe!', 'Mag-ingat!'), M('Be ready. Be safe. Be resilient.', 'Maging handa. Maging ligtas. Maging matatag.', 'info'),
        M('Remember to follow the safety instructions!', 'Tandaang sundin ang mga tagubilin sa kaligtasan!'),
        M('Great choice! You made a **safe decision**.', 'Magandang pili! Gumawa ka ng **ligtas na desisyon**.', 'success'),
        M("Let's review the correct safety procedure.", 'Balikan natin ang tamang paraan para maging ligtas.', 'instruction'),
        M('Being prepared can help protect everyone!', 'Ang pagiging handa ay nakatutulong para protektahan ang lahat!', 'info')]
    },
    instruction: {
      label: S('Instructions and information', 'Mga tagubilin at impormasyon'), style: 'instruction', items: [
        M("Let's get started!", 'Magsimula na tayo!'), M("Here's what you need to know.", 'Ito ang dapat mong malaman.', 'info'),
        M('Remember this important tip!', 'Tandaan ang mahalagang tip na ito!', 'info'), M('Always think about **safety first**.', 'Laging isipin ang **kaligtasan muna**.', 'warning'),
        M("Let's learn something new!", 'Matuto tayo ng bago!', 'info'), M('Every step toward preparedness matters!', 'Mahalaga ang bawat hakbang tungo sa kahandaan!', 'info')]
    }
  };

  /* Each character's own success line (said on the first success of a round). Wording
   * matches the AGILA safety steps; have the school DRRM coordinator approve before class use. */
  AG.CHARACTER_LINES = {
    comms: { style: 'success', text: S('**Great job!** You received the important message! :radio:', '**Magaling!** Natanggap mo ang mahalagang mensahe! :radio:') },
    medic: { style: 'success', text: S('**Well done!** Remember, first aid supplies are important. :first_aid:', '**Mahusay!** Tandaan, mahalaga ang mga gamit pang-first aid. :first_aid:') },
    logistics: { style: 'success', text: S('**You did it!** Being prepared makes a difference. :go_bag:', '**Nagawa mo!** Malaki ang naitutulong ng pagiging handa. :go_bag:') },
    rescue: { style: 'success', text: S('**Excellent!** Always follow safe instructions. :flashlight:', '**Napakahusay!** Laging sundin ang ligtas na tagubilin. :flashlight:') },
    firesafety: { style: 'success', text: S('**Good job!** Remember to put safety first. :extinguisher:', '**Magaling!** Tandaang kaligtasan muna. :extinguisher:') },
    agila: { style: 'success', text: S("**Awesome!** You're learning how to stay safe!", '**Astig!** Natututo kang maging ligtas!') }
  };
})(window.AG);
