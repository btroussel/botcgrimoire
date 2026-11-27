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
the setup and day windows, the day timer and the history window, so the board never imports those
features.

## Screens

| Route | Feature | What it is |
| --- | --- | --- |
| `/`, `/[lang]` | `home` | Resume or start a game, scripts, history, settings; `/fr` and the like for search |
| `/new` | `setup` | Script, seat count and optional bag; `?script=` opens on that script's bag, `?from=` seats a finished game's players |
| `/game/[id]` | `board`, `setup`, `day` | The board; `?draw=` and `?discovery=` hold a player's turn, `?replay=1` the replay, where the older `/game/[id]/history` address redirects |
| `/history`, `/history/[id]` | `history` | Saved games, optionally one opened |
| `/scripts` | `scripts` | Read, compose, import, share and print scripts; homebrew characters; `?import=1` opens the import window, a `#script=` link opens its script |
| `/settings` | `settings` | Language, grimoire colour, feedback and About |

## The Storyteller's path

The screen stays awake while a game is open.

### Setup

Pick an edition or a saved custom script, choose its roles and set one to twenty seats. Nothing
blocks a manual setup: no distribution, adjacency or disguise rule. Any character can repeat, and
the bag can hold fewer tokens than seats, or none. Fabled, Loric, Lil' Monsta and the Marionette
take no seat.

New game and the script library link to each other. New game lists the scripts as the library
does and, for a script it does not have, opens the library on its import window. The script
sheet starts a game on the script it shows, an edition or one saved on the device, straight on
its bag; a script from a link or a file is saved first. New game stays its own page because it is
walked at the table, two taps from Home to the bag, with nothing on it to compose or delete.

Shuffle is optional. From five to fifteen seats it starts from the standard team counts and
applies the setup changes of the characters it picks:

- Outsiders: Baron plus two, Fang Gu plus one, Vigormortis minus one if there is one, Godfather
  one either way, Balloonist zero or plus one, Hermit zero or minus one. Xaan, Atheist, Legion,
  Kazali and Lord of Typhon allow any count, and Xaan overrides the others.
- Companions: the Huntsman brings the Damsel, the Choirboy the King.
- Teams: the Summoner replaces the Demon with a Townsfolk, Lil' Monsta with an extra Minion, the
  Marionette its own seat with an extra Townsfolk. Atheist has no evil, Kazali no starting Minions, Lord of Typhon one more Minion. Legion flips
  the split, the usual evil count becoming the good players. Village Idiot comes in one to three
  copies.

A good character that changes the setup is picked as often as any other character of its team.

Above fifteen seats shuffle adds the script's Travellers; below five it just draws primary roles.
It never picks Fabled or Loric, leaves the Marionette out of Summoner and Lil' Monsta games, and
keeps the old selection when no bag fits. Other jinxes, alignments, seating and granted abilities
stay with the Storyteller, and setup notes flag the roles that need a decision.

