# Project Context — Disaster-Preparedness Learning Website (Pixel-Art, Eagle Mascot)

> A single reference document for building this project with Claude. It has two main parts:
> **Part 1 — Website Plan** (what the site is: pages, features, content, design) and
> **Part 2 — Project Folder Plan** (how it's built: stack, folder structure, per-file specs).
> Appendices hold the code that already exists and a decision log.

---

## 0. Read me first

**What this is.** A thesis project: an educational website that teaches elementary pupils disaster risk reduction and management (DRRM) through pixel-art storytelling, short videos, infographics, quizzes, and mini-games.

**Thesis title:** *Challenges Encountered of Selected Public Elementary School in the Division of Batangas Province on Disaster Prevention and Initiative Towards Gawad KALASAG.*

**Status.** Planning stage. **Locked since the last revision:** (1) the hazard list is **final at 19** (Part 1, 5.1); (2) `hazard.html` is **retired** and its role is absorbed by `courses.html` (Part 1, 4.4 and 4.6). No site code exists yet except the PWA scaffolding in Appendix A (`manifest.json`, `service-worker.js`, `offline.html`).

**Hard constraints (never violate these):**

1. **No accounts, no login, no backend, no database.** All progress is stored locally in the browser (`localStorage` / `sessionStorage`) per device.
2. **No community/forum/social features.** The site borrows Codédex's *structure and pixel-art look* only.
3. **Static site.** Plain HTML, CSS, and JavaScript. No PHP, no server-side language.
4. **Works offline** after first load (Progressive Web App).
5. **Bilingual:** English and Filipino, switchable at any time.
6. **Age-appropriate** for elementary learners (primarily Grades 1–6): hope-focused, no graphic disaster imagery, simple language, single-gesture game controls.
7. **One mascot:** the eagle appears on every page and is the protagonist of Story Mode. There is **no character creation**.

**How to work with this document.**

- Items marked **OPEN** are undecided. Propose options and ask; don't silently decide them.
- Items marked **PROPOSED** are suggestions that were never formally confirmed.
- Everything else is a decision made by the project owner.
- Respect the guardrails in Part 2, section 9.

---

# PART 1 — WEBSITE PLAN

## 1. Project overview

### 1.1 Purpose

Turn disaster-preparedness education into something children want to explore. The site supports a school's goal of building a **culture of safety** and its aspirations toward **Gawad KALASAG**. The finished site should also work as a tangible, demonstrable artifact for the thesis defense panel.

### 1.2 Audience

- **Primary:** elementary pupils (Grades 1–3 "Easy" tier, Grades 4–6 "Advanced" tier), possibly on shared school computers or tablets with weak internet.
- **Secondary:** teachers (who may print infographics and want to jump to specific content), parents, and the thesis panel.

### 1.3 Gawad KALASAG context

- *KALASAG* stands for **KA**lamidad at **S**akuna **LA**banan, **SA**riling Galing ang Kaligtasan. *Kalasag* is the Filipino word for a shield used by early inhabitants for protection.
- Established in 1998; led by the Office of Civil Defense (OCD) under the National Disaster Risk Reduction and Management Council (NDRRMC).
- It recognizes local government units, institutions, schools, civil society groups, and individuals showing excellence in disaster risk reduction, management, and humanitarian assistance. Evaluation focuses on disaster preparedness, climate change adaptation, and rapid response.
- Recognition includes the **Seal of Excellence**; entries are rated fully compliant or beyond compliant.
- This theme drives the site's story (the broken Kalasag shield) and its final reward (the Seal of Kalasag certificate).

### 1.4 Design reference: Codédex (structure + pixel look only)

The Codédex website (a pixel-art coding-education site) is the layout and style inspiration. Claude may not have the screenshots, so here is what was taken from it:

- **Landing page:** full-width pixel-art landscape hero (mountains, sky, meadow), big pixel-font title, one-line subtitle, a bright yellow **"Get started"** button, a small mascot sprite beside the call to action, dark navy page background, top nav (Learn / Practice / Build / Community) with a prominent yellow button at right.
- **Signed-in Home:** a mascot at the top with a speech bubble; a large **"Jump back in"** card (course banner, progress %, "Continue Learning" button); a right-hand **sidebar profile card** (total XP, rank, badges, day streak, "View profile"); "Explore more" tile cards with small pixel icons; section headings in a pixel typeface.
- **Course catalog:** a **"Learning Journeys"** section made of grouped horizontal rows (each group has a title, a one-line description, and a stats line like "8 Courses · 70 Hours"), followed by an **"All Courses"** grid with filter chips and a search box. Cards have a pixel-art banner, a small "COURSE" label, a title, a two-line description, and a difficulty tag.
- **Visual language:** dark navy surfaces, pixel typeface for headings, readable sans-serif body text, bordered cards with hard-edged (stepped) shadows, saturated accent colors.
- **Not taken:** accounts and login, the community/forum page, pricing/club upsells.

## 2. Brand and visual design

### 2.1 Mascot

- A friendly **eagle** (a Philippine Eagle is a natural fit: the national bird, vigilant and protective), drawn as a pixel-art sprite.
- Working name: **Agila** (Filipino for "eagle") — placeholder.
- It is the host/guide on every page *and* the protagonist of Story Mode.
- Two families of animation are needed:
  - **UI reactions:** idle bounce, wave/greet, happy bounce (correct answer), gentle shake (try again), cheer (lesson/game complete).
  - **Story states:** fly/walk along the map, brace (hazard approaching), react-to-hazard per category, triumphant pose for clearing a hurdle or forging the Kalasag.
- The mascot reacts on hover/tap.

### 2.2 Titles and tagline

- Working site titles: *"Kalasag Kids"* or *"Bantay Eskwela"* (pick one for final branding).
- Tagline: *"Learning to stay safe, one hazard at a time."*
- Video series working title: *"Kasama ni Kalasag"*.

### 2.3 Pixel-art direction

- Pixel typeface for headings and buttons; a plain, highly readable font for body text (readability for young readers beats style).
- Chunky borders, hard stepped shadows (no blur), near-zero corner radius.
- Limited, saturated palette per category on a dark navy base; bright yellow primary button.
- Crisp sprite rendering (nearest-neighbor) and whole-number sprite scaling (1x/2x/3x).
- Motion stays light and loopable (CSS/SVG/sprite level). No heavy video backgrounds.

### 2.4 Category color system

Used consistently across hazard cards, infographics, quiz icons, game tiles, and page sections.

| Category | Color family |
|---|---|
| Geological | brown / green |
| Hydrometeorological (water) | blue |
| Technological & structural (incl. fire) | red / orange |
| Biological | **OPEN** — purple/violet suggested |
| Social & safety | **OPEN** — amber/yellow suggested |

Each hazard also has **one icon used everywhere** (video thumbnail, infographic header, quiz topic icon, game tile, hazard card) so children recognize topics instantly.

## 3. Site map and user flow

```
Welcome page ──► Profile (the Dashboard)
                   ├─► Story Mode   (eagle's journey; hazards are hurdles; unlocks quizzes + mini-games)
                   ├─► Courses      (videos + infographics library, freely browsable)
                   ├─► Collection   (unlocked mini-games + quizzes, freely replayable)
                   ├─► Subject Connect (hazards mapped to school subjects)
                   └─► Infographics (also shown directly on Profile)

Global on every page: 🚨 Emergency hotlines button · English/Filipino toggle · eagle mascot
```

**Proposed top navigation** (mirrors Codédex's nav slots): *Home (Profile)* · *Story Mode* · *Courses* · *Collection* · *Subject Connect*, plus the persistent Emergency button and language toggle. **PROPOSED.**

**Typical first-time flow:** Welcome → Profile → "Begin the Journey" → Story Mode stage 1 → first hurdle (video cutscene → mini-game → quiz) → shield piece earned → Profile shows progress.

## 4. Pages

### 4.1 Welcome page (`index.html`)

Public landing page; the first thing any visitor sees (student, teacher, parent, panel). No login fields anywhere.

1. **Hero** — pixel-art Philippine landscape (volcano, coast, palms) with small pulsing hazard icons (earthquake crack, typhoon swirl, flame, wave); the eagle mascot idling/waving; site title and tagline.
2. **"What is this?" blurb** — 2–3 short elementary-level sentences: what NDRRMC is, why preparedness matters, and that the site turns it into a story, videos, games, and quizzes. Optional mention of the school's culture-of-safety goal and Gawad KALASAG.
3. **"What you'll find here" preview strip** — icon row of the main features with one-liners (Journey / Watch / Learn / Play / Connect).
4. **Call to action** — big pixel-bordered button *"Enter the Safety Zone"* / *"Simulan Na!"* → Profile.
5. **Language toggle** — English / Filipino, in a corner.
6. **Footer** — always-visible emergency chip (*"🚨 Emergency? Tap here"*) and credits (research title, school, proponents).

Keep it light: CSS/SVG-level animation, fast on school computers. It is also the PWA `start_url`.

### 4.2 Profile — the Dashboard (`dashboard.html`, may be renamed `profile.html`)

The hub after the welcome page. It merges the old "Dashboard" and "Profile" ideas. Layout follows Codédex's signed-in Home: main column plus a right sidebar. Everything is rendered from local state; never assume the student has been here before (a first visit shows "0 / N" states and "Begin the Journey").

**Main column**
1. **Eagle greeting bubble** — rotating safety tip or "Did you know?" fact.
2. **Jump back in card** — shows where the eagle left off on the Story Mode map (stage, next hurdle, progress bar) with **Continue Journey**; first-timers see **Begin the Journey**.
3. **Infographics section** — grid of every hazard's infographic poster; open to everyone (not gated), each with download/print PDF.
4. **Explore more tiles** — Story Mode · Courses · Collection · Subject Connect.

**Sidebar (sticky on wide screens)**
- **Stats card:** total XP, day streak, badges, hazards cleared (e.g. "4/19"), shield pieces collected.
- **🚨 Emergency Hotlines panel** (always visible/expandable; also reachable on every page).
- **"Did You Know?" ticker** — rotating safety facts.

A **"Reset my progress"** control belongs here because shared school devices will have several children using one browser.

**Emergency hotlines** (national numbers verified as of 2026; confirm the local Batangas LGU/barangay numbers separately because they're not nationally standardized):

| Emergency | Number |
|---|---|
| National Emergency Hotline | **911** |
| NDRRMC Operations Center | (02) 8911-1406 |
| Philippine Red Cross | **143** |
| PNP Emergency Hotline | **117** |
| Bureau of Fire Protection (local station) | *insert nearest station's number* |
| Barangay/LGU DRRM Office | *insert local number* |

Presented as a big red "🚨 Emergency" button that expands the list — kid-friendly but unmissable. The two local numbers come from a small config file so another school/barangay can reuse the site by editing one file.

### 4.3 Story Mode

**Concept.** The player follows the eagle on a long journey toward a destination. Hazards are the perils on the road. Each encounter unlocks that hazard's quiz and mini-game, which then appear in Collection. The structure is inspired by classic quest stories (a clear goal, a journey in escalating stages, helpers met along the way, a final trial at the destination). Only the *structure* is borrowed; the world and plot are original.

**Premise (WORKING DRAFT — to be reacted to, not final).** The eagle's home community has lost its **Kalasag**, the shield-shaped emblem that holds the community's know-how for staying safe. It has broken into pieces scattered across the land. To protect home before the next disaster, the eagle must travel to the **Watchtower** at the summit of the great mountain, where the Kalasag can be forged whole again and its beacon lit to warn the whole land.

- The antagonist is not a villain; it's the hazards themselves. Nobody to hate, only things to be prepared for.
- **Destination:** the Watchtower at the mountain's summit.
- **Per-hurdle reward:** a **shield piece** + XP.
- **Final reward:** forge the Kalasag, light the beacon, receive a printable **Seal of Kalasag** certificate (echoing the Seal of Excellence in Gawad KALASAG, and a tangible artifact for the thesis panel).

**Journey map (WORKING DRAFT).** Ordered from familiar to dramatic so early hurdles feel relatable and the climb ends on the biggest forces. **19 hurdles in total (5 + 4 + 2 + 4 + 4)**, one per hazard:

| Stage | Region (working name) | Hazard group | Hurdles |
|---|---|---|---|
| 1 | The Home Village | Technological & structural | Fire, Building/Structural Collapse, Road/Traffic Accidents, Oil/Chemical Spill, Electrical & Power Line Hazards (5) |
| 2 | The Crossroads Town | Social & safety | Missing Child/Stranger Danger, Bullying & Peer Violence, Crowd Crush, Community Conflict/Unrest (4) |
| 3 | The Lowland Marsh | Biological | Disease Outbreak, Pest Infestation (2) |
| 4 | The Storm Coast | Hydrometeorological | Typhoon, Severe Flooding, Storm Surge, El Niño (4) |
| 5 | The Fault Mountains | Geological | Earthquake, Landslide, Tsunami, Volcanic Eruption (4, final climb) |

**Anatomy of every hurdle** (same rhythm each time so players learn it):
1. **Approach** — the eagle narrates; the pixel scene shows the hazard's warning signs.
2. **Encounter** — that hazard's 1-minute video plays as the cutscene on first visit (skippable; see 4.6), using the same video modal as the Courses page. It remains rewatchable in Courses.
3. **Unlock** — the hazard's mini-game and quiz path unlock.
4. **Challenge** — the eagle acts out the response through the mini-game.
5. **Gate** — a short quiz lesson to continue.
6. **Reward** — shield piece, XP, and the road ahead opens.

**Optional helpers (idea).** At each stage the eagle can meet a helper loosely tied to real agencies in the AP curriculum (e.g., a weather-watcher echoing PAGASA, a mountain-watcher echoing PHIVOLCS). Kid-friendly pixel/animal characters. Optional because it adds art and writing work.

**Tone guardrails.** Hope-focused; hazards shown as pixel-art perils, never graphic. Bullying and stranger-danger hurdles are framed around "who to tell." The eagle always models the correct response.

**Settled:** the protagonist is the eagle; there's a destination; hazards are hurdles; encountering a hurdle unlocks its quiz and game; unlocked items live in Collection; progress is local.

**OPEN:** final story and names; map style (a visible Mario-style world map vs. simple stage-by-stage screens — big difference in build effort); fixed vs. free order within a stage; what "clearing" a hurdle means (pass the quiz, win the game, or both); session pacing (19 hurdles × video + game + quiz is a lot — local save-and-resume handles it, but per-session length is worth considering).

### 4.4 Courses / Learning Journeys (`courses.html`)

The freely browsable content library, modeled on Codédex's course catalog. **Never gated by progress** — closer to a reference library than a game.

**One page, two views.** `courses.html` is the single home for hazard learning content. The former `hazard.html` no longer exists; its job is now the *detail view* of this page, selected by a query parameter:

- `courses.html` → **catalog view** (below).
- `courses.html?hazard=earthquake` → **hazard learning view** for that hazard (video gate, text meanings, infographic, subject strip — see 4.6).

Story Mode's encounter and Subject Connect link into the same hazard learning view, so there is exactly one place where a hazard's learning content is rendered.

**Catalog view**
- **Learning Journeys** — hazard categories as grouped horizontal rows, each row a scrollable set of hazard cards with a stats line. The 19 hazards split as:

| Journey (category) | Hazards | Stats line |
|---|---|---|
| Geological | Earthquake · Volcanic Eruption · Tsunami · Landslide | 4 hazards · 4 videos · 4 infographics |
| Hydrometeorological | Typhoon · Severe Flooding · Storm Surge · El Niño | 4 hazards · 4 videos · 4 infographics |
| Biological | Disease Outbreak · Pest Infestation | 2 hazards · 2 videos · 2 infographics |
| Technological & structural | Fire · Building/Structural Collapse · Road/Traffic Accidents · Oil/Chemical Spill · Electrical & Power Line Hazards | 5 hazards · 5 videos · 5 infographics |
| Social & safety | Missing Child/Stranger Danger · Crowd Crush · Bullying & Peer Violence · Community Conflict/Unrest | 4 hazards · 4 videos · 4 infographics |

- **All Hazards** — a grid of all **19** hazard cards (pixel icon, name, one-line description, category color, "1-min video" tag), with category filter chips and a search box.
- **Card behavior** — selecting a hazard card opens the hazard learning view (`courses.html?hazard=<id>`): the video plays through the first-visit modal gate, then the text meanings and infographic (see 4.6). Quizzes and mini-games are *not* launched from here; they stay behind Story Mode and Collection.
- Cards show a small progress indicator (video watched) and link to the hazard's infographic.

### 4.5 Collection (`collection.html`, PROPOSED filename)

Takes the nav slot Codédex uses for "Community," but with no posts, no forum, no accounts. It is the organized showcase of the **mini-games and quizzes** the eagle has unlocked through Story Mode, freely replayable without walking back through the story. (Infographics are *not* collected here; they live on Profile and in Courses.)

- Grid grouped by hazard using the shared hazard icons; per hazard: its mini-game entry and its quiz path.
- Completion indicator (e.g., "7/19 hazards collected") feeding the Profile stats card.
- **OPEN:** show locked items as grayed silhouettes (teases what's ahead, collect-them-all feel — leaning this way) or hide them.
- **OPEN:** classroom use — a teacher who wants one specific quiz/game shouldn't be blocked by a fully locked Collection. Consider a "show everything" toggle or unlock-all option (no accounts means no permissions to manage).

### 4.6 Hazard learning flow (video gate + text meanings) — lives in `courses.html?hazard=<id>`

Each hazard is entered via a **hazard card** in the Courses catalog (or as the Story Mode encounter). The first time a hazard is opened:

1. A **modal** pops up and autoplays that hazard's **1-minute video**, with a visible **Skip** button always present (never a mandatory gate) and bilingual captions.
2. When the video ends (or is skipped), the modal closes and the student lands on the **text meanings** — the same six beats as readable text.
3. "Watched" is recorded per hazard, per device.

On every later visit, the modal does **not** open. The page goes straight to the text meanings, with a **▶ Watch video** button still visible so replay is deliberate, never forced.

Below the text meanings the page shows the hazard's **infographic** (preview + download/print PDF) and the **"🔗 See how this connects to your subjects"** strip (from Subject Integration).

> **DECIDED — `hazard.html` becomes the Courses page.** There is no separate `hazard.html`. The per-hazard learning page (video gate + text meanings + infographic + subject strip) is the detail view of `courses.html`, reached from the catalog cards and as the Story Mode encounter. Quizzes and mini-games run only from Story Mode (first time) and Collection (replay). Story Mode keeps its own map-based entry points, but they open this same view for the video.

### 4.7 Subject Connect (`subject-connect.html`)

A standalone browse-by-subject view of how hazards connect to the school curriculum (distinct from the small per-hazard strip). Subject tabs/filters, content cards per subject showing which hazards connect and how, and cross-links back to each hazard's learning view in Courses (`courses.html?hazard=<id>`). It expresses the idea that DRRM is "threaded through everything they already study," not a bolted-on subject. Informational, not interactive; a filter like "everything for my Science class this week" is a nice touch for teachers.

## 5. Content systems

### 5.1 Hazard list

The **final master list: 19 hazards**. Each maps 1:1 to a video, infographic, quiz path, and mini-game — so the content set is **19 videos, 19 infographics, 19 quiz paths, 19 mini-game configurations**.

**Natural hazards**
- *Geological:* Earthquake · Volcanic Eruption · Tsunami · Landslide
- *Hydrometeorological:* Typhoon · Severe Flooding · Storm Surge · El Niño
- *Biological:* Disease Outbreak · Pest Infestation

**Human-induced hazards**
- *Technological & structural:* Fire (household/school) · Building or Structural Collapse · Road and Traffic Accidents · Oil/Chemical Spill · Electrical and Power Line Hazards
- *Social & safety:* Missing Child/Stranger Danger · Crowd Crush (stampede) during evacuations or events · Bullying and Peer Violence · Community Conflict/Unrest (simplified, age-appropriate framing)

Count check: Geological 4 + Hydrometeorological 4 + Biological 2 + Technological & structural 5 + Social & safety 4 = **19**.

> **DECIDED — 19 is final.** Earlier drafts of the videos, infographics, and mini-game mapping used 15 hazards. Four were not yet covered and now need full content: **Oil/Chemical Spill, Electrical & Power Line Hazards, Crowd Crush, Community Conflict/Unrest**. Missing Child/Stranger Danger and Bullying & Peer Violence were already in the 15 but had no game mapping (now proposed in 5.5). Every counter, grid, and example in this document assumes 19.

### 5.2 Videos

- **One short video per hazard, about 1 minute**, mascot-hosted and animated (simple pixel/animated visuals, **never live-action footage of real disasters**).
- **Same six beats every time** (~8–10 seconds each; write beat-first: one punchy line + one clear visual): (1) What is it? (2) Warning signs, (3) Before — prepare, (4) During — what to do, (5) After — first safe steps, (6) Mascot sign-off with a one-line safety reminder.
- The same six beats reappear as the **text meanings** a student reads after/instead of the video, so the script doubles as that text.
- **Bilingual captions** (Filipino/English), matched to the site language toggle.
- End every video with the **same visual cue** pointing onward to that hazard's quiz and game.
- Package as an episodic series (*Kasama ni Kalasag*) so children look forward to the "next episode."
- Bullying is handled gently, framed around "who to tell."
- Playback behavior is described in 4.6.

### 5.3 Infographics

A quick-reference poster per hazard that a student or teacher can absorb in ~10 seconds.

- **Layout:** (1) hazard icon + name at top, (2) warning signs — 2–3 icon bullets, (3) Do's — short action-icon list (e.g., ✅ Duck, Cover, Hold), (4) Don'ts (e.g., ❌ Don't use elevators), (5) emergency hotline reminder (same numbers as the Profile panel) so a printed poster works on a classroom wall.
- Minimal text, maximum icons/color; category color system applied.
- **Downloadable/printable PDF** per hazard (pre-made static assets are simplest) in addition to the on-site digital version.
- Identical iconography reused across videos, quizzes, games, and cards.
- Student-made posters (MAPEH Arts) could feed this section as extra content.

### 5.4 Quizzes (Duolingo-style)

Bite-sized, gamified, forgiving, rewarding — repetition should feel like play, not a test.

- **One quiz path per hazard**, split into short **lessons** of 5–8 questions each (finishable in a few minutes). Lessons unlock in sequence (Lesson 1 → 2 → 3), and a hazard's quiz path itself unlocks via Story Mode.
- **Hearts:** 3 per lesson; a wrong answer costs one heart but always shows the correct answer plus a short explanation (never just "wrong"). Running out of hearts offers a "review the lesson" option, never a hard wall.
- **Streak counter:** consecutive days/sessions engaging (stored locally).
- **XP:** awarded per completed lesson; feeds the Profile stats.
- **Instant feedback:** immediate visual + mascot reaction after every question (happy bounce / gentle "try again" nudge).
- **Progress bar** at the top of each lesson.
- **End-of-lesson summary:** 1–3 stars by accuracy, an encouraging message, and a "what you learned" recap line.
- **Question types:** multiple choice · image-based identification (match a warning sign/symbol to its meaning; ties to the English curriculum) · true/false myth-busting · drag-and-drop sequencing (e.g., Duck-Cover-Hold steps, Go Bag priorities).
- **Difficulty tiers:** *Easy* (Grades 1–3): simpler vocabulary, more images, fewer questions. *Advanced* (Grades 4–6): more text-based reasoning and scenario questions ("It starts raining heavily during dismissal — what's the safest first step?").
- **OPEN:** whether "furthest unlocked lesson" persists across visits or resets each time.

### 5.5 Mini-games

A small set of reusable **templates** (mechanics), each **reskinned** per hazard so every hazard gets a game without designing a new engine each time. Seven templates in three skill groups:

- **Physical/reflex:** Dino-Jump, Dodge & Collect
- **Spatial/navigation:** Maze, Go Bag
- **Cognitive/literacy:** Puzzle, Match the Icons, Jumbled Words

**Shared rules for all games**
- **One primary input per game** (tap, drag, or swipe — never combos) so it runs on shared/older devices and suits young motor skills; touch targets generously sized.
- **Hearts** (3 per round) wherever a fail state exists (Dino-Jump, Dodge & Collect); other templates use gentle resets/retries. Running out ends the round early with points shown and an encouraging retry — never a hard "Game Over."
- **Stars (1–3)** at round end, mirroring quiz summaries. **XP** for every completed round (win or not — effort is never worth zero).
- **One-sentence takeaway** at the end of every game (e.g., "Great job! Remember: Duck, Cover, Hold — every time.").
- Progress stored locally only.

**1. 🎒 Go Bag (packing/sorting)** — *Objective:* drag the correct emergency-kit items into a bag before time runs out. *Controls:* drag-and-drop, with a tap-item-then-tap-bag fallback for touchscreens. *Mechanics:* wrong/unneeded items (toys, junk food) are tappable-away or unselectable — no penalty, just no reward. *Scoring:* points per correct item + bonus for finishing before the timer. *Difficulty:* Easy = 5–6 items, longer timer, labeled icons; Advanced = 10+ items, shorter timer, look-alike decoys (toy vs. real flashlight). *Reskin:* change the correct item list (whistle + dust mask for earthquake; raincoat + floaties for flood). Doubles as a **universal warm-up** before any topic.

**2. 🏃 Dino-Jump (endless runner)** — *Objective:* the character auto-runs through a scrolling world; survive while the safety lesson plays out. *Controls:* single tap/swipe (jump, duck, dodge lanes). *Mechanics:* obstacles scroll at increasing speed; 3 hearts; ends with distance reached + retry. *Difficulty:* Easy = slower, obstacles telegraphed 1–2 s early; Advanced = faster, less warning, double obstacles (jump + duck). *Reskin:* falling debris (typhoon), flames/smoke (fire), rising water (flood).

**3. 🧭 Maze (navigate to safety)** — *Objective:* guide the character to a marked safe zone, avoiding hazard tiles. *Controls:* tap-to-move or swipe-direction, one tile per step (no twitch reflexes needed). *Mechanics:* touching a hazard tile resets to the last checkpoint (never a hard fail); after 2–3 failures a "ghost path" shows the safe route. *Scoring:* stars by time and number of resets. *Difficulty:* Easy = single clear path with arrows; Advanced = branching maze with dead ends and a timer. *Reskin:* evacuation center (volcano), high ground (tsunami/flood), open field (earthquake aftershocks).

**4. 🧩 Puzzle (matching / sequencing / jigsaw)** — *Objective:* match, order, or assemble pieces (drill steps in order, jigsaw of a safety poster, pair water-conservation actions with benefits). *Controls:* drag into slots or tap in order. *Mechanics:* a wrong placement bounces back gently. *Scoring:* stars by attempts and time. *Difficulty:* Easy = 3–4 pieces with images; Advanced = 6–8 pieces, text-only labels.

**5. 🔤 Jumbled Words (unscramble)** — *Objective:* unscramble a hazard-vocabulary word or phrase (e.g., ACUEVATE → EVACUATE). *Controls:* tap letter tiles in order to fill blanks (no typing, no drag). *Mechanics:* optional hint reveals a letter at a point cost; after solving, a one-line definition appears (reinforces English vocabulary: evacuate, shelter, hazard, preparedness…). *Scoring:* points by speed and fewer hints; a no-hint streak earns bonus XP. *Difficulty:* Easy = 4–5 letters, icon cue, pre-spaced blanks; Advanced = 8+ letters or two-word terms ("STORM SURGE"), no cue. *Reskin:* swap the word bank per hazard (AFTERSHOCK, EPICENTER; EVACUEE, STORM SURGE; FIRE TRIANGLE…).

**6. 🎯 Match the Icons** — *Objective:* match hazard pictograms to their meaning, using the same iconography as the infographics. *Modes:* **memory-flip** (younger: tap two face-down tiles; mismatches flip back) and **drag-icon-to-label** (older). *Scoring:* stars by flips/attempts and time. *Difficulty:* Easy = 4–6 distinct pairs; Advanced = 8–12 pairs with look-alike decoys ("shelter-in-place" vs. "evacuate" arrows) to test reading, not shape memory. *Reskin:* icon set per hazard.

**7. 🌧️ Dodge & Collect (falling-object avoidance + points)** — *Objective:* the character moves along a horizontal strip near the bottom while objects fall from the top; dodge harmful ones, collect safety items for points. Distinct from Dino-Jump: single-screen vertical catcher vs. forward-scrolling runner. *Controls:* swipe left/right or tap left/right zones (single axis). *Mechanics:* bad objects (debris, embers) cost a heart; good objects (whistle, flashlight, water, mask) score points and trigger a mascot cheer; fall speed and density ramp up over the round. *Scoring:* points per item + small survival bonus; stars by thresholds. *Difficulty:* Easy = slower, very distinct good/bad shapes and colors; Advanced = faster, denser, some look-alike pairs. *Reskin:* typhoon (branches/roof debris; collect flashlights/canned goods), fire (embers; masks/extinguishers), volcano (ash/rocks; goggles/masks), storm surge/flood (floating debris; life vests/rope).

**Hazard → game mapping** (primary game, plus bonus rounds):

| Hazard | Primary game | Reskin idea | Bonus round(s) |
|---|---|---|---|
| Earthquake | Maze | Reach an open safe zone after Drop-Cover-Hold | Match the Icons, Jumbled Words (AFTERSHOCK, EPICENTER) |
| Volcanic Eruption | Maze | Race the evacuation route to the center | Dodge & Collect (ash/rocks; protective gear), Match the Icons |
| Tsunami | Dino-Jump | Run to high ground, dodging debris | Jumbled Words (EVACUATE, HIGH GROUND), Match the Icons |
| Landslide | Puzzle | Arrange terrain/warning-sign pieces to find the safe path | Match the Icons, Jumbled Words |
| Typhoon | Dodge & Collect | Dodge flying branches/debris, collect supplies | Dino-Jump, Jumbled Words (STORM SURGE) |
| Severe Flooding | Maze | Guide a small boat/character to a rescue point | Dodge & Collect (floating debris; life vests), Match the Icons (flood-level markers) |
| Storm Surge | Dodge & Collect | Dodge debris, collect flotation gear, outrun the surge | Dino-Jump, Jumbled Words |
| El Niño | Puzzle | Match water-conservation actions to benefits | Match the Icons, Jumbled Words (DROUGHT, CONSERVATION) |
| Disease Outbreak | Puzzle | Sequence handwashing/hygiene steps | Match the Icons (hygiene symbols), Jumbled Words (SANITATION, IMMUNE SYSTEM) |
| Pest Infestation | Puzzle | Spot-the-difference: find pest entry points in a house scene | Match the Icons |
| Fire | Dodge & Collect | "Stop, Drop, and Roll" while dodging embers, collecting gear | Dino-Jump, Jumbled Words (FIRE TRIANGLE) |
| Building/Structural Collapse | Go Bag | Pack the right kit before evacuating a damaged structure | Maze, Match the Icons |
| Road/Traffic Accidents | Maze | Cross safely using crosswalks, signals, signs | Match the Icons (traffic signs), Jumbled Words |
| Oil/Chemical Spill *(PROPOSED)* | Match the Icons | Match warning/hazard symbols to meanings; reinforce "stay away, tell an adult" | Jumbled Words (FUMES, CHEMICAL), Maze |
| Electrical & Power Line Hazards *(PROPOSED)* | Puzzle | Spot-the-hazard room scene (frayed cord, overloaded socket, wet hands near outlet) | Match the Icons (electrical warning signs), Jumbled Words (OUTLET, POWER LINE) |
| Missing Child/Stranger Danger *(PROPOSED)* | Puzzle | Sequence the steps: stay calm, find a trusted helper, say your name and who you're with | Match the Icons (trusted-helper icons), Jumbled Words (TRUSTED ADULT) |
| Crowd Crush *(PROPOSED)* | Maze | Walk calmly with the group to the exit, avoiding bottleneck tiles | Match the Icons (exit signs), Jumbled Words (EVACUATE) |
| Bullying & Peer Violence *(PROPOSED)* | Match the Icons | Match situations to "who to tell" helpers; gentle, never graphic | Puzzle, Jumbled Words (RESPECT, KINDNESS) |
| Community Conflict/Unrest *(PROPOSED)* | Go Bag | Pack a calm "stay-safe-at-home" kit (radio, water, flashlight) and shelter in place | Match the Icons, Jumbled Words (SHELTER, STAY CALM) |
| General preparedness | Go Bag | Flagship game; replay with a different item list per hazard as a warm-up | Match the Icons (hazard icon recognition) |

*The six rows marked PROPOSED cover the hazards that previously had no mapping. They are suggestions only — confirm or change them before building those games. All 19 hazards now have a primary game and bonus options.*

**Universal bonus rounds.** Jumbled Words and Match the Icons only need a swappable word list or icon set, so they can appear as an optional 60–90 second bonus after *any* hazard's primary game. Keep it to **one primary game plus one optional bonus per hazard** so it never feels like homework. **OPEN:** exactly where bonus rounds appear in the Story Mode flow (after the hurdle? only in Collection?).

### 5.6 Subject integration

Each hazard hooks into subjects pupils already study, so the site reinforces classroom learning.

**Science — the "why":** Earthquake (plate tectonics, faults, seismic waves) · Volcanic Eruption (magma, rock cycle, Pacific Ring of Fire) · Typhoon (how cyclones form, air pressure, water cycle) · Flood/Storm Surge (water cycle, elevation/terrain, why some areas flood faster) · Landslide (soil, gravity, erosion, deforestation) · El Niño (ocean-atmosphere interaction, basic climate) · Disease Outbreak (germs, how disease spreads, immune system) · Fire (fire triangle: heat, fuel, oxygen — explained safely) · Electrical & Power Line Hazards *(PROPOSED)* (electricity basics, conductors vs. insulators, why water and power don't mix) · Oil/Chemical Spill *(PROPOSED)* (properties of liquids, pollution and its effect on water and living things).

**AP (Araling Panlipunan) — the "when/where/who":** history of major Philippine disasters (focus on resilience, not graphic detail); geography (Pacific Ring of Fire *and* Typhoon Belt); agencies and roles (NDRRMC, PAGASA, PHIVOLCS, barangay DRRM councils); citizenship (community roles, cooperation — ties to Gawad KALASAG); *(PROPOSED)* how a barangay keeps order and helps (tanod, barangay officials) for Crowd Crush and Community Conflict.

**TLE — the "how to prepare":** assembling/maintaining a Go Bag (mirrors the Go Bag game); basic first aid (simple bandaging, cleaning a small wound); home safety checks (securing furniture, exposed wiring, fire hazards); food storage/preservation; simple tool use and basic repairs.

**English — reading, vocabulary, communication:** interpreting warning signs and symbols; disaster vocabulary (evacuate, shelter, hazard, preparedness…); writing simple emergency messages; reading comprehension with short, hope-focused stories or survivor testimonials; short "public announcement" style speaking (mock barangay announcement).

**Additional subjects worth integrating:**
- **MAPEH** — *PE:* evacuation drills, Duck-Cover-Hold as a physical routine; *Health:* hygiene during outbreaks, basic emotional coping after stress; *Music:* a simple safety jingle (great for the mascot); *Arts:* hazard-awareness poster-making (can feed the infographics).
- **ESP / Values Education** — empathy, helping neighbors, fairness when sharing limited resources, community spirit; *(PROPOSED)* respect, kindness, and speaking up for Bullying & Peer Violence, and knowing trusted adults for Missing Child/Stranger Danger.
- **Filipino / Mother Tongue** — local/regional hazard terms, folk beliefs vs. scientific explanations, oral storytelling about calamities.

**Where it shows up:** a "🔗 See how this connects to your subjects" strip at the end of each hazard's learning view in Courses, plus the standalone Subject Connect page.

## 6. Cross-cutting systems

| System | Behavior |
|---|---|
| **Progress & rewards** | XP, day streak, badges, hearts (per lesson/round), stars (1–3), shield pieces (Story Mode), Seal of Kalasag certificate (final). All local. |
| **Language** | English/Filipino toggle on every page; interface strings and hazard content both bilingual; Filipino falls back to English if a string is missing. |
| **Emergency access** | The Emergency button/hotline panel is one tap away on **every** page, including the welcome page. |
| **Offline (PWA)** | Installable; app shell (pages, scripts, data, icons) works fully offline after first load. Videos and PDFs are cached only when watched/opened or via a "Save for offline" button (so first load stays fast and storage stays small on shared devices). |
| **Shared devices** | No accounts, so a "reset progress" option is essential. Optional teacher "unlock everything" mode (OPEN). |
| **Accessibility for kids** | Large touch targets, single-gesture controls, readable body font, gentle (never punitive) feedback, captions on videos. |
| **Hazard identity** | One id, name (EN/FIL), category, color, and icon per hazard, used identically everywhere. |

## 7. Open questions summary (website)

**Resolved (no longer open):** final hazard list = **19**; `hazard.html` role = **merged into `courses.html`** (detail view via `?hazard=<id>`).

1. **Story**: final premise, names, and whether the draft Kalasag/Watchtower concept stays.
2. **Story map style**: visible world map vs. stage screens.
3. **Clearing a hurdle**: quiz, game, or both?
4. **Order**: fixed vs. free within a stage.
5. **Collection**: show or hide locked items; teacher unlock-all option.
6. **Quiz lesson-unlock persistence** across visits.
7. **Biological and social/safety category colors.**
8. **Bonus rounds**: where they appear in the Story Mode flow.
9. **Top navigation** final labels and order.
10. **Final site title** and mascot name.
11. **Local numbers**: nearest BFP station and barangay/LGU DRRM office.
12. **Game mapping for the six newly covered hazards** (Oil/Chemical Spill, Electrical, Missing Child/Stranger Danger, Crowd Crush, Bullying, Community Conflict): confirm the PROPOSED templates in 5.5.
13. **Innovative feature** (e.g., a chatbot): explicitly **on hold**. If revived, a scripted FAQ bot in plain JS keeps the site backend-free; an AI-powered bot would need one tiny serverless proxy function.

---

# PART 2 — PROJECT FOLDER PLAN

## 1. Stack and decisions

The site is a **static, client-side web app**. No server-side language and no database are needed because there are no accounts and no server-side data.

| Layer | Choice | Why |
|---|---|---|
| Structure / style | HTML5, CSS3 (Sass optional) | Sass helps manage the category color tokens |
| Logic | Vanilla JavaScript, ES6 modules | No framework needed at this scale; one module per concern |
| Content | JSON files loaded with `fetch()` | One data-driven set of hazard pages/quizzes/games instead of 19 hardcoded copies. (`fetch()` is the modern replacement for "Ajax"; classic Ajax/XHR and PHP are **not** needed.) |
| State | `localStorage` / `sessionStorage` | Hearts, XP, streaks, badges, story progress, language |
| Reflex games | HTML5 `<canvas>` + `requestAnimationFrame` | Smooth on older school devices (Dino-Jump, Dodge & Collect) |
| Other games | Plain DOM + CSS | Less performance-heavy (Maze, Puzzle, Go Bag, Match Icons, Jumbled Words) |
| Animation | CSS keyframes / sprite sheets / SVG; Lottie optional | Lightweight; no video for mascot reactions |
| Build tooling | **Vite** (optional) | Bundles/minifies, organizes multi-page + JSON imports, still outputs plain static files. Plain unbundled files are also valid (simpler to explain to a panel) |
| Offline | **PWA**: `manifest.json` + service worker | Site works with no connection — fitting for a disaster-prep tool |
| Backend | **None** | Confirmed unnecessary |

Optional libraries: a small audio helper (e.g., Howler.js) for mascot/feedback sounds; a 2D game library (Phaser/Kaplay) is available but is probably overkill for two simple arcade games.

## 2. Hosting, domain, deployment

- **Domain:** `.com` (decided). `.org` was a viable alternative. `.edu` is restricted to accredited US post-secondary institutions; `.edu.ph` requires the *school* (not a student) to apply with DepEd recognition papers; `.io` was rejected because its long-term future is uncertain amid the Chagos sovereignty situation.
- **For the thesis defense/demo:** no purchase needed — deploy free on GitHub Pages, Netlify, Vercel, or Cloudflare Pages (free subdomain + automatic HTTPS). Move to the `.com` when the school/owner wants a permanent address.
- **HTTPS is required** for the service worker to run. Free on all the hosts above and on essentially any host once the `.com` is attached.

## 3. Folder tree

Legend: **(exists)** = already built in Appendix A · **(planned)** = designed in the planning notes · **(PROPOSED)** = suggested later, not yet formally decided.

```
project-root/
├── index.html                  # Welcome page                                  (planned)
├── dashboard.html              # Profile page = the Dashboard; may rename profile.html (planned)
├── story-mode.html             # Story Mode journey map/encounters             (PROPOSED)
├── courses.html                # Catalog + per-hazard learning view (?hazard=earthquake); replaces hazard.html (DECIDED)
├── collection.html             # Unlocked mini-games + quizzes, replayable     (PROPOSED)
├── subject-connect.html        # Browse hazards by school subject              (planned)
├── offline.html                # Offline fallback page                         (exists)
├── manifest.json               # PWA manifest                                  (exists)
├── service-worker.js           # PWA service worker (3 cache tiers)            (exists)
│
├── assets/
│   ├── icons/                  # One SVG/PNG per hazard (reused everywhere) + PWA icons (192/512 + maskable)
│   ├── images/                 # Pixel scenery, eagle sprite sheets, tiles, backgrounds
│   ├── audio/                  # Mascot sfx, correct/incorrect chimes, optional jingle
│   ├── videos/                 # 1-minute hazard videos (or embed externally)
│   ├── infographics/           # Printable PDF + PNG per hazard
│   └── fonts/                  # Pixel heading font + readable body font
│
├── css/
│   ├── variables.css           # Design tokens (colors, type, spacing, z-index, pixel style)
│   ├── components.css          # Shared UI kit (buttons, cards, modal, badges, progress…)
│   ├── dashboard.css           # Profile/Dashboard page layout
│   ├── quiz.css                # Quiz UI
│   ├── games.css               # DOM-game UI + HUD for canvas games
│   └── story.css               # Story Mode map/encounter styling               (PROPOSED)
│
├── js/
│   ├── main.js                 # Site-wide entry point (bootstrap + page routing)
│   ├── core/
│   │   ├── state.js            # localStorage/sessionStorage gatekeeper
│   │   ├── i18n.js             # English/Filipino interface strings
│   │   └── mascot.js           # Eagle expressions, tips, reactions
│   ├── data/
│   │   ├── hazards.json        # Master hazard index
│   │   ├── local-hotlines.json # The two deployment-specific numbers          (PROPOSED)
│   │   ├── tips.json           # "Did you know?" facts, EN/FIL                (PROPOSED)
│   │   ├── story.json          # Stage names, narration lines, EN/FIL         (PROPOSED)
│   │   ├── quizzes/            # one JSON per hazard (earthquake.json, …)
│   │   └── games/              # gobag-items.json, dino-jump-config.json, maze-layouts.json,
│   │                           # puzzle-sets.json, jumbled-words.json, match-icons.json, dodge-collect.json
│   ├── quiz/
│   │   └── quiz-engine.js      # One engine, reads any hazard's quiz JSON
│   ├── games/
│   │   ├── gobag.js  dino-jump.js  maze.js  puzzle.js
│   │   ├── jumbled-words.js  match-icons.js  dodge-collect.js
│   │   ├── game-loader.js      # Picks/loads the right game module per hazard   (PROPOSED)
│   │   ├── dragDropHelper.js   # Shared drag logic (Go Bag, Puzzle, quiz sequencing, Match Icons) (PROPOSED)
│   │   └── canvasGameLoop.js   # Shared rAF loop + delta time (Dino-Jump, Dodge & Collect)       (PROPOSED)
│   ├── dashboard/
│   │   ├── dashboard.js        # Profile page controller
│   │   └── hotline-panel.js    # Site-wide emergency panel
│   ├── story/
│   │   └── story-mode.js       # Story Mode controller                          (PROPOSED)
│   └── pages/                  # collection.js, courses.js page controllers      (PROPOSED)
│
└── docs/                       # Thesis documentation, not shipped
```

## 4. Local state and storage

All persistence goes through `js/core/state.js`. No other file touches storage directly. Every key is prefixed `kalasag:`.

| What | Storage | Notes |
|---|---|---|
| XP total | localStorage | Builds across visits on that device |
| Streak `{count, lastVisitDate}` | localStorage | Bumps once per new calendar day of quiz/game engagement |
| Badges per hazard | localStorage | `{earthquake: true, …}` |
| Video watched per hazard | localStorage | Drives the first-visit video modal; **separate** from "explored" and "badge" |
| Story progress | localStorage | Per hazard: `locked → encountered → cleared`; current stage; shield-piece count. "Encountered" unlocks the quiz + game (shows in Collection); "cleared" earns the shield piece |
| Language | localStorage | `"en"` or `"fil"` |
| Hearts per active lesson/round | session / in-memory | Reset at the start of each lesson/round |
| Hazards explored this session | sessionStorage | Feeds progress rings |

Rules: wrap every read/write in try/catch and fall back to an in-memory object if storage is unavailable (private mode, locked-down school devices); never store anything identifying a person; provide `resetAllProgress()`.

## 5. Data files

**`js/data/hazards.json`** — the master index of all **19** hazards; everything keys off the hazard `id`. Holds references and short metadata only, never heavy content, so it stays small (it's in the PWA precache).

```json
{
  "id": "earthquake",
  "name": { "en": "Earthquake", "fil": "Lindol" },
  "category": "geological",
  "color": "#8B5E3C",
  "icon": "/assets/icons/earthquake.svg",
  "videoSrc": "/assets/videos/earthquake.mp4",
  "infographicPdf": "/assets/infographics/earthquake.pdf",
  "quizDataPath": "/js/data/quizzes/earthquake.json",
  "primaryGame": "maze",
  "bonusGames": ["match-icons", "jumbled-words"],
  "gameConfigPaths": {
    "maze": "/js/data/games/maze-layouts.json",
    "jumbled-words": "/js/data/games/jumbled-words.json",
    "match-icons": "/js/data/games/match-icons.json"
  },
  "subjectIntegration": ["science", "ap"],
  "storyStage": 5,
  "storyOrder": 1
}
```

- `id` — the key used in URLs (`courses.html?hazard=earthquake`), state keys, and cache keys.
- `category` — drives the color-family system; `color` should inherit from the category token in `variables.css` rather than hardcoding per hazard.
- `primaryGame` / `bonusGames` — which template to load, per the hazard→game mapping table (Part 1, 5.5).
- `storyStage` / `storyOrder` — place of the hazard's hurdle in the Story Mode journey (stages 1–5 per the draft map).

**Other data files** (shapes are PROPOSED unless noted):
- `quizzes/{hazardId}.json` — lessons (5–8 questions each) with `difficulty` tiers; each question has a `type` (multiple-choice | image-id | true-false | sequencing), bilingual `prompt` and `explanation`, options, the correct answer, and an optional image.
- `games/*.json` — per-hazard configuration for each template: item lists (Go Bag correct/decoy), obstacle/pickup sprites and speed curves (Dino-Jump, Dodge & Collect), grid layouts (Maze), puzzle sub-type + content (Puzzle), word bank `{word, hintIcon, definition, difficulty}` (Jumbled Words), icon/label pairs (Match Icons).
- `local-hotlines.json` — nearest BFP station number and barangay/LGU DRRM number.
- `tips.json` — bilingual "Did you know?" facts for the eagle bubble and ticker.
- `story.json` — stage names, narration, and encounter text, bilingual.

Bilingual content lives **inside** these data files (fields keyed by `en`/`fil`). `i18n.js` only handles interface chrome.

## 6. JavaScript module specs

### Core

**`core/state.js`** — gatekeeper for storage (section 4). Exposes: `getXP/addXP`, `getStreak/bumpStreakIfNewDay`, `getHearts/loseHeart/resetHearts`, `markHazardExplored/getExploredCount`, `getBadge/setBadge`, `hasWatchedVideo/markVideoWatched`, `getHurdleStatus/setHurdleStatus`, `getShieldPieces/getCurrentStage`, `isUnlocked(hazardId)`, `getLanguage/setLanguage`, `resetAllProgress()`.

**`core/i18n.js`** — English/Filipino **interface** strings only (nav, buttons, mascot lines, quiz/game UI copy). Elements carry `data-i18n="key"`. Exposes `setLanguage(lang)`, `getLanguage()`, `t(key)` (falls back to English if a Filipino string is missing so nothing renders blank), and `applyToPage()`. Persists the choice through `state.js`. Content modules read `getLanguage()` to pick the right field from bilingual JSON.

**`core/mascot.js`** — central controller for the eagle everywhere. States: UI reactions (idle, wave/greet, happy bounce, gentle shake, cheer) and Story states (fly/walk, brace, hazard reactions, triumph). Exposes `setExpression(state)`, `greet()`, `reactToAnswer(isCorrect)`, `reactToGameEnd(outcome)`, `getRandomTip()`. Pulls dialogue from `i18n`. It is **reaction-only**: callers decide *when* to react.

### Quiz

**`quiz/quiz-engine.js`** — one generic engine for every hazard's quiz. Exposes `loadLesson(hazardId, lessonId)`, `renderQuestion(question)` (branches by the four question types), `submitAnswer(answer)` (checks, deducts a heart on a miss, triggers the mascot reaction, always shows the explanation), `advanceOrEnd()`, `computeStars(accuracy)`, `getWhatYouLearnedRecap(lessonId)`. Handles 3 hearts, progress bar, XP award, lesson sequencing. Difficulty tiers are a **data** concern, not an engine concern.

### Games

All games read their config from `js/data/games/*.json`, touch `state.js` for hearts/XP/badge, call `mascot.reactToGameEnd()` at round end, and finish with a one-sentence takeaway.

| Module | Rendering | Key functions |
|---|---|---|
| `gobag.js` | DOM + CSS (HTML5 drag-and-drop + tap fallback) | `loadItemSet`, `onItemDragToBag/onItemTap`, `checkPacked`, `startTimer/onTimeUp`, `endRound` |
| `dino-jump.js` | `<canvas>` + rAF | `init(canvas, cfg)`, `gameLoop`, `handleInput`, `checkCollision`, `loseHeart`, `getDifficultyForElapsedTime` |
| `maze.js` | DOM grid (CSS grid + transitions) | `loadLayout`, `movePlayer`, `onHazardTileHit` (reset to checkpoint), `checkReachedSafeZone`, `showGhostPathAfterFailures` |
| `puzzle.js` | DOM + CSS drag-and-drop; branches by sub-type (sequence / jigsaw / match) | `loadPuzzleSet`, `renderBySubtype`, `onPieceDropped` (gentle bounce-back), `checkComplete` |
| `jumbled-words.js` | DOM + CSS (tap tiles, no drag) | `loadWordBank`, `shuffleLetters`, `onLetterTap`, `checkAnswer`, `useHint`, `showDefinition` |
| `match-icons.js` | DOM + CSS (memory-flip and drag modes) | `loadIconSet`, `onTileFlip`, `onIconDroppedOnLabel`, `checkAllMatched` |
| `dodge-collect.js` | `<canvas>` + rAF | `init`, `spawnFallingObject` (good vs. bad ratio, speed by elapsed time), `handleInput` (single axis), `checkCatch`, `gameLoop` |

Shared helpers (PROPOSED): `dragDropHelper.js` (drag logic used by Go Bag, Puzzle, Match Icons' drag mode, and quiz sequencing), `canvasGameLoop.js` (rAF wrapper + delta time for the two canvas games), `game-loader.js` (loads only the module a hazard needs via dynamic `import()` or a small dispatcher — decide which). Consider splitting `puzzle.js` into three files only if the branching grows unwieldy.

### Pages and shell

**`main.js`** — the one script every page loads; deliberately thin. `bootstrap()` registers the service worker, mounts the hotline panel on every page, initializes `i18n` (applies the saved language immediately to avoid a wrong-language flash) and `mascot`, then `routeToPageController()` hands off by a `data-page` attribute on `<body>`. Marks a hazard "explored" when its learning view loads (`courses.html?hazard=<id>`). If it accumulates real feature logic, that logic belongs in a module.

**`dashboard/dashboard.js`** — Profile page controller. `init()`, `renderGreeting()`, `renderJumpBackIn()` (reads story progress), `renderInfographics()`, `renderExploreTiles()`, `renderStatsCard()` (XP, streak, badges, hazards cleared, shield pieces), `startTickerRotation()`. Always computes from `state.js` fresh on load.

**`dashboard/hotline-panel.js`** — the sticky Emergency panel. `render(container)` (mountable on any page), `toggleExpanded()`, `getLocalNumbers()` (from `local-hotlines.json`). Bilingual labels. Mounted site-wide by `main.js`, not just on the Profile page.

**`story/story-mode.js` (PROPOSED)** — builds the journey from `hazards.json` sorted by `storyStage`/`storyOrder`; handles the encounter flow (approach → video cutscene via the video modal → unlock → game → quiz → reward); updates hurdle status and shield pieces through `state.js`; triggers the Seal of Kalasag certificate at the end. Blocked on the open Story Mode decisions.

**`pages/collection.js`, `pages/courses.js` (PROPOSED)** — render the Collection grid (unlocked items from `state.isUnlocked`) and the Courses page. `courses.js` reads `?hazard=<id>`: without it, it renders the catalog (category rows, filter chips, search); with it, it renders the hazard learning view (video modal gate, text meanings, infographic, subject strip) and marks the hazard "explored".

## 7. CSS specs

All stylesheets build on tokens from `variables.css`. Rule of thumb: a style used on only one page belongs in that page's stylesheet, not `components.css`.

- **`variables.css`** — design tokens: category colors, neutral/dark-navy palette, typography scale, spacing scale, radius/shadow tokens (pixel-style: hard stepped shadows, near-zero radius), safe-area insets (for installed PWA edge-to-edge use), z-index scale (hotline panel, mascot overlays, modals), image-rendering token for crisp sprites, sprite scale steps (1x/2x/3x).
- **`components.css`** — shared kit: buttons (primary yellow CTA, secondary, icon-only game controls), card base, **hazard card** (icon + name; the tappable entry point), mascot bubble/avatar frame, badge and star components, emergency chip/panel shell, progress ring and bar, language toggle, and the **video modal** (backdrop, centered responsive player, persistent Skip control; reusable so it opens both for first-visit autoplay and the "▶ Watch video" replay).
- **`dashboard.css`** — Profile layout: main column + sticky sidebar, Jump-back-in card, infographics grid, Explore tiles, stats card, ticker animation. Motion stays calm so nothing competes with the emergency panel.
- **`quiz.css`** — hearts row with loss animation, top progress bar, layouts for the four question types (option grid, image thumbnails, true/false buttons, sequencing tiles/slots), correct/incorrect feedback (bounce glow vs. gentle shake, under ~1 s to keep lessons brisk), end-of-lesson summary (stars, message, recap, XP).
- **`games.css`** — drag items and drop targets, maze tiles, letter tiles, memory-flip cards, canvas container + HUD (hearts/score/timer), end-of-round takeaway banner, generous touch targets (bigger on Easy).
- **`story.css` (PROPOSED)** — map/stage scenes, encounter overlays, shield-piece display.

## 8. HTML pages and PWA specs

| Page | Sections / role | Scripts | Styles |
|---|---|---|---|
| `index.html` | Welcome page (Part 1, 4.1). Stays very light. | `main.js` only | variables, components |
| `dashboard.html` | Profile/Dashboard shell: semantic containers that `dashboard.js` fills (greeting, Jump back in, infographics, Explore tiles, stats, hotline mount, ticker). No baked-in placeholder progress values. | `main.js`, `dashboard.js` | variables, components, dashboard |
| `story-mode.html` (PROPOSED) | Journey map + encounter screens | `main.js`, `story-mode.js`, `game-loader.js`, `quiz-engine.js` | variables, components, story, quiz, games |
| `courses.html` | **Two views in one page.** *Catalog* (no param): Learning Journeys rows + All Hazards grid (19 cards) + filter chips + search. *Hazard learning view* (`?hazard=<id>`, the former `hazard.html`): header (icon, name, category color) → **video modal gate** (first visit autoplays with Skip; return visits skip it) → **text meanings** (six beats) → infographic (preview + PDF download) → subject-connect strip. Everything routed through `hazards.json` + `i18n`, no hardcoded hazard content; an unknown or missing `hazard` id falls back to the catalog. | `main.js`, `courses.js` (+ video-modal logic) | variables, components, dashboard-like grid styles |
| `collection.html` (PROPOSED) | Unlocked games + quizzes grid, completion indicator | `main.js`, `collection.js`, `game-loader.js`, `quiz-engine.js` | variables, components, quiz, games |
| `subject-connect.html` | Subject tabs, content cards per subject, cross-links to `courses.html?hazard=<id>` | `main.js` | variables, components |
| `offline.html` | Friendly fallback when a page isn't cached | — | variables, components |

**PWA files** (code in Appendix A):
- **`manifest.json`** — app name/short name, `start_url` = `/index.html`, `display: standalone`, theme/background colors (the mascot's brand color, not any single hazard's), icons at 192 and 512 plus maskable variants. Icons still need to be exported from the final eagle art (a tool like Maskable.app can make the maskable versions).
- **`service-worker.js`** — three caches:
  - **Shell cache:** HTML/CSS/JS/`hazards.json`/icons, precached on install (cache-first) so the whole interface works offline.
  - **Data cache:** hazard/quiz/game JSON via stale-while-revalidate (serve cached instantly, refresh in background) so content can update after deploy without breaking offline use.
  - **Media cache:** videos and PDFs are **never precached**; cached only when viewed or when a "Save for offline" button posts a `CACHE_MEDIA` message (so first install stays fast and storage small).
  - Lifecycle: `install` (precache shell), `activate` (delete old cache versions), `fetch` (route by URL), `message` (on-demand media caching).
  - **Maintenance:** the `SHELL_FILES` list in the Appendix A code predates Story Mode, Courses, and Collection — add the new pages/scripts/styles to it, **replace `/hazard.html` with `/courses.html`**, and bump `CACHE_VERSION` on any deploy that changes the shell list. Query strings (`?hazard=<id>`) break exact cache matching, so the Appendix A `cacheFirstIfPresent` now uses `ignoreSearch` for page navigations; otherwise the hazard learning view wouldn't load offline.
- **`offline.html`** — fallback for failed navigations.

## 9. Implementation guardrails

1. **No login, backend, or database.** If a feature seems to need one, flag it instead of adding one.
2. **Kid-safe content:** pixel-art perils only, no graphic disaster imagery, no live-action disaster footage; bullying and stranger-danger framed around "who to tell."
3. **Originality and copyright:** Codédex is an inspiration for *structure and style only*. Do not copy its artwork, branding, name, fonts, or copy. Create original pixel art and original story content.
4. **Single-gesture controls**, generous touch targets, and gentle (never punitive) feedback throughout.
5. **Bilingual by default:** every user-facing string and piece of hazard content has `en` and `fil`.
6. **Performance on weak devices and networks:** lightweight animation, lazy-load media, load only the game module a page needs, keep `hazards.json` lean.
7. **One source of truth per concern:** hazard identity in `hazards.json`; storage in `state.js`; interface strings in `i18n.js`; mascot behavior in `mascot.js`. Same hazard icon/color everywhere.
8. **Defensive storage:** try/catch on every storage access with an in-memory fallback; namespaced keys; no personal data.
9. **Accuracy of safety information:** hotline numbers and DRRM facts must be verified; the local numbers are placeholders until filled in.
10. **Respect OPEN items** (Part 1, section 7): propose and ask rather than deciding silently.

## 10. Suggested build order (PROPOSED)

Build a thin vertical slice first, then widen.

1. **Foundations:** `variables.css`, `components.css`, placeholder pixel assets, `state.js`, `i18n.js`, `main.js`, `hotline-panel.js`.
2. **Welcome page** and **Profile page** (with empty/first-visit states).
3. **`hazards.json` + 2–3 sample hazards end-to-end** (e.g., Earthquake, Fire, Typhoon) as a vertical slice: Courses card → video modal → text meanings → infographic.
4. **Quiz engine** with one hazard's quiz JSON.
5. **Games, simplest first:** Jumbled Words → Match the Icons → Go Bag → Puzzle → Maze; then the canvas games with the shared loop (Dino-Jump, Dodge & Collect).
6. **Story Mode** once the story decisions are made, wiring encounter → unlock → challenge → gate → reward.
7. **Collection** and **Subject Connect**.
8. **Fill in the remaining 16 hazards' content**, videos, and infographics (19 total, including the four newly added: Oil/Chemical Spill, Electrical, Crowd Crush, Community Conflict).
9. **PWA polish** (update `SHELL_FILES`, icons, test offline), then test on low-end school devices and Filipino-language review.

---

# APPENDICES

## Appendix A — Existing code

These files were already created. They are the only code that exists so far.

### `manifest.json`

```json
{
  "name": "Kalasag Kids - Disaster Preparedness for Young Learners",
  "short_name": "Kalasag Kids",
  "description": "Learning to stay safe, one hazard at a time.",
  "id": "/",
  "start_url": "/index.html",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#ffffff",
  "theme_color": "#2b6cb0",
  "lang": "en",
  "icons": [
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/assets/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### `offline.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You're offline — Kalasag Kids</title>
  <link rel="stylesheet" href="/css/variables.css" />
  <link rel="stylesheet" href="/css/components.css" />
  <style>
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
      font-family: system-ui, sans-serif;
    }
    .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="offline-icon">🛡️</div>
  <h1>No internet? No problem.</h1>
  <p>
    This page hasn't been saved yet, but your Dashboard, quizzes, and games
    already work offline. Head back and pick something you've visited before!
  </p>
  <a href="/dashboard.html" class="button">Back to Dashboard</a>
</body>
</html>
```

### `service-worker.js`

```javascript
/**
 * service-worker.js
 * -------------------------------------------------------------
 * Three cache tiers, because not everything should be treated the same way:
 *
 * 1. SHELL_CACHE   — HTML/CSS/JS/JSON/icons. Small, precached on install.
 *                    This is what makes the ENTIRE app usable offline
 *                    (dashboard, quizzes, games, infographics text/UI)
 *                    even with zero connectivity.
 *
 * 2. DATA_CACHE     — hazard JSON, quiz JSON, game config JSON.
 *                    "Stale-while-revalidate": serve the cached copy
 *                    instantly, then quietly fetch a fresh copy in the
 *                    background for next time. Keeps content editable
 *                    after deploy without breaking offline use.
 *
 * 3. MEDIA_CACHE    — hazard videos + infographic PDFs. NEVER precached.
 *                    Only cached when a student actually opens a video,
 *                    or taps an explicit "Save for offline" button.
 *                    This is what keeps first install fast and storage
 *                    usage reasonable on shared school devices.
 *
 * Bump CACHE_VERSION whenever you change the SHELL_FILES list or ship
 * a new deploy — this forces old caches to be cleared out.
 * -------------------------------------------------------------
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `kalasag-shell-${CACHE_VERSION}`;
const DATA_CACHE = `kalasag-data-${CACHE_VERSION}`;
const MEDIA_CACHE = `kalasag-media-${CACHE_VERSION}`;

// Everything here loads on install, so keep this list to small files only.
// Add every hazard's HTML/CSS/JS/icon dependency, but NOT videos/PDFs.
const SHELL_FILES = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/courses.html",
  "/subject-connect.html",
  "/offline.html",

  "/css/variables.css",
  "/css/components.css",
  "/css/dashboard.css",
  "/css/quiz.css",
  "/css/games.css",

  "/js/main.js",
  "/js/core/state.js",
  "/js/core/i18n.js",
  "/js/core/mascot.js",
  "/js/quiz/quiz-engine.js",
  "/js/games/gobag.js",
  "/js/games/dino-jump.js",
  "/js/games/maze.js",
  "/js/games/puzzle.js",
  "/js/games/jumbled-words.js",
  "/js/games/match-icons.js",
  "/js/games/dodge-collect.js",
  "/js/dashboard/dashboard.js",
  "/js/dashboard/hotline-panel.js",

  "/js/data/hazards.json",

  "/manifest.json",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];

// File-type helpers so routing logic below stays readable.
const isMediaRequest = (url) =>
  url.pathname.startsWith("/assets/videos/") ||
  url.pathname.startsWith("/assets/infographics/");

const isDataRequest = (url) =>
  url.pathname.startsWith("/js/data/") && url.pathname.endsWith(".json");

// ---------- INSTALL: precache the app shell ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: clear out old cache versions ----------
self.addEventListener("activate", (event) => {
  const keepCaches = [SHELL_CACHE, DATA_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !keepCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------- FETCH: route each request to the right strategy ----------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests; let everything else pass through.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (isMediaRequest(url)) {
    event.respondWith(cacheFirstIfPresent(event.request, MEDIA_CACHE));
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
    return;
  }

  // Default: app shell files (and page navigations) — cache first, network fallback,
  // with an offline fallback page for navigations that fail entirely.
  event.respondWith(
    cacheFirstIfPresent(event.request, SHELL_CACHE).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match("/offline.html");
      }
    })
  );
});

// ---------- Strategies ----------

// Serve from cache if present; otherwise fetch from network and store a copy.
// Used for: shell files (already cached at install) and media (cached on demand).
async function cacheFirstIfPresent(request, cacheName) {
  // Page navigations ignore the query string so courses.html?hazard=<id> matches the cached /courses.html shell.
  const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

// Serve cache instantly if we have it, then refresh it in the background.
// Used for: hazard/quiz/game JSON, so content can update after deploy
// without ever leaving the student staring at a blank screen offline.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached); // offline and nothing new — fall back to cache

  return cached || networkFetch;
}

// ---------- Explicit "Save for offline" support ----------
// Call from the page like:
//   navigator.serviceWorker.controller.postMessage({
//     type: "CACHE_MEDIA",
//     urls: ["/assets/videos/earthquake.mp4", "/assets/infographics/earthquake.pdf"]
//   });
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_MEDIA" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(MEDIA_CACHE).then((cache) => cache.addAll(event.data.urls))
    );
  }
});
```


## Appendix B — Decision log

| # | Decision | Notes |
|---|---|---|
| 1 | Static site: HTML, CSS, vanilla JS (ES modules) + JSON via `fetch()` | No PHP, no classic Ajax, no backend, no database |
| 2 | All state is local (`localStorage`/`sessionStorage`), no accounts | Includes a reset option for shared devices |
| 3 | Domain: `.com`; free static host for the defense | Free subdomain + HTTPS on GitHub Pages / Netlify / Vercel / Cloudflare Pages |
| 4 | Build as a **PWA** for offline use | Media is cached on demand, not precached |
| 5 | Chatbot / "innovative feature" **on hold** | Revisit later; scripted FAQ bot keeps it backend-free |
| 6 | Videos: **one ~1-minute video per hazard**, six fixed beats | Replaced the earlier 2–3 minute plan |
| 7 | Video behavior: first visit → modal with Skip → text meanings; later visits → straight to text with a "Watch video" option | Tracked per hazard, per device |
| 8 | Mini-games: **seven** templates (added Jumbled Words, Match the Icons, Dodge & Collect), each reskinned per hazard | One primary game + one optional bonus round per hazard |
| 9 | Inspiration: Codédex **structure + pixel-art look only**; no login, no community page | Original art and content only |
| 10 | Mascot is an **eagle**, used on every page and as Story Mode's protagonist; **no character creation** | Working name "Agila" (placeholder) |
| 11 | **Profile page = the Dashboard** (merged) | Includes progress stats, Jump back in, infographics, hotlines, tips |
| 12 | **Courses / Learning Journeys** = videos + infographics, freely browsable | Modeled on Codédex's course catalog |
| 13 | **Collection** = unlocked mini-games + quizzes, freely replayable | No posting/forum; infographics not collected here |
| 14 | **Story Mode:** the eagle's quest to a destination; hazards are the hurdles; encountering a hurdle unlocks its quiz + mini-game | Quest *structure* inspired by classic fantasy quests; story is original and still a draft |
| 15 | Assumption (unconfirmed): infographics appear both on Profile and in Courses, always ungated | Confirm with the project owner |
| 16 | **Hazard list is final at 19** | Supersedes the 15-hazard working set; adds Oil/Chemical Spill, Electrical, Crowd Crush, Community Conflict to the content scope. Every count, example, and table reflects 19 |
| 17 | **`hazard.html` becomes the Courses page** | `courses.html` = catalog view + hazard learning view (`?hazard=<id>`). No separate hazard page. Service worker and links updated accordingly |
