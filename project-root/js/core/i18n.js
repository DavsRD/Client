/**
 * i18n.js — English / Filipino interface strings (nav, buttons, labels).
 *
 * Hazard content is NOT here: it lives in the JSON data files as { en, fil }
 * pairs and is read with pick(). Markup opts in with:
 *   data-i18n="key"                       → sets textContent
 *   data-i18n-attr="aria-label:key;title:key2"  → sets attributes
 * Any Filipino string that is missing falls back to English, so nothing renders blank.
 *
 * NOTE: Filipino strings still need a native-speaker review before launch.
 */

import * as state from "./state.js";

const STRINGS = {
  en: {
    "site.name": "Kalasag Kids",
    "site.tagline": "Learning to stay safe, one hazard at a time.",
    "site.skip": "Skip to content",

    "nav.home": "Home",
    "nav.learn": "Learn",
    "nav.collection": "Collections",
    "nav.subject": "Subject",
    "nav.main": "Main",

    "lang.label": "Language",
    "lang.en": "EN",
    "lang.fil": "FIL",

    "emergency.button": "Emergency",
    "emergency.chip": "Emergency? Tap here",
    "emergency.title": "Emergency Hotlines",
    "emergency.intro": "Ask an adult to help you call. Stay calm and say where you are.",
    "emergency.call": "Call",
    "emergency.missing": "Ask your teacher for this number",
    "emergency.national": "National Emergency Hotline",
    "emergency.ndrrmc": "NDRRMC Operations Center",
    "emergency.redcross": "Philippine Red Cross",
    "emergency.pnp": "PNP Emergency Hotline",

    "common.close": "Close",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.comingSoon": "Coming soon",
    "common.hazards": "hazards",
    "common.hazard": "hazard",
    "common.videos": "videos",
    "common.video": "video",
    "common.print": "Print",
    "common.search": "Search",
    "common.all": "All",
    "common.scrollLeft": "Scroll left",
    "common.scrollRight": "Scroll right",

    "welcome.kicker": "Welcome to",
    "welcome.cta": "Enter the Safety Zone",
    "welcome.slide": "Show picture",
    "welcome.pause": "Pause slideshow",
    "welcome.play": "Play slideshow",
    "welcome.aboutTitle": "What is this?",
    "welcome.about1": "Disasters like earthquakes, typhoons, and fires can happen anywhere. Being ready keeps you and your family safe.",
    "welcome.about2": "Here, Agila the eagle helps you learn what to do through short videos, posters, games, and quizzes. It's part of our school's culture of safety and our journey toward the Gawad KALASAG.",
    "welcome.featuresTitle": "What you'll find here",
    "welcome.feature.watch": "Watch",
    "welcome.feature.watchText": "1-minute videos with Agila for every hazard.",
    "welcome.feature.learn": "Learn",
    "welcome.feature.learnText": "Easy steps for before, during, and after.",
    "welcome.feature.play": "Play",
    "welcome.feature.playText": "Mini-games and quizzes that earn you XP.",
    "welcome.feature.connect": "Connect",
    "welcome.feature.connectText": "See how safety links to your school subjects.",
    "welcome.ready": "Ready to be prepared?",

    "dash.jumpBack": "Jump back in",
    "dash.startLabel": "Start here",
    "dash.startTitle": "Your first lesson",
    "dash.startText": "Pick a hazard and watch Agila show you how to stay safe.",
    "dash.startButton": "Start Learning",
    "dash.continueButton": "Continue Learning",
    "dash.viewAll": "See all hazards",
    "dash.videosWatched": "videos watched",
    "dash.infographics": "Safety posters",
    "dash.infographicsText": "Quick posters for every hazard. Open one to read or print it.",
    "dash.explore": "Explore more",
    "dash.tile.learn": "Learn",
    "dash.tile.learnText": "Videos and steps for all 19 hazards.",
    "dash.tile.collection": "Collections",
    "dash.tile.collectionText": "Replay the games and quizzes you've unlocked.",
    "dash.tile.subject": "Subject Connect",
    "dash.tile.subjectText": "See how hazards link to your school subjects.",
    "dash.stats.xp": "Total XP",
    "dash.stats.streak": "Day streak",
    "dash.stats.badges": "Badges",
    "dash.stats.watched": "Videos",
    "dash.stats.player": "Safety Learner",
    "dash.didYouKnow": "Did you know?",
    "dash.reset": "Reset my progress",
    "dash.resetTitle": "Start over?",
    "dash.resetText": "This clears XP, streaks, badges, and watched videos on this device. Do this when another pupil will use this computer.",
    "dash.resetConfirm": "Yes, reset",
    "dash.resetCancel": "Keep my progress",
    "dash.resetDone": "Progress reset. Welcome, new learner!",

    "learn.title": "Learn",
    "learn.subtitle": "Watch, read, and get ready for every hazard.",
    "learn.journeys": "Learning Journeys",
    "learn.journeysText": "Hazards grouped by type. Pick a row and start exploring.",
    "learn.allHazards": "All Hazards",
    "learn.allHazardsText": "Browse all 19 hazards.",
    "learn.searchPlaceholder": "Search hazards…",
    "learn.noResults": "No hazards match. Try another word!",
    "learn.cardLabel": "Hazard",
    "learn.videoTag": "1-min video",
    "learn.watched": "Watched",
    "learn.backToAll": "All hazards",
    "learn.watchVideo": "Watch video",
    "learn.noVideo": "Video coming soon",
    "learn.lessonTitle": "What to know",
    "learn.lessonPending": "Agila is still preparing this lesson. Check back soon!",
    "learn.infographic": "Safety poster",
    "learn.signs": "Warning signs",
    "learn.dos": "Do",
    "learn.donts": "Don't",
    "learn.hotlineReminder": "In an emergency, call 911",
    "learn.subjects": "See how this connects to your subjects",
    "learn.subjectsPending": "Subject links for this hazard are coming soon.",
    "learn.beat.what": "What is it?",
    "learn.beat.signs": "Warning signs",
    "learn.beat.before": "Before: prepare",
    "learn.beat.during": "During: what to do",
    "learn.beat.after": "After: first safe steps",
    "learn.beat.signoff": "Agila says",

    "video.skip": "Skip",
    "video.sound": "Tap for sound",
    "video.offline": "Connect to the internet to watch this video.",
    "video.title": "Video",

    "collection.title": "Collections",
    "collection.subtitle": "Your unlocked mini-games and quizzes, ready to replay.",
    "collection.pending": "Games and quizzes are being built. Soon you'll unlock them by learning about each hazard!",
    "collection.locked": "Locked",

    "subject.title": "Subject Connect",
    "subject.subtitle": "Safety is part of everything you already study.",
    "subject.hazardsIn": "Hazards in",

    "footer.thesis": "A thesis project",
    "footer.offline": "Works offline after your first visit.",

    "mascot.alt": "Agila the eagle",
  },

  fil: {
    "site.name": "Kalasag Kids",
    "site.tagline": "Matutong maging ligtas, isang panganib sa bawat pagkakataon.",
    "site.skip": "Lumaktaw sa nilalaman",

    "nav.home": "Tahanan",
    "nav.learn": "Matuto",
    "nav.collection": "Koleksiyon",
    "nav.subject": "Asignatura",
    "nav.main": "Pangunahin",

    "lang.label": "Wika",

    "emergency.button": "Emergency",
    "emergency.chip": "Emergency? Pindutin dito",
    "emergency.title": "Mga Emergency Hotline",
    "emergency.intro": "Humingi ng tulong sa nakatatanda sa pagtawag. Huminahon at sabihin kung nasaan ka.",
    "emergency.call": "Tawagan",
    "emergency.missing": "Itanong sa guro ang numerong ito",
    "emergency.national": "Pambansang Emergency Hotline",
    "emergency.ndrrmc": "NDRRMC Operations Center",
    "emergency.redcross": "Philippine Red Cross",
    "emergency.pnp": "PNP Emergency Hotline",

    "common.close": "Isara",
    "common.back": "Bumalik",
    "common.next": "Susunod",
    "common.previous": "Nakaraan",
    "common.comingSoon": "Malapit na",
    "common.hazards": "panganib",
    "common.hazard": "panganib",
    "common.videos": "video",
    "common.video": "video",
    "common.print": "I-print",
    "common.search": "Maghanap",
    "common.all": "Lahat",
    "common.scrollLeft": "Mag-scroll pakaliwa",
    "common.scrollRight": "Mag-scroll pakanan",

    "welcome.kicker": "Maligayang pagdating sa",
    "welcome.cta": "Simulan Na!",
    "welcome.slide": "Ipakita ang larawan",
    "welcome.pause": "Ihinto ang slideshow",
    "welcome.play": "Ituloy ang slideshow",
    "welcome.aboutTitle": "Ano ito?",
    "welcome.about1": "Ang mga sakuna tulad ng lindol, bagyo, at sunog ay maaaring mangyari kahit saan. Ang pagiging handa ay nagpapanatiling ligtas sa iyo at sa iyong pamilya.",
    "welcome.about2": "Dito, tutulungan ka ni Agila ang agila na matuto kung ano ang gagawin sa pamamagitan ng maiikling video, poster, laro, at pagsusulit. Bahagi ito ng kultura ng kaligtasan ng ating paaralan at ng ating paglalakbay tungo sa Gawad KALASAG.",
    "welcome.featuresTitle": "Ano ang makikita mo rito",
    "welcome.feature.watch": "Manood",
    "welcome.feature.watchText": "Isang minutong video kasama si Agila para sa bawat panganib.",
    "welcome.feature.learn": "Matuto",
    "welcome.feature.learnText": "Madadaling hakbang para sa bago, habang, at pagkatapos.",
    "welcome.feature.play": "Maglaro",
    "welcome.feature.playText": "Mga mini-game at pagsusulit na may XP.",
    "welcome.feature.connect": "Iugnay",
    "welcome.feature.connectText": "Tingnan kung paano konektado ang kaligtasan sa iyong mga asignatura.",
    "welcome.ready": "Handa ka na bang maging handa?",

    "dash.jumpBack": "Ituloy ang pag-aaral",
    "dash.startLabel": "Magsimula rito",
    "dash.startTitle": "Ang iyong unang aralin",
    "dash.startText": "Pumili ng panganib at panoorin si Agila kung paano maging ligtas.",
    "dash.startButton": "Magsimulang Matuto",
    "dash.continueButton": "Ituloy ang Pag-aaral",
    "dash.viewAll": "Tingnan lahat ng panganib",
    "dash.videosWatched": "video ang napanood",
    "dash.infographics": "Mga poster pangkaligtasan",
    "dash.infographicsText": "Mabilisang poster para sa bawat panganib. Buksan para basahin o i-print.",
    "dash.explore": "Tumuklas pa",
    "dash.tile.learn": "Matuto",
    "dash.tile.learnText": "Mga video at hakbang para sa 19 na panganib.",
    "dash.tile.collection": "Koleksiyon",
    "dash.tile.collectionText": "Ulitin ang mga laro at pagsusulit na na-unlock mo.",
    "dash.tile.subject": "Subject Connect",
    "dash.tile.subjectText": "Tingnan kung paano konektado ang mga panganib sa iyong asignatura.",
    "dash.stats.xp": "Kabuuang XP",
    "dash.stats.streak": "Sunod-sunod na araw",
    "dash.stats.badges": "Mga badge",
    "dash.stats.watched": "Mga video",
    "dash.stats.player": "Mag-aaral ng Kaligtasan",
    "dash.didYouKnow": "Alam mo ba?",
    "dash.reset": "I-reset ang aking progreso",
    "dash.resetTitle": "Magsimula muli?",
    "dash.resetText": "Buburahin nito ang XP, streak, badge, at napanood na video sa device na ito. Gawin ito kapag ibang mag-aaral ang gagamit ng computer.",
    "dash.resetConfirm": "Oo, i-reset",
    "dash.resetCancel": "Huwag burahin",
    "dash.resetDone": "Na-reset na. Maligayang pagdating, bagong mag-aaral!",

    "learn.title": "Matuto",
    "learn.subtitle": "Manood, magbasa, at maghanda para sa bawat panganib.",
    "learn.journeys": "Mga Paglalakbay sa Pag-aaral",
    "learn.journeysText": "Mga panganib na pinagsama-sama ayon sa uri. Pumili ng hanay at magsimula.",
    "learn.allHazards": "Lahat ng Panganib",
    "learn.allHazardsText": "Tingnan ang lahat ng 19 na panganib.",
    "learn.searchPlaceholder": "Maghanap ng panganib…",
    "learn.noResults": "Walang tugma. Subukan ang ibang salita!",
    "learn.cardLabel": "Panganib",
    "learn.videoTag": "1-minutong video",
    "learn.watched": "Napanood",
    "learn.backToAll": "Lahat ng panganib",
    "learn.watchVideo": "Panoorin ang video",
    "learn.noVideo": "Malapit na ang video",
    "learn.lessonTitle": "Dapat malaman",
    "learn.lessonPending": "Inihahanda pa ni Agila ang araling ito. Bumalik ka ulit!",
    "learn.infographic": "Poster pangkaligtasan",
    "learn.signs": "Mga babala",
    "learn.dos": "Gawin",
    "learn.donts": "Huwag gawin",
    "learn.hotlineReminder": "Sa emergency, tumawag sa 911",
    "learn.subjects": "Tingnan kung paano ito konektado sa iyong mga asignatura",
    "learn.subjectsPending": "Malapit na ang mga ugnayan sa asignatura para sa panganib na ito.",
    "learn.beat.what": "Ano ito?",
    "learn.beat.signs": "Mga babala",
    "learn.beat.before": "Bago: maghanda",
    "learn.beat.during": "Habang: ang dapat gawin",
    "learn.beat.after": "Pagkatapos: unang ligtas na hakbang",
    "learn.beat.signoff": "Sabi ni Agila",

    "video.skip": "Laktawan",
    "video.sound": "Pindutin para sa tunog",
    "video.offline": "Kumonekta sa internet para mapanood ang video na ito.",
    "video.title": "Video",

    "collection.title": "Koleksiyon",
    "collection.subtitle": "Ang iyong mga na-unlock na mini-game at pagsusulit.",
    "collection.pending": "Ginagawa pa ang mga laro at pagsusulit. Malapit mo nang ma-unlock ang mga ito habang natututo tungkol sa bawat panganib!",
    "collection.locked": "Naka-lock",

    "subject.title": "Subject Connect",
    "subject.subtitle": "Bahagi ng lahat ng iyong pinag-aaralan ang kaligtasan.",
    "subject.hazardsIn": "Mga panganib sa",

    "footer.thesis": "Isang proyektong tesis",
    "footer.offline": "Gumagana kahit offline pagkatapos ng unang pagbisita.",

    "mascot.alt": "Si Agila ang agila",
  },
};

let current = state.getLanguage();

export function getLanguage() {
  return current;
}

/** Interface string for a key, with {name} placeholders filled from vars. */
export function t(key, vars) {
  let text = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
  return text;
}

/** Picks the current-language field from a bilingual { en, fil } data object. */
export function pick(value) {
  if (value == null || typeof value === "string") return value ?? "";
  return value[current] || value.en || "";
}

export function applyToPage(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  document.documentElement.lang = current === "fil" ? "fil" : "en";
  document.documentElement.classList.add("i18n-ready");
}

export function setLanguage(lang) {
  const next = lang === "fil" ? "fil" : "en";
  if (next === current) return;
  current = next;
  state.setLanguage(next);
  applyToPage();
  window.dispatchEvent(new CustomEvent("kalasag:languagechange", { detail: { lang: next } }));
}
