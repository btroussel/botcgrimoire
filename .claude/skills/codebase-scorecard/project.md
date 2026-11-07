# Project notes: BotC Grimoire

What the scorecard needs to know about this repository. The rubrics stay generic; this file says
how to run the app, where to look, and which of the project's rules count as findings.

## Run the app

Install, build the production export, then serve it with the host's routing rules and the offline
service worker:

```bash
npm ci
```

```bash
npm run build
```

```bash
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=.wrangler/test-logs node tools/browser/server.mjs
```

The app is at `http://127.0.0.1:4173`, ready once `/__test__/ready` answers. Use this rather than
`npm start`, so Performance measures the real bundle and the offline cache. The quick check for
Tests and guardrails is `npm run check`.

## Where to look

- Layers and their import rules: [docs/app.md](../../../docs/app.md#layers), enforced by
  `eslint.config.js`.
- Design tokens: `src/ui/theme.ts`. A color or size hard-coded elsewhere is a Design system
  finding. The UI contract is [docs/ui.md](../../../docs/ui.md).
- Saved games, migrations and undo: `src/store/` and [docs/store.md](../../../docs/store.md).
- Translations: `src/content/locales/<tag>/`, English is the source. Check French, German and
  Finnish.
- Offline: [docs/app.md](../../../docs/app.md#offline-and-installation), `tools/build-pwa.mjs`
  and `tools/service-worker.js`.
- What the checks prove and miss: [docs/ci.md](../../../docs/ci.md).

## Rules that count as findings

From [AGENTS.md](../../../AGENTS.md). Cite the rule with the finding.

- Character-specific code (resolution, target filtering, calculated information, automatic death
  or succession, reminder expiry, victory detection): major, under Documentation and compliance.
- An import that breaks the layer rules: major, under Architecture and layers.
- A game that needs the network at any point: blocker, under Performance and offline.
- An em or en dash in interface text: minor, under Texts and translations.

## User and journeys

The user is a Storyteller running a live, in-person game on one device, often a phone or tablet,
while the players wait. The UX categories are these three journeys, plus Texts and translations:

1. **Home and onboarding**: a first visit, understanding what the app is, settings and language.
2. **Game setup**: choosing a script, seating players, dealing characters, starting
   ([docs/app.md](../../../docs/app.md#setup)).
3. **Game**: the board, a first night in order, a day with a nomination and a vote, ending the
   game ([night](../../../docs/app.md#night), [day](../../../docs/app.md#day),
   [ending](../../../docs/app.md#ending)).
