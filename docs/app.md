# App: the manual Storyteller grimoire

This file owns what the Storyteller can do: screens, edits, what asks first, how features fit
together, offline use and language. [UI](ui.md) owns how it looks, [Engine](engine.md) what a
recorded edit means and [Store](store.md) how games are saved and replayed.

The app records, the Storyteller rules. During play nothing reads a character's ability: no
target is legal or illegal, no information is calculated, no death, win or other consequence is
inferred ([Model](model.md) says why). The optional setup shuffle is the one place that knows what
characters do, and only to pick a bag. Editions and custom scripts get the same manual board.

## Layers

Six folders under `src/` import downward only, and `eslint.config.js` checks it.

- `app/` imports `features/` and composes routes.
- `features/` imports `ui/`, `store/`, `engine/` and `content/`, never another feature.
- `ui/` imports `content/` for types, character records and art, never Engine or Store. Shared
  visual pieces receive data and callbacks; transient display state may live here.
- `store/` imports `engine/` and `content/`.
- `engine/` imports `content/` and reduces recorded edits without I/O.
- `content/` imports none of the higher layers.

A saved operation two features share belongs in Store, a shared visual interaction in UI. No
feature rebuilds a character-rules interpreter above the reducer. The game route hands the board
the setup and day windows and the day timer, so the board never imports those features.

## Screens

| Route | Feature | What it is |
| --- | --- | --- |
| `/`, `/[lang]` | `home` | Resume or start a game, scripts, history, settings; `/fr` and the like for search |
| `/new` | `setup` | Script, seat count and optional bag |
| `/game/[id]` | `board`, `setup`, `day` | The board; `?draw=` and `?discovery=` hold a player's turn, `?replay=1` the replay |
| `/history`, `/history/[id]` | `history` | Saved games, optionally one opened |
| `/scripts` | `scripts` | Read, compose, import, share and print scripts; homebrew characters |
| `/settings` | `settings` | Language, grimoire colour, feedback and About |

## The Storyteller's path

The screen stays awake while a game is open.

### Setup

Pick an edition or a saved custom script, choose its roles and set one to twenty seats. Nothing
blocks a manual setup: no distribution, adjacency or disguise rule. Any character can repeat, and
the bag can hold fewer tokens than seats, or none. Fabled, Loric and Lil' Monsta take no seat.

Shuffle is optional. From five to fifteen seats it starts from the standard team counts and
applies the setup changes of the characters it picks:

- Outsiders: Baron plus two, Fang Gu plus one, Vigormortis minus one if there is one, Godfather
  one either way, Balloonist zero or plus one, Hermit zero or minus one. Xaan, Atheist, Legion,
  Kazali and Lord of Typhon allow any count, and Xaan overrides the others.
- Companions: the Huntsman brings the Damsel, the Choirboy the King.
- Teams: the Summoner replaces the Demon with a Townsfolk, Lil' Monsta with an extra Minion.
  Atheist has no evil, Kazali no starting Minions, Lord of Typhon one more Minion. Legion flips
  the split, the usual evil count becoming the good players. Village Idiot comes in one to three
  copies.

A good character that changes the setup is picked as often as any other character of its team.

Above fifteen seats shuffle adds the script's Travellers; below five it just draws primary roles.
It never picks Fabled or Loric, leaves the Marionette out of Summoner and Lil' Monsta games, and
keeps the old selection when no bag fits. Other jinxes, alignments, seating and granted abilities
stay with the Storyteller, and setup notes flag the roles that need a decision.

