# UI: presentation and interaction

This file covers how the app looks and how you operate it, for the screens under `features/` and
the shared pieces under `ui/`. [App](app.md) owns what each action does, and
[App](app.md#layers) owns which folder may import which.

It keeps the rules a change must not break. How a screen looks today lives in the code and in the
before and after images a UI pull request carries. Keep that look unless the task is to change it.

## The look

The physical grimoire is the model: dark velvet, round tokens with the official art on parchment,
small reminder tokens tucked against their seat, the dead faded. Nothing competes with the art, and
nothing is added that the table does not have. The official online app is the nearest reference for
the feel.

Show character icons rather than written lists of names. Keep the names for screen readers and
hover, and write them out only where text is needed to tell characters apart.

Every page sits on the selected velvet. The brass border and gold corners belong to the game board
only. Things you read sit on the bundled vellum at one fixed scale, so its grain matches across
screens, with ink washes rather than opaque fills inside it.

The logo is for the favicon and the installed icon, never on app screens.
[The icon notes](../assets/README.md#icons) hold its sources.

## Type

Two faces, both bundled, since the app runs offline. Grenze for display: a serif with blackletter
bones that reads as the game's world. Atkinson Hyperlegible for everything you read: it was drawn
for low vision, and a Storyteller reading ability text in a dim room is that case. Counts, tallies
and clocks use its tabular figures.

Wherever an ability shows, its setup change in square brackets, like the Baron's `[+2 Outsiders]`,
is bold with its brackets, as the official Script Tool prints it, so the Storyteller sees what to
change before play. Nothing else in an ability is bold, and the bold is only how it looks: no code
reads the brackets.

## Controls

- Touch targets are at least 44 points. A mis-tap on a phone records an edit.
- A quick second tap never zooms the page.
- A press shows at once, without moving the control. Labels may wrap.
- Keyboard focus always shows: a brass outline on felt, an ink outline on paper.
- Escape closes only the topmost layer.
- Icon buttons carry a translated name, for hover and for screen readers.
- Selection never relies on colour alone: a selected token gets a check as well as an outline.
- A choice among a few options is a set of native radios under a group label, one tab stop.
- A field keeps a visible label. A field with a length limit shows its count, such as `231/250`,
  once the text is in the last fifth of the limit, in the danger colour at the limit, and never
  announces it as you type.
- Delete sits apart from the actions you use often.

Editing windows float in the centre with a margin on every side, phones included. They never stick
to an edge. Their content scrolls and their actions stay inside the window. Close, Escape and a tap
outside dismiss one.

## Motion

Changes of state animate instead of snapping. Animation never delays an accepted action or hides
the current state, and a closing window takes no taps. Three moments get a real show: revealing a
token to a player, dealing the tokens and the win.

Reduced motion removes all movement and keeps only short fades.

## The device

The floor is a phone in portrait, held in one hand by a Storyteller walking around a table in a dim
room. Pointer and keyboard are extra ways in: every action is still a tap. Layout follows the
window width, never the device name, so a phone on its side and a narrow browser window get the
same layout.

- Everything fits a 320-point-wide phone, with the longest translated labels.
- Text fields use at least 16 CSS pixels, or phones zoom in on focus.
- The page cannot zoom out below its fitted size. Pinch zoom in stays available.
- The on-screen keyboard resizes only the visible viewport, never the page, so layout choices such
  as orientation do not flip while you type. With the keyboard open, the focused field stays
  reachable and the actions stay above the keyboard.
- Scrollbars are hidden, and text outside text fields cannot be selected.

The exported page paints before its script runs, and a tap before React has hydrated it is lost:
the layout shifts and moves the control from under your finger. So until the first page has
hydrated, its controls look disabled and take no taps. Its text stays at full strength for readers
and search engines ([App](app.md#search-and-sharing)).

The app is meant to run installed or full screen, since the browser bars take space the board needs.
It lays out from the safe area. [App](app.md#offline-and-installation) owns installation.

## Tokens and art

One piece of art is drawn three ways: the icon alone in lists, the disc on parchment at small
sizes, and the printed token with the name curved along its bottom edge on seats and cards. The
name is text on an SVG arc, so it stays sharp at any size and in print. Art is cropped as
[Content](content.md#character-art) describes.

Alignment is the tint of the art and nothing else: blue for good, red for evil, no extra ring or
badge. A dead token fades toward grey but keeps a trace of its tint. A small skull sits on its rim
until the ghost vote is spent. Both are drawn in code. An empty seat is an outlined circle with the
player's name and no number.

Loading art never delays navigation or holds a screen until its images arrive.

## Shared pieces

Editions and custom scripts share one presentation. A shared piece gets its choices and callbacks
from the feature: it never reads a character id, checks impairment or previews a consequence, as
[Model](model.md) explains. A piece only one feature uses starts in that feature and moves to `ui/`
when a second one needs it.

## Home

The tagline shows only when there is no game to resume, for a first visit from a search. The tokens
and actions stay hidden until they are ready, so nothing changes size and New game never turns into
Resume game under your finger. The actions stay on screen without scrolling, phone on its side
included, and the first-visit prompt covers no control. [App](app.md#search-and-sharing) owns when
the prompt and the About card appear and what they say.

## Settings

Group headings sit one level below the page title for screen readers, and links in About are
underlined. [App](app.md#attribution) owns what About says.

## Setup

Each team's band fills toward the usual count for the chosen number of players. The counts are
advisory. A chosen character comes to full strength and carries a brass check on its icon, as in
the pickers, since a faded row alone is easy to misread in a dim room. Shuffle and Open grimoire
float at the bottom of the sheet, under the thumb wherever you have scrolled.

Discovery hands the phone from player to player, so it must never leak a role. The neutral back is
the same for everyone. Hiding removes the face at once, with no closing animation that could leave
a role readable. The board is unmounted during discovery, not just covered.

The draw is the same turn with a bag of face-down tokens first. Nothing on the bag names a character
or an alignment, and a token's place in the bag says nothing, since the bag is shuffled when it is
filled. Twenty tokens stay big enough to tap. Shaking the phone shakes the bag, past a threshold
that handing the phone over stays under; iPhone allows motion only after a tap, so the start button
asks.

## The board

The ring is an oval that fills the available space. Tokens share the largest size that fits, never
below the touch target, and no disc or name overlaps another seat. Only when the smallest tokens
cannot fit does the seating area scroll, and the controls stay put. The velvet does not dim with
the phase.

A player's name prints larger under a large token, whose name box then holds the longest default
name in every language. A small token keeps the label size, so a crowded or short board keeps its
token size and no default name loses its number.

The seat menu opens beside its token, wherever it covers the fewest other seats, so a neighbour
stays tappable to nominate. It has no backdrop. Add a reminder comes first, since on a touch screen
it is the only way to the reminder picker. [App](app.md#board-edits) owns the actions.

A reminder grows with its seat's token, so its words read on a tablet as on a phone, and never
outgrows that token on a crowded board. Its dark disc has a pale rim, so it stands off every velvet.
Reminders stack toward the inside of the ring. On a tall ring a stack leans from the line to the
centre toward level, most on the flanks and not at all at the ends, and only as far as keeps it on
its own side of the ring: pointing straight at the centre from a shoulder seat would hang it beside
the next seat down.

Stacked reminders always show each one's rim and name, and spread out on hover or tap. With a mouse
or keyboard, a plus for adding a reminder appears on the seat you point at. Touch screens never show
it.

A note's text stays within its disc's slot, three lines at most, on the board and in the picker, so
a long note never runs over a neighbour or a name. A tap opens the whole text in its window.

A placed reminder drags to another seat. Touch lifts it after a long press, so a tap still takes it
off and a pan or a pinch that starts on it still moves the board; a mouse lifts it once it moves.
Lifted, it rides above the finger, the seat it would land on wears the brass ring and the board
holds still. Letting go anywhere else, a second finger or Escape puts it back. Nothing drags while
the seats are being arranged, a panel or a vote is asking for seats, or in replay.

The status plaque is also the phase control, in thumb reach at the lower right. A phone has no
hover to show it is a button, so a brass border and a chevron mark it. The floating controls, Show
a card then More, keep that order in every phase and width, and their first tap always acts.

References are drawers you drag between closed, compact and full. Compact shows names only, so a
tap on one of its rows opens it full, that once: the next opening keeps the width last dragged to.
While the board has width to spare it gives it up to the drawer, down to a minimum, and the paper
covers the rest of the board without moving the seats. An upright window keeps a 520 point board,
so from 752 points wide the compact drawer docks whole and covers no seat. A window on its side is
short and its ring needs the width, or a big game would scroll, so it keeps 760. While the paper
covers seats, a tap on the board closes the drawer, and a plain tap on a seat also opens its menu,
so reaching past the paper costs no extra tap. A tap that would record something, on a reminder, a
gap or a seat during a vote, only closes the drawer, since there is no undo. The ring never jumps during a drag, a fully open
drawer leaves some board in reach, and nothing dims.

A card fills the screen and hides the grimoire. A card that needs a player lets you pick on the
board itself, with no banner, so the ring does not shift.

During a vote the controls sit inside the ring, or dock at the foot when the gap is too small, so no
voter is covered. The tally turns brass once the hands reach the count that executes. That colour,
the count's route and the most-votes highlight are references only: they never advance, count or
decide anything.

The result of End game shows at the ring's centre without covering any token or name, and never
blocks or dims the board. In replay the seats are read only.

## History

Days and nights shows each player as they were at the time, and reads in order at any width.
[App](app.md#saved-games-and-replay) owns the facts shown.

## Replay

The board shrinks so the timeline at the bottom never covers a seat. The timeline is a native range
input, and its phase labels never overlap: the track scrolls sideways when it gets crowded. Exit
replay sits apart from the timeline. A step is one action, as undo counts them, so a moved reminder
is never seen off the board.

## The script sheet

The official player sheet is the model, kept where it works and adapted where paper and phone
differ. Teams come in a fixed order: Townsfolk, Outsiders, Minions, Demons, then Travellers, Fabled
and Loric. The sheet keeps the distribution table next to the characters, and the two night orders.
The line explaining the asterisk is always there, as on the official sheet, since nearly every
script has one. The Storyteller's night instructions stay off the sheet. Jinxes follow, once per
pair, indented under the Djinn, whose rule they are, whether or not the script lists it. Homebrew
rules sit under the Bootlegger, whose ability says the script has them, and are written there in
compose; the board's reference lists them the same way. The Fabled and Loric take one column, so the
rules keep the sheet's width.

On screen, team headers stick while their team scrolls past. The night orders become two lists
below the characters, since paper's upside-down column is meant for turning the page. New game
sits in the toolbar and never floats at the foot, where the bag it opens has Open grimoire: a
second tap landing there would open a board nobody dealt.

The toolbar is glyphs, named by their tooltips, so the paper stays the heaviest thing on the page.
Only Save on a received script keeps its word, as the one thing that page asks. The pencil edits a
saved script and, on an edition, edits a copy, its only way to edit. A phone has no hover to name a
glyph, so there a saved script's copy and Print go in a More menu that writes them out; New game,
the pencil and Share stay in the bar.

A script is listed the same way wherever it is listed, its author then its character count, so
the list to play from and the library read as one list.

The share QR code is black on white with the standard quiet zone, whatever the velvet, because a
camera reads contrast. A custom script's web logo shows only when the network reaches it; otherwise
the bundled art stands in, so the sheet works offline.

Printing uses A4, black on white with team colours on names, team words and the count table, which
follows the official sheet's framed table. The logo and the title head the first page, the largest
things on it, with the script's Fabled and Loric named beside them. The second page follows the
official one: the night orders in its outer columns behind pale gold bars, and between them the
jinxes, the Fabled, the Loric with the Bootlegger's rules, then the Travellers under a band, so a
handful of those never take a page of their own. The foot of every page names who owns the game and
what the asterisk means. Ability text never shrinks below 8 pt: a long script continues onto another
page rather than clipping. Art on the sheet is an image, never a CSS background, because browsers
leave backgrounds off paper unless the reader turns them on.

## The theme

`theme.ts` is the one file that holds colours, type, spacing and touch sizes, each with its reason.
Lower layers never import it. The team colours are fixed, because players know them from the
official material: they come from the official Script Tool's stylesheet. Everything else, the felt,
the parchment and the accent, is the design's to choose.
