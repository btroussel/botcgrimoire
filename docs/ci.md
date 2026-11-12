# CI

What the checks cover, what they miss, and how a push to `main` reaches the site.

## Current checks

The [workflow](../.github/workflows/ci.yml) runs on every pull request, on every push to `main`
that changes more than Markdown or the license, and when started by hand. It uses the Node version
in [.nvmrc](../.nvmrc) and a clean install. `npm run verify` runs the lot:

- Types and lint: `npm run typecheck` and `npm run lint`, which also enforces the import layers.
- Unit tests: `npm test` covers content, the engine, saved games, the UI and features, the locale
  rules [Content](content.md#ui-strings) lists included.
- Generated files: `npm run content -- --check` makes sure they're up to date.
- Links: `node tools/check-links.mjs` checks every relative link and `#anchor` in the Markdown.
- Art: `node tools/normalize-character-art.mjs --check` and its unit test make sure no character
  icon keeps empty edges.
- Build: `npm run build` exports the site and its service worker. After changing `app.json` or
  `metro.config.js`, export once with `npx expo export --platform web --clear`, since Metro's cache
  doesn't notice those.
- Offline: `npm run test:pwa` checks the manifest, icons, sharing and search tags and font
  preloads, then runs the service worker in a simulated browser: offline routes, updates and failed
  downloads.
- Browser: `npm run test:browser` drives Chromium through the real export, one case per risk the
  other checks can't reach: offline use, a full game to Replay, phone layout and keyboard, long
  translated labels, scripts across devices, two windows on one game, what a printed sheet shows.
  Each page waits for React to hydrate first ([UI](ui.md#the-device)), or a check could pass on the
  static export instead of the app.

While working, `npm run check` is the quick loop: links, generated files, types, lint and unit
tests. Before a pull request, run `npm run verify`. A change to Markdown alone only needs
`node tools/check-links.mjs`.

Install the test browser once with `npx playwright install --only-shell chromium` (on Linux,
`npx playwright install-deps chromium` adds its libraries). The browser tests use port 4173, so keep
it free.

[Dependabot](../.github/dependabot.yml) proposes new major versions of the workflow's actions once a
month. Its version updates leave npm alone: Expo's packages move together and get upgraded by hand.
Its security updates are a repository setting, not that file, so an advisory on an npm package still
opens a pull request, and its lockfile change is reviewed as one that could [deploy](#deploy).

## Deploy

A push to `main` runs the same checks, then `wrangler deploy` uploads the export to Cloudflare. The
deploy runs on the same machine as `npm ci`, so an install script could tamper with wrangler while
the Cloudflare token is around: treat a change to the dependencies or the lockfile as one that
could deploy. The deploy step names this repository, so a fork runs the checks but never deploys,
and a renamed repository must update that name or deploys stop while the checks stay green.

Two exports of the same sources are identical, so a push that changes nothing the app bundles
uploads nothing and installed apps don't update. `wrangler.jsonc`, `public/_redirects` and
`public/_headers` hold the hosting rules, each with its reasons.

## What the checks miss

- The browser tests run in Chromium only, one case per risk, not every screen, language or phone.
  Safari, a real phone keyboard, the QR scanner and sharing still need a manual try, and so does the
  printed page's layout: the test checks what prints, not how it falls on A4.
- After an Expo upgrade, export twice with `--clear` and compare with `diff -r`: nothing checks that
  two builds still match.
- Green means the app records what the Storyteller enters. It says nothing about rulings.
- Upstream changes are checked by hand with `node tools/sync-upstream.mjs --check`.