The Drunk, Lunatic and Marionette never see their own token. The bag gives the Drunk and
Marionette a Townsfolk not in play to show, and the Lunatic a Demon in play, never two disguises
alike. A Marionette is shown the Huntsman only when the Damsel is in play, as their jinx asks.
While choosing the characters, under the setup note of each one in the bag, the Storyteller may
pick what it shows instead: a Townsfolk not in the bag, or for the Lunatic any Demon. Left alone,
the bag picks. The setup window only deals the bag: a refill there keeps a choice while the new bag
leaves it free, and lets the bag pick for a new disguise. The deal records the disguise as a paper
grimoire would ([Model](model.md#identity-survives-changes-to-the-ring)).

Open grimoire saves the game with every seat empty and the bag face down. Let players draw has
each player tap a token that is then theirs, so nobody feels the Storyteller chose for them; the
Storyteller deals the drawn tokens after the last player. Deal at random keeps what players drew
and spreads the rest.
Dealt Minions and Demons start evil, everyone else good.

Discovery is for boards set by hand: each player in turn sees their token and its side, the shown
character when one is saved. A seat sitting as the token its player believes in shows that
token's side, so a Marionette sitting as the Chef sees a good Chef. A player may hold the device
on these screens, so they have no close control and the way back warns that it reveals everything.

Start the first night is never blocked, whatever the bag, deal or bluffs.

### Board edits

The Storyteller adds, renames and removes seats, gives or clears characters, sets alignment and
life, spends and restores ghost votes, places reminders and notes, chooses bluffs and adds Fabled
and Loric. Changing a character keeps its alignment. Alignment, life and ghost vote edits keep the
seat menu open for the next one, and removing a seat asks first. Nothing edits a shown character
or an ability annotation; old ones stay readable.

Arrange the seats, in More, is the only way to move seats. It turns the whole ring one place at a
time, so every player keeps their neighbours.

A placed reminder or note moves to another seat by dragging it. The move is one action that takes
it off and places it again, with no new kind of edit, so one undo puts it back where it was.

Any seat, an empty one too, takes any reminder from the script or its loose characters, recorded
characters first, with no ability source to pick. A note needs text, and this game's notes come
back in the picker. Bluffs are up to three Townsfolk or Outsiders not in play, hidden below seven
players unless saved, since the Demon gets none there.

The cards are the six info tokens the night sheet names, the character tokens alone, which it asks
for more often than any of them, and a written note. A homebrew character's own card text, from its
script, adds one more card with its token ([Content](content.md#homebrew-characters)). A side goes
with You are, as the official app sends it with a thumb, so no card tells a side on its own. You are
starts from the character its player believes and shows it in the side they believe, read from the
board, so a side that changes is recorded before it is shown. This player is starts from the seat's
character, or from nothing on a disguised seat, since the Demon must learn a real Marionette or
Lunatic while a Drunk's real token must never go out on a hasty tap. Every other card keeps each
token in its team's colours, as the printed token is, so no card tells one player another's side.
The Storyteller can change or add to any card's characters, since a poisoned player may be shown
something false, and a card about characters takes as many as they pick. The not-in-play card starts
from the saved bluffs and offers the good characters in play last, which its shuffle never picks,
since a Lunatic may be shown any good characters. A card's tokens leave out the night and reminder
marks, as the setup reveal does. Showing a card records nothing.

The character and night references open from the board's edge. Whether they are open is a
display choice, never a game event ([UI](ui.md#the-board)).

### Night

The night references follow the bundled night order and show what is in play by default, dead
seats and loose characters included, or the whole script. Below seven players, Travellers not
counted, the Minion and Demon info rows drop out; an empty seat counts as a player. There is no
checklist: reading a row records nothing.

### Day

Tap the nominator, then the nominee. A seat nominates once and is nominated once per day, with no
ability or life check. Hands toggle in any order, with no countdown, and a dead player votes only
with a ghost vote left. The threshold shown is the larger of half the living players, rounded up,
and one more than the day's best tally, with a tie once that tally reaches the minimum. It counts
living Travellers and adjusts for no character.

Mark and Done end the vote and spend the dead voters' ghost votes. Mark puts a skull on the
nominee, never an execution: the Storyteller records deaths. Cancelling a nomination gives back
the ghost votes it spent. The browser tab remembers an open nomination, so a reload reopens it.

### Ending

End game asks who won, good or evil. The app never detects a win.

## Saved games and replay

Every edit saves at once. Undo and redo are paused: no control calls them, so a mistake is fixed
with another edit, and [Store](store.md#the-cursor) keeps the operations so they can come back.

History reads recorded edits only: deaths, side changes, nominations and votes, each in its
phase, nothing inferred from an ability. A game resumes or replays in one tap, and game files
import as JSON. Deleting a game asks first and has no undo in the app ([Store](store.md) owns
recovery). Replay never changes the saved log ([UI](ui.md#replay)). The clock runs only while
the live board is open and visible ([Store](store.md#recorded-time)).

## Scripts

The script sheet reads, composes, imports, shares and prints scripts ([UI](ui.md#the-script-sheet)).
A custom script can use every character the app knows, homebrew ones included, and up to ten
homebrew rules, in the official order within each team ([Content](content.md#script-data)).
Unsaved scripts and characters survive a reload or a closed tab ([Store](store.md#drafts)), and
leaving with changes asks first. Custom scripts live on the device
([Store](store.md#custom-scripts-and-settings)). An account may come later; nothing may assume it.

Import takes a link, pasted JSON, a QR code or a file. Links from this app and from the official
Script Tool carry the whole script, so they open offline. A linked script opens unsaved, and
opening the same one twice keeps one copy. The paste field and the scanner exist because on an
iPhone a tapped link opens in Safari, whose storage is not the installed app's.

Sharing gives a QR code, a link, the share sheet or a file. The link holds the script in the URL
fragment, which the browser never sends to the host: nothing is uploaded and no server is
involved ([Store](store.md#script-links)). The link drops embedded art, which the file keeps.
Editions have no Share, since every device already has them.

### Homebrew characters

A Storyteller can write their own characters, with art, reminders, a setup mark and night wakes.
A character can carry a second image for the side opposite its team, since the tint of the art is
the only mark of alignment on the board ([UI](ui.md#tokens-and-art)). Saving one updates the
scripts that carry it; games keep their own copy. Each night offers three moments around its fixed
points, on one rule: whatever makes a player drunk or poisoned wakes before the characters it can
disable, and information wakes after all of it. The Storyteller can also pick an exact place in the
official order.

## Search and sharing

Search engines ignore the browser's language, so each language has its own Home: English at the
root, the others at their lower-case locale tag, such as `/fr` or `/es-419`. Each Home is wholly
in its language and lists every Home as an `hreflang` alternate, the root as `x-default`. Every
other route is `noindex, follow`: they are working screens for games on one device. That is an
indexing rule, not access control. The sitemap lists every Home.

A visitor with no saved game gets a prompt that opens a short About card. The card is a native
dialog, so its text stays in the exported page: text nobody could open would count as hidden. It
never opens by itself, since a dialog covering the page on load counts against it on phones.
Home never redirects to match the visitor's language. Search results use the 192-pixel icon,
since they show a site icon only at a multiple of 48 pixels. [UI](ui.md#home) owns the look.

Each Home names `search.jpg`, a square capture of the whole board, as its primary image. Left to
choose, search took the largest picture Home draws for the result thumbnail: a blank token disc.
The sharing image stays for link previews, which draw it wide, but is too wide and too full of text
to read as a thumbnail. Only crawlers fetch the thumbnail, so the offline download leaves it out.
Search shows one site name for every Home, the English one, so a language that names the app its
own way gives that name as an alternate.

## Attribution

The app is unofficial and non-commercial. Home ends with the official Community Created Content
badge. About, in Settings, says the app is not affiliated with The Pandemonium Institute, and that
Steven Medway and The Pandemonium Institute own the game, its characters, art and ability text.
The search text calls it an unofficial grimoire for games at a table, never a free app, so it
never reads as an alternative to the official one, and nothing mentions a price. About invites
players to buy a physical Grimoire. The contact address sits in a sentence about the app, so
nobody takes it for The Pandemonium Institute's. [UI](ui.md#settings) owns the presentation.

## Feedback

Most Storytellers have no GitHub account, so feedback goes by email first: Send feedback opens the
device's mail app with a subject and, below room to write, the app version, language, screen size,
installed or tab, and browser. Copy the address serves a device with no mail app set up. A link
opens GitHub's bug form with the same facts filled in, for those who have an account. The app sends
nothing itself and has no server for it: the person sees every word in their mail app or on GitHub
before it leaves, and nothing about a game goes with it.

The version is the build's own, as its service worker names it: the first seven characters of the
precache version, which changes exactly when the bundled files do. About shows it beside Source
code. A page no worker controls yet, the very first load, has none, and the email says so.

Home offers Feedback beside the badge to someone who has played, where a first visit gets About
instead, and opens Settings on its group. Settings always has it.

## Offline and installation

Everything a game needs is bundled, so after the first full download a game runs with no signal
and no account. Installing is left to the browser's own controls.

The app checks for an update on launch, when it becomes visible and every minute while visible.
A fully downloaded build takes over and refreshes open windows, games included, with no prompt:
every edit is already saved. A failed download keeps the current build.
[Store](store.md#offline-build-recovery) owns caches and recovery.

## Language

The language chosen in Settings wins on every screen, whatever the URL. On first use a language's
own Home sets it, or else the browser's language, then English. That first choice is saved, and
only Settings changes it. Spanish outside Spain gets the Latin American translation, any Norwegian
Bokmål. Game text falls back to English where an upstream translation is missing.
[Content](content.md#ui-strings) owns the translations.