The Drunk and Lunatic never see their own token. The bag gives the Drunk a Townsfolk not in play
to show, and the Lunatic a Demon in play, and no two disguises show the same character. While
choosing the characters, the Storyteller may pick what each disguise in the bag shows, under its
setup note: a Townsfolk not in the bag, or for the Lunatic any Demon. Left alone, the bag picks. The setup window offers no such choice: refilling the bag there keeps a
choice the new bag still leaves free, and the bag picks for any new disguise. The deal records the
disguise as a paper grimoire would ([Model](model.md#identity-survives-changes-to-the-ring)).

The Marionette must neighbor the Demon, and no draw can promise that. As in the paper rules, its
token stays out of the bag: selecting it adds a Townsfolk to the target, and the Marionette starts
off the ring like Lil' Monsta. After the deal the Storyteller puts Is The Marionette on a good
neighbor of the Demon and makes them evil, two ordinary board edits. Until then the off-ring token
and the first night's Marionette row are the reminder.

Open grimoire saves the game with every seat empty and the bag face down. Let players draw has
each player tap a token that is then theirs, so nobody feels the Storyteller chose for them; the
Storyteller deals the drawn tokens after the last player. A refill replaces only the face-down
tokens, since a player who drew has seen theirs. Deal at random keeps what players drew and
spreads the rest. Dealt Minions and Demons start evil, everyone else good.

Discovery is for boards set by hand: each player in turn sees their token and its side, the shown
character when one is saved. A seat sitting as the token its player believes in shows that
token's side, so a Marionette sitting as the Chef sees a good Chef. A player may hold the device
on these screens, so they have no close control and the way back warns that it reveals everything.

Start the first night is never blocked, whatever the bag, deal or bluffs.

### Board edits

The Storyteller adds, renames and removes seats, gives or clears characters, sets alignment and
life, spends and restores ghost votes, places reminders and notes, chooses bluffs and adds Fabled
and Loric. A seat's character comes from the script and its Travellers, an edition's own included.
Changing a character keeps its alignment. Alignment, life and ghost vote edits keep the seat menu
open for the next one, and removing a seat asks first. No board control edits a shown character
or an ability annotation: only the deal records the first, nothing records the second, and those
already saved stay readable.

Arrange the seats, in More, is where seats are added and the only way to move them. It turns the
whole ring one place at a time, so every player keeps their neighbours, or moves one seat: onto
another seat the two swap, into a gap the seat takes that place while the seats between close
up, and anywhere else on the board the token stays where it was let go. A seat moves with its
player, character, states and reminders. The order changes by `moveSeat` edits, a swap two of them
recorded as one action, so one undo puts the ring back as it was. Outside the arrangement nothing
moves a seat, so a layout cannot shift during play.

Letting a token go on the board lays the board out like the room, sofas and armchairs included: a
`placeSeat` edit records where it lies, as a share of the board, so the layout survives a turned
phone or another screen. Placing a seat never changes the order. Who sits next to whom, and so who
votes after whom, changes only by a swap or a gap, since a token dropped across a half-arranged
room would otherwise take its neighbours from wherever the others happen to be. Once the board is
laid out, a swap or a turn moves players between its spots, as on the circle, and a seat moved or
added into a gap sits between its new neighbours. Back to the circle, beside Done, puts every
token back on the circle as one action.

A placed reminder or note moves to another seat by dragging it. The move is one action that takes
it off and places it again, with no new kind of edit, so one undo puts it back where it was.

Any seat, an empty one too, takes any reminder from the script or its loose characters, recorded
characters first, with no ability source to pick. A note needs text, and this game's notes come
back in the picker. Bluffs are up to three Townsfolk or Outsiders not in play, hidden below seven
players unless saved, since the Demon gets none there. Their picker also shows them: Show saves the
set on screen and opens the not-in-play card with it, so what the Demon saw is what the tray
and the log hold.

The cards are the six info tokens the night sheet names, the character tokens alone, which the
sheet asks for more often than any of them, and a written note. A homebrew character's own card
text, from its script, adds one more card with its token
([Content](content.md#homebrew-characters)).

Only You are tells a side, as the official app sends one with a thumb. It starts from the
character its player believes and shows the side they believe, read from the board, so a side
change is recorded before the card goes out. Every other card keeps each token in its team's
colours, as the printed token is, so no card tells one player another's side. This player is
starts from the seat's character, or from nothing on a disguised seat: the Demon must learn a real
Marionette or Lunatic, but a Drunk's real token must never go out on a hasty tap.

The Storyteller can change or add to any card's characters, since a poisoned player may be shown
something false, and a card about characters takes as many as they pick. The not-in-play card
takes up to three and starts from the saved bluffs. It lists the good characters in play last,
since a Lunatic may be shown any good characters, and its shuffle never picks them. A card's
tokens leave out the night and reminder marks, as the setup reveal does. Showing a card records
nothing.

The character and night references open from the board's edge. Whether they are open is a
display choice, never a game event ([UI](ui.md#the-board)). The character reference opens on the
whole script, since a bluff is looked up as often as a seat, and can be narrowed to what is in
play, counted as the nights count it. Each character names the players who hold it.

### Night

The night references follow the bundled night order and show what is in play by default, dead
seats, loose characters and recorded characters off the script included, or the whole script.
Below seven players, Travellers not counted, the Minion and Demon info rows drop out; an empty
seat counts as a player. There is no checklist: reading a row records nothing. The wash on the
row being read is a display choice like the filter, never saved. Each sheet keeps its own, and a
new phase clears the nights' rows, since a place in one night says nothing about the next.

Start the day is the second tap on the plaque, under the night's deaths: every player alive when
the night began and dead now, so the Storyteller reads them out before confirming. It reads the
recorded edits only, so a death taken back during the night is not listed and nothing is inferred.

### Day

Nominate a player in the nominator's seat menu, then tap the nominee, who may be the nominator
themselves; a tap off the seats lets it go. A tap on another seat while a menu is open only moves
the menu, so a day edit never records a nomination by accident. Nothing
limits who nominates or is nominated, or how often: the day's list shows who already has, and the
Storyteller rules on a second nomination, as a Banshee or Riot allows. Every player's hand toggles,
in any order, with no countdown, and a dead player with no ghost vote left still votes, as a Voudon
allows. The threshold shown is the larger of half the living players, rounded up, and one more than
the day's best tally, with a tie once that tally reaches the minimum. It counts living Travellers
and adjusts for no character.

Mark and Done end the vote and spend the ghost vote of each dead voter who held one. Mark puts a
skull on the nominee, never an execution. Cancelling a nomination gives back the ghost votes it
spent. The browser tab remembers an open nomination, so a reload reopens it. Undoing Done or Mark
reopens the vote on its nomination.

With the skull on a player, the day ends with Execute or No execution. Execute records the
execution and that player's death and starts the night, one undo step; No execution only starts the
night. The app draws no line between an execution and a death: a player an execution spares, as a
Zombuul or Tea Lady can, is revived like any other correction. With nobody on the block the day
ends with Start the next night.

A Traveller's seat menu calls for their exile, which anyone may do, so it names no caller. The
exile opens the same vote, where every hand counts and none spends a ghost vote. Its threshold is
half the living players, rounded up, and it never sets or reaches the execution's threshold or the
block. It ends with Done alone: the Storyteller records the death.

### Ending

End game asks who won, good or evil. The app never detects a win.

A finished game offers three things and nothing else: Play again, Replay and Home. Show a card
and More go, since nothing is left to show or arrange, and Undo stays, the way back from a wrong
winner. Home leaves without asking, as there is nothing to resume.

Play again is how a group plays its next game without typing its names again. It opens New game
on the script list with the finished game's players in the seats, in the order they sat and as
many seats as they took, so the Storyteller picks a script and goes on as usual. A default name
is a place rather than a player, so it takes the number of its new seat, and a bigger table
numbers its extra seats. Nothing carries over from a game the Storyteller did not ask to repeat:
New game alone still starts every seat at its number.

## Saved games and replay

Every edit saves at once. Undo takes back the last action, whatever it was: an edit, a hand, a
phase, the deal or the ending, and stops at the table the game opened with. It is there for what
no other edit reaches, a phase begun too early or the wrong winner. There is no Redo: stepping
back and forth through a game is an easy way to lose track of it, so an undone action is made
again by hand. That makes a stray Undo costly, which is why the control stands apart from the
others ([UI](ui.md#the-board)). On a keyboard, Ctrl or Cmd with Z undoes, except in a text field
or under an open window. [Store](store.md#the-cursor) owns the operations.

History reads recorded edits only: deaths and revivals, character and side changes, seats added
and removed, nominations and votes, each in its phase, nothing inferred from an ability. A phase
also keeps the reminders and notes placed in it that were still on their seat when it ended: one
taken off again in the same phase was a slip or a move, and taking an older one off is not told,
so the list stays the answer to who was poisoned that night. A reminder
placed before the first night is told with its player, as part of the deal. A game
resumes or replays in one tap from the list and opens on a page of its own, the place to read or
delete it, and game files import as JSON. During a game, History in More
opens the same days and nights in a window over the board, the latest phase first, so who voted
yesterday is two taps away without leaving the game or showing a past board to mistake for the
live one. Until something is recorded there is nothing to open. Deleting a game asks first and is
permanent ([Store](store.md#where-it-lives)). Replay never changes the saved log
([Store](store.md#the-cursor)). The clock runs only while the live board is open and visible
([Store](store.md#recorded-time)).

## Scripts

The script sheet reads, composes, imports, shares and prints scripts ([UI](ui.md#the-script-sheet)).
A custom script can use every character the app knows, homebrew ones included, listed in the
official order within each team, and up to ten homebrew rules ([Content](content.md#script-data)).
It can take any image as its logo, shown wherever the script is listed and on the games played on
it; removing the image brings the bundled custom logo back. An edition keeps its own logo, and a
copy of one starts with the custom logo, so a variant never passes for the official script.
Unsaved scripts and characters survive a reload or a closed tab ([Store](store.md#drafts)), and
leaving with changes asks first. Custom scripts live on the device
([Store](store.md#custom-scripts-and-settings)). An account may come later; nothing may assume it.

Most custom scripts are variants of another, so an edition or a saved script opens as a copy to
edit: every character its sheet shows, an edition's Travellers included, and a saved script's
homebrew records, rules and kept `_meta`. The copy is unsaved under the original's name marked as a
copy, and saving it adds a script beside the original. A script received and not yet saved has
no copy, since saving it is the first step.

Import takes a link, pasted JSON, a QR code or a file. Links from this app and from the official
Script Tool carry the whole script, so they open offline. An imported script opens unsaved, and
opening the same one twice keeps one copy. The paste field and the scanner exist because on an
iPhone a tapped link opens in Safari, whose storage is not the installed app's.

Sharing gives a QR code, a link, the share sheet or a file. The link holds the script in the URL
fragment, which the browser never sends to the host, so nothing is uploaded
([Store](store.md#script-links)). The link drops embedded art, which the file keeps, so a script
with a logo or icons of its own also offers its file to the share sheet where the browser can
share one.
Editions have no Share, since every device already has them.

### Homebrew characters

A Storyteller can write their own characters, with art, reminders, a setup mark and night wakes. A
character can carry a second image for the side opposite its team, since the tint of the art is the
only mark of alignment on the board ([UI](ui.md#tokens-and-art)). Saving one updates the scripts
that carry it; games keep their own copy. A homebrew character on a script being composed opens from
its row, so a typo is fixed without leaving the script. Saving it there adds it to the
Storyteller's list under the same id. A character that came inside an imported script, or was
deleted from the list while a script kept it, then becomes theirs to use on every script.

A homebrew character can be jinxed with one other character, with a reason the Storyteller
writes. Opened from a script, the form offers that script's characters, since a jinx shows only
when both are on it; from the list, every character the app knows. The jinx shows wherever the
script's jinxes do, and an official jinx for the same pair is shown instead. A file can carry more
than one: the form edits the first and keeps the others.

Each night offers a few moments around its fixed points, on one rule: whatever makes a player
drunk or poisoned wakes before the characters it can disable, and information wakes after all of
it but before the Chambermaid and Mathematician, who count the night. The chosen moment names the two
steps it falls between. The Storyteller can also pick an exact place in the official order. Opened
from a script being composed, both read that script's own order, the one run at the table, and the
exact place also lists the script's other homebrew characters where they wake, so the Storyteller
sets the order between them. Tapping a row wakes the character directly under it. Choosing a moment
wakes it after the homebrew characters already given that moment, so they wake in the order they
were given it. Nothing orders them by team or ability.

## Search and sharing

Search engines ignore the browser's language, so each language has its own Home: English at the
root, the others at their lower-case locale tag, such as `/fr` or `/es-419`. Each Home is wholly
in its language and lists every Home as an `hreflang` alternate, the root as `x-default`. Every
other route is `noindex, follow`: they are working screens for games on one device. That is an
indexing rule, not access control. The sitemap lists every Home.

A visitor with no saved game gets a prompt that opens a short About card, which the button beside
Home's badge opens for anyone. The card is a native dialog, so its text stays in the exported page:
text nobody could open would count as hidden. It never opens by itself, since a dialog covering the
page on load counts against it on phones.
Home never redirects to match the visitor's language. Search results use the 192-pixel icon,
since they show a site icon only at a multiple of 48 pixels. [UI](ui.md#home) owns the look.

Each Home names `search.jpg`, a square capture of the whole board, as its primary image. Left to
choose, search took the largest picture Home draws for the result thumbnail: a blank token disc.
The sharing image stays for link previews, which draw it wide, but is too wide and too full of text
to read as a thumbnail. Only crawlers fetch the thumbnail, so the offline download leaves it out.
Search shows one site name for every Home, the English one, so a language that names the app its
own way gives that name as an alternate.

## Attribution

The app is unofficial and non-commercial. The official Community Created Content badge ends Home
where it fits and always shows in About, in Settings. About says the app is not affiliated with
The Pandemonium Institute, and that Steven Medway and The Pandemonium Institute own the game, its
characters, art and ability text.
The search text calls it an unofficial grimoire for games at a table, never a free app, so it
never reads as an alternative to the official one, and nothing mentions a price. About invites
players to buy a physical Grimoire. The contact address belongs to Feedback, apart from the notice
that names The Pandemonium Institute, so nobody takes it for theirs. [UI](ui.md#settings) owns the
presentation.

## Feedback

Most Storytellers have no GitHub account, so feedback goes by email first: Send feedback opens the
device's mail app with a subject and, below room to write, one line with the app version, language,
browser and system by name, window size, and whether it is the installed app. The person reads it
before sending, so it stays a footnote rather than a form. Copy the address serves a device with no
mail app set up. A link opens GitHub's bug form with the same facts filled in, for those who have an
account, and is also where the source code shows. The app sends
nothing itself and has no server for it: the person sees every word in their mail app or on GitHub
before it leaves, and nothing about a game goes with it.

The version is the build's own, as its service worker names it: the first seven characters of the
precache version, which changes exactly when the bundled files do. About shows it centred at its
foot. A page no worker controls yet, the very first load, has none, and the email leaves it out.

Home offers Feedback beside the badge and About to someone who has played, and opens Settings on
its group. Settings always has it.

## Offline and installation

Everything a game needs is bundled, so after the first full download a game runs with no signal
and no account. Installing is left to the browser's own controls.

The app checks for an update on launch, when it becomes visible and every minute while visible.
A fully downloaded build waits, with no prompt, until a window of the app is hidden or not on a
game, then takes over and refreshes every open window. Every edit is already saved, but a reload in
the middle of a game would close a card being shown to a player or an open sheet. A second window
open beside the game can still let the build in. A failed download keeps the current build.
[Store](store.md#offline-build-recovery) owns caches and recovery.

## Language

The language chosen in Settings wins on every screen, whatever the URL. On first use a translated
Home sets it; anywhere else, the root included, the browser's language does, or else English. That
first choice is saved, and only Settings changes it. Spanish outside Spain gets the Latin American
translation, any Norwegian Bokmål. Game text falls back to English where an upstream translation is
missing. [Content](content.md#ui-strings) owns the translations.
