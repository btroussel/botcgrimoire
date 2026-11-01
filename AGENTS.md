# BotC Grimoire

An electronic Storyteller Grimoire for Blood on the Clocktower. It replaces the hidden board the
Storyteller runs a game from: the seating circle, each player's role and states, reminder tokens,
and the night reference order, on one device. The app records manual edits, nominations and
votes. The Storyteller resolves every ability and records every consequence.

It is a web app only, an installable offline PWA hosted at botcgrimoire.com, built with Expo for
web (Metro bundles it) and no native build. Offline first: a game never needs the network, so
every piece of data and art is bundled. The UI text has one folder of JSON per locale under
`src/content/locales/`, named by its BCP 47 tag and registered by `npm run content`.

## The game

A social deduction game for 5 to 20 players and one Storyteller, who runs the game and sees
everything. Each player is secretly dealt a character, good (Townsfolk, Outsiders) against evil
(Minions and a Demon). At night the Storyteller wakes characters one at a time in a fixed order,
different on the first night, and from the second night the Demon kills. Drunk or poisoned players
have no ability but are treated as if they did, so what they learn may be false. By day players
nominate, vote and execute at most one. Good wins when the Demon dies, evil when only two players
are left alive, Travellers not counted. Travellers, Fabled and jinxes bend those rules. The app
still allows any board from one to twenty seats, so the Storyteller can run small or free games.

Unofficial fan project. The art, ability text and name belong to The Pandemonium Institute: keep it
free, non-commercial.

## Layout

- **`assets/`** The data and art the app bundles, so a game never fetches, and their sources:
  upstream data dumps, the custom-script schema, official art and our own art. `assets/README.md`
  says where each piece comes from.
- **`public/`** Copied to the site root as is: icons, the manifest, robots, sitemap, the sharing
  image, and the host's rules in `_headers` and `_redirects`.
- **`src/`** The app, six folders with imports flowing downward, which lint enforces: `app/`
  routes, `features/` screens, `ui/` shared pieces, `store/` the saved game, `engine/` the manual
  reducer, `content/` the characters and text. `ui/` never imports `store/` or `engine/`, and no
  feature imports another; [docs/app.md](docs/app.md#layers) has the exact rules.
- **`docs/`** What has to stay true, one file per concern. [docs/README.md](docs/README.md) maps
  each concern and source folder to its contract and explains how to resolve disagreements. Read
  the relevant contract before changing its concern, [docs/model.md](docs/model.md) for
  architectural reasoning and the scope of character support, and
  [docs/content.md](docs/content.md) for static character references.
- **`tools/`** Node scripts for the build, its checks and the bundled content, run from the
  repository root and indexed by `tools/README.md`. `sync-upstream.mjs` brings the upstream content
  in `assets/` to the current commit of each repository's ref in `assets/upstream.json` and records
  that commit there.

## Working in the repository

Use the Node version in `.nvmrc`. `npm ci` installs the locked dependencies; `npm start` opens the
web development server. [docs/ci.md](docs/ci.md) owns the verification commands and what each
proves. While working, `npm run check` is the quick loop; before a pull request, `npm run verify`
runs it, then builds and tests the site offline and in a browser. A change to Markdown alone needs
only `node tools/check-links.mjs` and a read for consistency with the code.
[CONTRIBUTING.md](CONTRIBUTING.md) sets the scope a change must keep to and the rules for interface
text and dependencies; the [pull request template](.github/pull_request_template.md) says what a
pull request states. Most browser specs find controls by their English labels and only
`npm run verify` runs them, so rewording an English string means searching `tools/browser/` for the
old text and updating the specs in the same change.

A push to `main` deploys botcgrimoire.com once the checks pass. Commit and push only when the
developer asks or approves; they say when to use a branch.

Other agents may be working in the same checkout. Re-read a file before editing it, preserve
unrelated changes, and never reset the working tree to make a task easier. Expo guidance about
EAS, native builds or native modules does not apply here.

## Character support

Adding a character, bundled or homebrew, changes data and never code. Bundled characters supply
names, ability text, reminders, art, jinx text and night ordinals from upstream through
`tools/sync-upstream.mjs`, never edited by hand; a homebrew character carries the same fields in
its own record. Do not add character-specific resolution, legal-target filtering, calculated
information, automatic death or succession, reminder expiry or victory detection. An ability
annotation is only a recorded reference. The same manual controls work on editions and custom
scripts. Old saved events may be read for compatibility without reviving their automatic
workflows.

## Taste

These are good defaults rather than hard rules: the developer's preferences can override them.

- **The smallest system that makes the correct behavior unsurprising.** Understand the real
  constraint, then meet it in the most minimal realistic way, no inherited complexity, no impressive
  machinery.
- **Comments carry why, and move when the code moves.** The code already says what it does, so a
  comment is for what it can't: the reasoning behind a choice, an outside constraint, a gotcha, a
  header over a long section. A game ruling is one or two lines in the comment's own words, never
  a quote or a "per the wiki". A function needing a long explanation is usually better rewritten,
  and a comment sending you to `docs/` better off saying the thing here.
- **Writing sounds like a person, not a model.** Plain active words that say the mechanism, not
  the feeling. No puffery, hedging, AI vocabulary or metaphor where a literal phrase exists. No
  em or en dashes, in prose or UI strings: a comma, colon or period reads better.
- **Format when the content has parts.** Headings and lists for things that really are lists; an
  answer to a question is prose. Sentence case headings, bold only for a term being defined, no
  decorative emojis.
- **A doc holds the architecture, constraints and decisions that last.** Not a tour of the files,
  not a changelog, not the code in prose. Give it a shape of its own, keep each decision in its
  owning file, and update it when the product changes.
- **A commit or PR tells one story.** Conventional-commit title,
  `fix(board): the seat sheet no longer swallows the first tap`. Body: the problem, then the fix.
  Small related changes can ride along, unrelated ones get their own. A UI pull request carries
  before and after images attached on GitHub, never committed to the repository. From gh 2.99,
  `gh pr create --attach` and `gh pr comment --attach` upload them, which needs write access to
  the repository; without it, the developer drops them into the pull request in the browser.
