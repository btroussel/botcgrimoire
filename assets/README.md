# BotC Grimoire: assets

Everything the app bundles, so a game never fetches, plus a few sources it's built from: the script
schema, upstream's English translation and the logo drawings stay out of the bundle. Upstream files
keep their published names unless a line says otherwise.

- [upstream.json](upstream.json): the commit each upstream repository is pinned at, and the game
  translations taken. `node tools/sync-upstream.mjs` refreshes it, `--check` shows what moved.
- [data/raw](data/raw): the official game data (`roles`, `jinxes`, `nightsheet`) from
  [botc-release](https://github.com/ThePandemoniumInstitute/botc-release) `resources/data/`, and the
  translations from [botc-translations](https://github.com/ThePandemoniumInstitute/botc-translations)
  `game/`. Verbatim except the character flavor text, which no screen shows and the sync leaves out.
- [schema](schema): the official custom-script schema, botc-release's `script-schema.json`, saved as
  `script.schema.json`.

## Art

Official art from The Pandemonium Institute:

- [art/characters](art/characters): character icons from botc-release `resources/characters/`, one
  folder per edition, with good (`_g`) and evil (`_e`) tints where upstream draws them. `generic/`
  holds upstream's team icons, for a seat with no art of its own. The sync crops their transparent
  edges, as [Character art](../docs/content.md#character-art) describes.
- [art/editions](art/editions): edition and custom-script logos from botc-release
  `resources/editions/<id>/logo.webp`, saved as `<id>.webp`.
- [art/community](art/community): the "Community Created Content" parchment from botc-release
  `resources/community/`, converted to WebP by hand. The sync skips it.
- [art/generic](art/generic): the night sheet markers (dusk, dawn, Minion info, Demon info), taken
  by hand from the official Blood on the Clocktower website. The sync skips them.
- [../public/share.jpg](../public/share.jpg): the sharing image, a screenshot of a Trouble Brewing
  board in the app, so it shows official character art.

Our own:

- [art/tokens](art/tokens): token backgrounds, night, setup and count markers, and the back every
  role shares, `character_back.webp`, an original crescent engraving on the parchment disc.
- [art/paper](art/paper): an AI-generated warm vellum texture, repeated on paper surfaces.
- [art/velvet](art/velvet): AI-generated burgundy, forest, midnight and plum fabric textures, each
  stretched once across the board or page. These WebPs are the only copies, so they are the sources.
- [art/logo](art/logo): the SVG sources of our "Les petites flèches" logo.
- [../public/icons](../public/icons): the app icons drawn from that logo, see [Icons](#icons).

## Icons

The app icon is our "Les petites flèches" grimoire: a vellum book on burgundy velvet, its cover cut
away to a clock at ten to midnight. The PNGs sit in `public/icons/` because browsers load them
directly. The source is [les-petites-fleches.svg](art/logo/les-petites-fleches.svg), drawn with the
bundled vellum and velvet. The favicon comes from a flat redraw with thicker hands,
[les-petites-fleches-favicon.svg](art/logo/les-petites-fleches-favicon.svg), since the fine dial
blurs below 48 pixels. Change both together, then run `node tools/build-icons.mjs` and
`npm run build`.

- `icon-192.png`, `icon-512.png`: the usual PWA icons. Search results use the 192 one, since they
  show a site icon only at a multiple of 48 pixels.
- `icon-maskable-512.png`: the book fits the central safe circle, whose radius is 40% of the width,
  and the velvet fills the square for the launcher to cut its own shape.
- `apple-touch-icon.png`: 180px, without rounded corners baked in.
- `favicon.png`: 48px. Expo turns it into the 16, 32 and 48px `favicon.ico` through `web.favicon`
  in `app.json`.
