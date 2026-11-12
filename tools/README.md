# BotC Grimoire: tools

Node scripts, run from the repository root by hand or through `package.json`. Each does one job.

- [sync-upstream.mjs](sync-upstream.mjs): brings the game data, schema, art and translations under
  `assets/` to the current commit of each repository's `ref` in `assets/upstream.json`, and records
  it there as the new pin. Run it to take an upstream update; `--check` only reports what would move.
- [build-content.mjs](build-content.mjs): `npm run content`. Writes `src/content/generated/`. Run it
  after a sync or a new locale; `--check` fails when those files are stale.
- [normalize-character-art.mjs](normalize-character-art.mjs): crops the transparent edges of the
  character icons with the sync's filter; `--check` fails when one still has them. Its test is
  `node --test tools/normalize-character-art.test.mjs`.
- [build-icons.mjs](build-icons.mjs): redraws `public/icons/` from the logo SVGs in
  `assets/art/logo/` and the textures they use, as [Icons](../assets/README.md#icons) describes.
- [build-pwa.mjs](build-pwa.mjs): the last step of `npm run build`. Hashes the export and writes its
  offline service worker from [service-worker.js](service-worker.js).
- [asset-paths.js](asset-paths.js): the Metro asset plugin in `metro.config.js`. It drops the `@` of
  scoped packages from exported asset folders, which the host would redirect.
- [check-links.mjs](check-links.mjs): part of `npm run check`. Fails when a relative Markdown link
  names a missing file or heading.
- [pwa.test.mjs](pwa.test.mjs): `npm run test:pwa`, after a build. Checks the export's metadata and
  its service worker, as [CI](../docs/ci.md#current-checks) lists.
- [browser/](browser/): the Playwright specs of `npm run test:browser`, run in Chromium against the
  export for the risks [CI](../docs/ci.md) lists. [server.mjs](browser/server.mjs) serves it locally,
  [app.mjs](browser/app.mjs) waits for hydration, and [locales.mjs](browser/locales.mjs) reads the
  bundled strings so a spec can check another language.
