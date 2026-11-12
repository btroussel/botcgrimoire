# How the app is built

One file per area. Each one says what the code relies on and why, not every detail: the code is
the reference for those.

| File | What it covers | Read it when you change |
| --- | --- | --- |
| [Model](model.md) | The big idea: a manual grimoire, what character support may include, the main boundaries | What the app represents, or whether a character needs code |
| [Content](content.md) | Character data, scripts, translations, art and generated files | Bundled material or its format |
| [Engine](engine.md) | The events a game is made of and how the board is rebuilt from them | An edit or how the board is computed |
| [Store](store.md) | Saving games, scripts and drafts, migrations, recovery, undo and replay | Saved data, undo or replay |
| [App](app.md) | What the Storyteller can do, screen by screen, and offline use | A feature |
| [UI](ui.md) | Layout, controls, focus and phones | How something looks or responds |
| [CI](ci.md) | The checks, what they miss, and the deploy | The checks or the workflow |

## Source folders

Imports flow downward: routes in `app/`, screens in `features/`, shared pieces in `ui/`, saved
games in `store/`, the board reducer in `engine/`, and static data in `content/`. Not every
downward import is allowed: [App](app.md#layers) has the exact rules, which `eslint.config.js`
checks. [tools/README.md](../tools/README.md) lists the scripts in `tools/`.

## Keeping the docs useful

Write down what would be wrong to change, with its reason: an outside constraint, something a
Storyteller relies on, the manual boundary. Leave out how a screen looks today, values tuned by
eye, and anything another file already says. When the code and a doc disagree, the latest
explicit decision wins: fix whichever is out of date.
