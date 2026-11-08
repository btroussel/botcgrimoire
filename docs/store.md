# Store: saving games and moving through them

The store keeps everything on the device: games, the undo and replay cursor, play time, scripts,
homebrew characters, drafts and settings. [Engine](engine.md) says what an event does to the board
and [Model](model.md) explains why the log comes first.

## What is saved

One record per game, `SavedGame` in `saved.ts`. The log is the game; the rest is what you need to
open it again: the format version, an id, save times, the upstream commits it was played with, its
script and its play time. The script is embedded, so the game opens on a device that never saw the
script file, and editing the script later never changes the game. Nothing derived is saved, not
the board, not the redo stack. New appends accept only the edits [Engine](engine.md#events) lists.

Two optional pieces sit beside the log, because neither is a board edit. The discussion timer
saves a deadline while it runs, so it keeps counting while the app is closed. The bag holds the
tokens between Open grimoire and the deal; taking one appends nothing, and the deal appends its
edits as one batch and removes the bag.

## Where it lives

One IndexedDB database, `botcgrimoire`: a `games` store keyed by id, and a `settings` store with
the preferences, scripts, homebrew characters and drafts under their own keys. Never rename the
database or a key, since devices already hold data under them. `localStorage` is too small and
synchronous for a season of games.

Each game is written whole after every append: a log is a few kilobytes. On the first write the
store asks the browser for persistent storage; the app works if it says no. Deleting a game is
permanent, with no trash.

History imports a game file through the same migrations and checks as a load. It keeps its id
unless this device holds a different game under it, in which case both are kept.

Windows of the app on one device share the database, so a window still holding an older copy of
a game would put it back over newer edits at its next write, a play-time checkpoint included.
So a window's write lands only while the stored copy is still the one its screen was built on,
checked in the write's own transaction. When another window wrote first, that change and every
change made after it on the same screen are dropped, since each carries values this window saw,
and the window shows the stored copy: the Storyteller sees the other window's edits and taps
again. Nothing already saved is lost, and nothing is merged. Every write, delete and import tells
the other windows over a `BroadcastChannel`; a window reads the stored copy then, when it opens a
game, and when the board comes back into view while its clock runs. A game deleted in another
window is not written back, and one this version cannot read is left as it is: a window leaves
the game when its write finds either, or when it reads the stored copy and the game is gone. A
window on a build from before this rule writes as it always did.

## Versions and migrations

Every saved game stays readable, whatever version saved it. `version` goes up whenever `SavedGame`
or an event changes in a way an older app would misread, and `saved.ts` has one step per version,
`migrate1to2`, `migrate2to3` and so on. Loading runs the chain, checks the result and writes it
back. A game from a newer app is refused, and one that fails to migrate is left untouched, so a
bug cannot lose a log.

A step reads only the raw record, never the board. It keeps what old events meant and never
invents what the old format did not record: events saved before timing stay without a time. A
step that rewrites data has a test with a fixture in the old shape.

The `content` pin is separate from the format version. A character the current content no longer
has stays readable by its id, and an old reminder keeps its saved name. A mismatch is reported,
never fixed by rewriting the log.

## Offline build recovery

A service worker precaches the whole build, and the cache must never mix files from two builds.
Every file is checked against the SHA-256 hash the export recorded for it; a copy from an older
cache is reused only when its bytes match. A build that is incomplete or does not match never
activates, and the previous one keeps running.

The host redirects `.html` addresses and browsers refuse a cached page with redirect history, so
the worker strips it. Game addresses use exported route templates, since game ids exist only on
the device. An unknown address gets the cached not-found page, never the homepage. The worker
never touches IndexedDB, so a new build keeps every saved game.
[App](app.md#offline-and-installation) owns when an update downloads and activates.

## The cursor

`Session` in `session.ts` holds the live game, the redo stack and an optional replay cursor,
`lookingAt`. Only the game is saved. The board is `reduce(script, log)`, cut at `lookingAt` while
you look back, and every screen reads that one board from the React context in `index.tsx`.

- `appendAll` adds one gesture as one batch: one undo step and one write. Confirming a nomination,
  for example, batches its total with the ghost votes it spends.
- `undo` takes off the last batch and `redo` puts it back. Undo never removes the batch that set
  up the table.
- `lookAt` and `returnToPresent` move the cursor and write nothing. While you look back, nothing
  can be appended, undone or redone.

No control calls undo or redo today ([App](app.md#saved-games-and-replay)), but the operations
and their tests stay so the controls can come back.

## Recorded time

The store stamps event times; the engine never reads a clock. A batch gets one time, never earlier
than the event before it, and undo and redo keep the original times.

Play time is a list of finished intervals. The live board saves a checkpoint regularly and when
the page is hidden or closed. Every saved interval has an end, so a crash never counts the hours
the app was closed. Play time counts from creation, setup included, to the ending; older
`storyteller` mode games keep their first-night start. Replay adds no time, and edits after
`endGame` do not stretch the game.

## Custom scripts and settings

Settings hold the language and the board colour, apart from any game. The first render uses
English, or the language of a language's own Home ([App](app.md#search-and-sharing)), so it matches
the static export. After that the store applies the language [App](app.md#language) picks and
saves it; a route change never rewrites it.

Custom scripts are their own list, separate from the copy each game embeds, and
[Content](content.md#script-data) owns their format. Homebrew characters are a second list. An id
is the name's letters and digits plus four random ones, so it never matches an official id and is
unlikely to match someone else's character of the same name. Saving a character also updates its
copy in every saved script, in the same transaction; games keep the copy they started with.
[Content](content.md#homebrew-characters) owns how a record is read. Each list is read and
rewritten in one transaction, so two overlapping saves both land.

## Drafts

The script composer and the character editor save unsaved work on every change, along with what
the editor opened with, so a reopened draft still counts as changed. Saving or discarding clears
it; a failed save keeps it. [App](app.md#scripts) owns when it reopens. A draft of an unexpected
shape is ignored, not migrated: it is work in progress, not a record.

## Script links

A share link is `/scripts#script=` followed by the script file as compact JSON, raw deflate and
base64url. Browsers never send the fragment to the host, so the host learns nothing and the link
opens offline. Reading also accepts the official Script Tool's links, and runs the same checks as
an imported file. A link that inflates past a size cap is refused.

Links leave out embedded `data:` icons, which are too long for a chat message or a QR code. Art
given as a web address stays.
