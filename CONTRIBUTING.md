# Contributing

Thanks for wanting to help. BotC Grimoire is a grimoire for in-person Blood on the Clocktower
games: the Storyteller makes every call, and the app keeps the board. A good change makes that board
faster, clearer or more reliable to run.

## What fits

These limits come from The Pandemonium Institute's
[Community Created Content Policy](https://bloodontheclocktower.com/pages/community-created-content-policy),
so a pull request that crosses one won't be merged.

- No character automation: no resolving abilities, filtering legal targets, working out
  information, automatic deaths, expiring reminders or detecting a winner. The Storyteller rules on
  all of that. [docs/model.md](docs/model.md#character-support) says what character support can
  include.
- Free and non-commercial: no ads, payments, donations or sponsorship.
- Web only: the app installs from the browser, with no app store builds.
- Clearly unofficial: nothing that could pass for a TPI product.
- Offline and private: a game never needs the network, so no requests to other sites, external
  scripts or analytics.

Open an issue first for a bigger change, a new dependency, font or large image, or anything that
touches the lockfile or `.github/workflows/`. Merging to `main` deploys the site, so those get a
closer look.

## Game content and translations

Character data, ability text, game translations and official art come from TPI and are synced with
`node tools/sync-upstream.mjs`. Don't edit them by hand. A wrong character name or ability in
another language gets fixed in TPI's [translation project](https://translation.botc.app), and the
app picks it up at the next sync.

The app's own text lives in `src/content/locales/`, one folder per language, with English as the
reference. The tests check a few things:

- Every language has exactly the same keys as English, so a new string needs a value in each one.
  If you can't write some of them, say which in the pull request.
- No em or en dashes in strings: use a comma, colon or period.
- The browser tests find buttons by their English labels. If you reword one, search
  `tools/browser/` for the old text and update it too.

[docs/content.md](docs/content.md#ui-strings) has the details, including how to add a language.

## Making a change

Use the Node version in `.nvmrc` (`nvm use` picks it up), then:

```sh
npm ci
npm start
```

`npm ci` prints a few warnings you can ignore. Don't run `npm audit fix --force`: it would
downgrade Expo, whose packages get upgraded together by hand.

- `npm run check` is the quick loop, about a minute: links, types, lint and unit tests.
- `npm run verify` is the full run before a pull request, about five minutes: it also builds the
  site and tests it offline and in a browser. Install that browser once with
  `npx playwright install --only-shell chromium`.

[The docs](docs/README.md) explain how the app is built, and [docs/ci.md](docs/ci.md#current-checks)
says what each check covers.

Whatever tools you use, you're the author of what you send. Read the whole diff, keep it to the
problem, and try the change yourself in the app, at phone width if it touches a screen. Saved games
must stay readable after your change, as [docs/store.md](docs/store.md#versions-and-migrations)
explains.

## Pull requests

Fork the repository, work on a branch and open the pull request against `main`. Keep it to one
change, with a [conventional commit](https://www.conventionalcommits.org) title such as
`fix(board): the seat sheet no longer swallows the first tap`, and say what was wrong, then what
you changed. For a UI change, attach before and after screenshots to the pull request rather than
committing them. The [template](.github/pull_request_template.md) walks you through it.

Bugs and ideas go through the [issue forms](https://github.com/btroussel/botcgrimoire/issues/new/choose).
Report a security issue privately, as [SECURITY.md](SECURITY.md) describes.

## License

Your contribution is licensed under the [MIT license](LICENSE), like the rest of the code. Game
content stays TPI's, as the [README](README.md#licensing) explains.
