# Content: bundled reference material

Character data, scripts, translations and art. All of it ships with the app, so a game never needs
the network. [Model](model.md) explains why content is plain data, [App](app.md) how it's used.

## Sources and records

The sync tool mirrors game data from The Pandemonium Institute's repositories into `assets/data/raw`
at pinned commits; nobody edits it by hand. [Assets](../assets/README.md) says where each file comes
from, the [README](../README.md#licensing) who owns it.

- `roles.json`: ids, teams, editions, names, abilities, reminders and setup flags.
- `nightsheet.json`: the two night orders. A character's index is its reference ordinal, or it has
  no entry on that sheet. The order is a reference: it never decides who wakes in a game.
- `jinxes.json`: each pair and its reason, shown when both are on the script. Nothing enforces it.

`src/content/upstream.ts` reads the raw files, and the app gets joined, readonly records from
`src/content/index.ts`. A reminder is a name, a count and a global flag, with no effect or expiry.
Content holds no per-character rules: [Model](model.md#character-support) sets that boundary, and
the [setup shuffle](app.md#setup) works from ids, never ability text.

## Script data

A script is a bundled edition id or an embedded custom script in the official schema, kept in
`assets/schema` as the reference the import follows. [Store](store.md) owns saving it.

- Official characters reduce to their ids. Other character objects are
  [homebrew characters](#homebrew-characters).
- An id the bundled data doesn't know is kept, since it's usually a newer character. The sheet names
  it on a line of its own until an update bundles it.
- `_meta` keeps the name, author, logo link and the Bootlegger's rules, printed under the Bootlegger.
  Fields for other apps are kept so a file round-trips, never shown. Night order arrays are dropped.

A composed script lists each team in the official order, homebrew last by name. An imported script
keeps its own order. A custom script's Fabled and Loric belong to it: they print after the
Travellers, never count toward a team target, and start in play outside the ring. A script with
homebrew lists the Bootlegger. Teensyville (six Townsfolk, two Outsiders, two Minions, one Demon) is
recognised by size, since the schema has no flag for it.

## Homebrew characters

A homebrew character is a script item in the schema's object form, so the file stays readable by
other tools. Import needs an id, name, team and ability, and drops a wrongly typed optional field
rather than refusing the file. `special` features are kept for other apps, never run.

Lookups fall back to a registry of homebrew records, so a homebrew character shows wherever a
bundled one does. A bundled id always wins, and the open game's script fills the registry last, so
a game shows the copy it was made with. Its text is in one language.

Night positions are ordinals on the bundled sheets, and zero or none means it doesn't wake. A file
counts one higher, as the official Script Tool does, so reading takes one off and writing adds it.

Only an embedded `data:image/` icon is drawn. A web address is kept but never fetched, since a game
must not need the network or tell another server who is playing. An icon made in the app is cropped
to its visible pixels, or a photo to a centred disc, then sized like the bundled icons.

## UI strings

The app's own text lives in `src/content/locales/<tag>/<area>.json`, one folder per BCP 47 tag.
English is the reference key set. A value is a string with named placeholders like `{n}`, or a
plural: the forms its language's rule picks, plus `other` as the fallback. English takes `one` for
1, French for 0 and 1, and Polish adds `few` and `many`. A count shown in a string is a plural. The
`t` helper in `src/content/i18n.ts` falls back to English, and shows a key English lacks as the key
itself, so a gap stays visible. Tests check key parity, plural forms and punctuation.

To add a language: add its folder, add its tag to `locales` in `assets/upstream.json` with `_` for
`-`, run the sync and `npm run content`, and add its Home page to `public/sitemap.xml`. A tag like
`es-419` also needs an entry in `searchLanguages` in `src/features/shell/homePages.ts`. The sync
takes the latest upstream commits, so review its whole diff ([CI](ci.md)).

Character names, abilities, reminders and jinx reasons come from upstream's translations. The one
piece of game text a locale writes itself is the Minion and Demon info instruction in `night.json`:
upstream's sentence without the player count lead-in, which the night reference checks itself
([App](app.md#night)). The app never parses ability text or notes for rules.

## Character art

Character and team icons keep upstream's names. The sync crops their fully transparent edges without
resizing and re-encodes a cropped icon as WebP, lossy in colour and exact in alpha; an icon with
nothing to crop keeps upstream's bytes. Other art keeps its whole canvas, since a rim overlay's
transparent area places its marks. `tools/normalize-character-art.mjs` runs the same filter on the
icons in the tree, and running it twice changes nothing. Start an encoding change from upstream's
originals, so the lossy step happens once. [UI](ui.md) owns how the art sits on a token.

## Generated files

`npm run content` writes `src/content/generated/`: a static `require` per image so Metro bundles it,
the locale registry, and the English text of the non-character night steps, so the English
translation file isn't bundled. `--check` compares without writing. [Tools](../tools/README.md)
lists the other scripts.
