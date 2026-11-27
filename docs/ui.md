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

Both faces cover Latin script only. Cyrillic, Chinese, Japanese, Korean and Thai text falls back to
the device's own fonts, which every phone and computer reading those languages has: bundling faces
for them would add megabytes to the offline download. The name printed on a token's arc counts a
Han, kana or Hangul character a full em wide and a combining mark as nothing, so it still fits.

Wherever an ability shows, its setup change in square brackets, like the Baron's `[+2 Outsiders]`,
is bold with its brackets, as the official Script Tool prints it, so the Storyteller sees what to
change before play. Nothing else in an ability is bold, and the bold is only how it looks: no rule
is read from the brackets.

## Controls

- Touch targets are at least 44 points. A mis-tap on a phone records an edit.
- A quick second tap never zooms the page.
- A press shows at once, without moving the control. Labels may wrap.
- Keyboard focus always shows: a brass outline on felt, an ink outline on paper.
- Escape closes only the topmost layer.
- Icon buttons carry a translated name, for hover and for screen readers.
- Selection never relies on colour alone: a selected token gets a check as well as an outline.
- A choice among a few options is a set of native radios under a group label, one tab stop.
- A field keeps a visible label. The one exception is a note's field, which is the card's own words:
  the card is the player's preview, so it carries only a placeholder on screen and a name for screen
  readers. A field with a length limit shows its count, such as `231/250`, once the text is in the
  last fifth of the limit, in the danger colour at the limit, and never announces it as you type.
- Delete sits apart from the actions you use often.

Editing windows float in the centre with a margin on every side, phones included. They never stick
to an edge. Their content scrolls and their actions stay inside the window. Close, Escape and a tap
outside dismiss one. There are two exceptions, both where what is being filled must stay in view.

The tokens on a card are typed from keys docked at the foot of an upright window, where a device's
keyboard lives, or in a column on the right of a wide one, which has no height to give. The card
being filled stays in view above them as its own preview, so the Storyteller sees exactly what the
player will. A note's words are typed on the card in the card's own type, so the field is the
preview too; its token keys and the device's keyboard take the same place in turn, and the card
follows the visible viewport so its bar stays above the keyboard.

The board's three token sheets, a seat's character, a reminder and the bluffs, are a drawer of the
same keys that comes up from the foot, since a centred window would cover the seats it changes. It
is full width up to a readable maximum, at most four fifths of the window, over a light scrim that
leaves the board readable. A seat it changes keeps the brass ring; when the drawer would cover that
seat it takes the edge with more room and stops short of it. Reminders are keys too, under the same
rule labels as the characters. Everything read rather than scanned keeps the centred window: the
list of cards, Fabled and Loric, the bag, notes, language and history. The bluffs drawer docks its
wells and Save at its foot, and Shuffle sits in its top row, away from Save.

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
from the feature: it never checks impairment, previews a consequence or reads a character id for a
rule, as [Model](model.md) explains. The script sheet names two ids, the Djinn and the Bootlegger,
only to put the jinxes and the homebrew rules under them. A piece only one feature uses starts in
that feature and moves to `ui/` when a second one needs it.

## Home

The tagline shows only when there is no game to resume, for a first visit from a search. The tokens
and actions stay hidden until they are ready, so nothing changes size and New game never turns into
Resume game under your finger. The actions stay on screen without scrolling, phone on its side
included, and the first-visit prompt covers no control. [App](app.md#search-and-sharing) owns when
the prompt and the About card appear and what they say.

The badge's row shows only where it fits and always holds About. Once there are games Feedback
joins it ([App](app.md#feedback)) and About keeps only its glyph, so both fit beside the badge on a
phone.

## Settings

Group headings sit one level below the page title for screen readers, and links in About are
underlined. Feedback is one row drawn like Language's, with copying the address and the bug form as
links under it, so it stands no taller than the groups a Storyteller comes here for.
[App](app.md#attribution) owns what About says.

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
asks. Only the Storyteller reads the introduction, so each turn says under the name how to take a
token, in the place the pass button takes once the token is turned.

## The board

The ring is an oval that fills the available space. Tokens share the largest size that fits, never
below the touch target, and no disc or name overlaps another seat. Only when the smallest tokens
cannot fit does the seating area scroll, and the controls stay put. The velvet does not dim with
the phase.

A player's name prints larger under a large token, whose name box then holds the longest default
name in every language. A small token keeps the label size, so a crowded or short board keeps its
token size and no default name loses its number.

The seat menu opens beside its token, wherever it covers the fewest other seats, so a neighbour
stays tappable to move the menu there. It has no backdrop. On a seat with a token, Show a card
comes first and turns the menu in place to the two cards about a player, so You are, shown to every
player on the first night, is three taps from the board. Add a reminder follows, since on a touch
screen it is the only way to the reminder picker, then by day Nominate a player. While the nominee
is picked the nominator stays marked, as a seat being moved does. [App](app.md#board-edits) owns
the actions.

A reminder grows with its seat's token, so its words read on a tablet as on a phone, and never
outgrows that token on a crowded board. Its dark disc has a pale rim, so it stands off every velvet.
Reminders stack toward the inside of the ring, nearer their own seat than any other and on their own
side of the ring. On a tall ring the line to the centre runs steeply down from a shoulder seat, so a
stack there leans toward level rather than hang beside the next seat down.

Stacked reminders always show each one's rim and name, or for a note under another its first two
letters, and spread out on hover or tap. With a mouse or keyboard, a plus for adding a reminder
appears on the seat you point at. Touch screens never show it.

A note's text stays within its disc's slot, three lines at most, on the board and in the picker, so
a long note never runs over a neighbour or a name. A tap opens the whole text in its window.

A placed reminder drags to another seat. Touch lifts it after a long press, so a tap still takes it
off and a pan or a pinch that starts on it still moves the board; a mouse lifts it once it moves.
Lifted, it rides above the finger, the seat it would land on wears the brass ring and the board
holds still. Letting go anywhere else, a second finger or Escape puts it back. No reminder drags
while the seats are being arranged, and nothing drags while a panel or a vote is asking for seats,
or in replay.

While the seats are being arranged, a seat drags the same way and its reminders and menu rest.
Lifted, its disc rides above the finger a little smaller, so the marks of the seat under it still
show, and its own place fades. Every other seat wears the broken brass ring, and every gap that
would change the order shows an empty dashed brass slot. The seat under it takes the solid ring
and a swap badge; over a slot, the slot gives way and the seats either side step apart, so the
place it will take opens up. A gap marker, a slot or an add-seat plus, sits halfway between its two seats
and shrinks where its full size would cover a token, never below a size a finger can find. Let go, it glides in from where it was dropped while the others glide to their new places. A
tap picks a seat up instead, with the same marks, so a keyboard or screen reader arranges the ring
too: a tap on another seat swaps the two, on a slot moves it, and on itself, the velvet or Escape
puts it down. A line under Done says how, at the capsule's width so it never reaches a name, and
names the seat in hand.

Let go over the velvet, a seat stays there. Until the finger has come a third of a token from
where it pressed, letting go puts the seat back whatever it is over, since on touch it rides above
the finger and a long press let go in place would otherwise move it. It keeps the circle's token
size, so laying one out never shrinks the rest. Dropped over another token or name, or under a corner control, it moves to
the nearest clear spot; with none within a token and a half it may cover a token, since a long jump
would surprise more, but never a control. On a laid-out board each seat's reminders stack toward
the middle of the room, a gap marker sits halfway between its two seats wherever they are, and the
count starts in the gap after the nominee as on the circle. The capsule, the vote controls and the result
make way for the seats rather than the seats for them: each goes to clear velvet across the room's
middle, and the capsule and the vote dock at the foot when there is none, over the bluffs and the
plaque, which neither needs. Back to the circle sits in the capsule apart from Done and the turns,
behind a rule, since it moves every laid-out token at once, and the tokens glide home.

The status plaque is also the phase control, in thumb reach at the lower right. A phone has no
hover to show it is a button, so a brass border and a chevron mark it. The floating controls, Show
a card then More, keep that order in every phase and width until the game ends, when the result's
own actions replace them, and their first tap always acts.
Undo is a small arrow alone in the top left corner, the one corner with no other control, so a
tap aimed at Show a card or More never lands on it. The ring keeps clear of it as it does of the
toolbar, except while the toolbar names a pick, when it may lie over the top seat.

References are drawers you drag between closed, compact and full, and a drawer opens at the width
last dragged to. Compact shows names only, so a tap on one of its rows unfolds that row's text
under its name and a second tap folds it: one ability is read without the paper covering the
board, and only a drag opens the drawer full. Nothing dims behind a drawer, the ring never jumps
during a drag, and wider than a phone a fully open drawer leaves some board in reach.

A drawer's tabs are cut from its paper, like the index tabs of a ledger. The open tab is the
sheet's own vellum and joins it with no line between them. The others lie under an ink wash, a
shade darker, and tuck under the sheet's edge while it is out. There is no drag handle: a paper
tab is already the thing to pull. The resize separator is for the keyboard, and draws only while
focused. A sheet carries no title: its open tab names it.

The three sheets share one row: the art, the name with its players under it, and the text beside.
No line runs between rows, since spacing sets them apart and lines made a table of the open sheet.
A night's rows are the characters' rows, in the night's order. On every sheet the row being read
lies under an ink wash with a brass edge, across the whole row so its text is marked with its
name. A tap lays the wash at either width, a tap on another row moves it and a second tap on the
same row takes it away. At the compact width the row's text unfolds with the wash, so one row is
open at a time. Each sheet keeps its own row, and no row is washed until one is tapped. The filter
between what is in play and the whole script heads every sheet and stays while the rows scroll. A
team's name is the word alone, in its colour.

The board gives its spare width to the drawer down to a minimum, and past that the paper covers the
board without moving the seats. An upright window keeps a board 520 points wide, so from 752 points
the compact drawer docks beside it and covers no seat. A window on its side is short, so its ring
needs the width or a big game would scroll: it keeps 760.

While the paper covers seats, a tap on the board closes the drawer. A plain tap on a seat also opens
its menu, so reaching past the paper costs no extra tap. A tap that would record something, such as
on a reminder, a gap or a seat during a vote, only closes the drawer: a tap meant to put the paper
away must not change the game.

A card fills the screen and hides the grimoire. Its words and tokens are one block centred in the
window, laid out from the words' measured height, since they wrap differently in every language. A
lone token takes as much as fits with a margin either side; several stand in a row or a column,
whichever draws them larger, and never run off the side: past the smallest size they wrap and scroll
down. A name too small to read on the arc moves to a caption under its token. The corners stay clear
for the card's own controls, and a block that cannot fit scrolls.

A shown card closes on a press held for half a second, while a brass ring fills round the thumb, and
never on a tap. It is held screen out toward a player, so one stray thumb would show them every
role. A tap says how to close it instead. The card leaves only once the thumb has lifted and the
lift's own click has passed, so the release never lands on a seat or on Undo. Keyboard and screen
reader users close it with a Close button that stays out of sight until it takes focus, or with
Escape.

A card being filled is the Storyteller's, not yet the player's, so it leaves on its cross or Escape
and never on a hold. The keys are printed tokens grouped under their team's label, a chosen one
ringed and checked and one that cannot be taken dimmed, never silently refused. A shown card with
tokens keeps a quiet Change in its top corner, and so does a written note, which the Storyteller
may fix; it is a control, so a press on it never starts a hold.

A card that needs a player lets you pick on the board itself, with no banner, so the ring does not
shift. The toolbar names the pick instead: it grows to the left over the velvet with the card's
name, a line saying to tap a player and a cross that cancels, the eye in brass, while the corners
that take no tap meanwhile are dimmed. The ring keeps the room it had, and a tap on the words
reaches the seat under them; the cross and the eye still take their taps where they lie over the top
seat. A nomination's pick keeps its own marks. Any pick on the ring, a card's player or a nominee,
ends on a tap off the seats or Escape, since a phone has no Escape key.

During a vote the controls sit inside the ring, or dock at the foot when the gap is too small, so no
voter is covered. They name the nomination as the day's list does, nominator then nominee, with a
pip for each hand the threshold needs, and the tally reads "3 of 5". It turns brass once the hands
reach the count that executes. No line is drawn round the ring: each recorded hand's badge shows its
place in the count, from the seat after the nominee round to the nominee, the number the
Storyteller says out loud, and a brass chevron in the gap after the nominee shows where the count
starts and which way it goes. The colour, the pips and the numbers are references only: they never
advance, count or decide anything.

The day's list is a ledger: one line of names per nomination and its count in a column on the
right, where the eye compares the day's votes. The row that put a player on the block carries the
skull's chip, so the list and the board say the same thing; no other row is singled out.

By day each seat also says whether it has nominated or been nominated today, so the Storyteller
sees it without opening the list: a brass mark low on the left of the rim for the nominator, a
cream one low on the right for the nominee, the same figure with its arrow leaving or arriving.
They come from the day's recorded nominations, exiles aside, and go at nightfall. Like the
threshold pips they are references only: a second nomination records as the first did.

End game asks its question on the velvet, with no paper: the board goes almost dark and the two
sides sit on it as tokens over their words, since two tokens stand wider than the ring's middle.
The cross, Escape and a tap on the velvet leave without a result. A tap on a token records the
result at once, and the rest is only the way out: the loser greys as a dead token does, the winner
glides to where the result shows and fades as its words rise.

The result of End game shows at the ring's centre without covering any token or name, and never
blocks or dims the board. In replay the seats are read only. Play again, Replay and Home sit
under the result where the middle holds them as well. On a phone they always dock at the foot in
a compact row, Play again first, so they are in the same place every game whatever the table's
size, and the bluffs and the plaque step aside for them. On a wider screen they dock there only
when the middle is too small, and a board on its side then gives its foot up to them, as a
portrait one always keeps it.

## History

Days and nights shows each player as they were at the time, and reads in order at any width.
[App](app.md#saved-games-and-replay) owns the facts shown. It is a timeline: a rail runs down
each phase from its sun or moon, and every line hangs off it by a dot, so a phase needs no box to
stand apart. A phase's reminders are one wrapped row of pills on an open dot, never a line each,
so a busy night stays as short as a quiet one. A vote is one line, as in the day window: who
nominated whom, as many of the voters' tokens as the line holds, tinted by side, and the tally. A tap opens the voters'
names under it in columns, three on a phone, greyed under a skull for a hand raised while dead.
A name too long for its column is cut short on one line: the vote's own line gives names in
full. The board's History window lists the
same lines in one column under the newest phase, which is the one a Storyteller asks about
mid-game, so it opens on the answer with no scrolling.

## Replay

The board shrinks so the timeline at the bottom never covers a seat, and lays its ring out round
its corners as live play does: Exit replay where the toolbar was, the bluffs and the plaque at the
foot. No vote docks in replay, so even upright the seats come down between those two, as on a board
on its side. Only a full table on a small upright phone still needs more height and scrolls.

The timeline is one row, so a
phone on its side keeps most of its height for the board: a native range input with Previous and
Next either side. Each phase is its glyph and number over the step that opens it (setup, the moon,
the sun, a flag for the end), and a mark under the track shows every step it can stop on, longer
and brass where a phase opens. The marks are not buttons: a tap on one lands the slider there. They
never overlap: the track scrolls sideways when it gets crowded, and steps too close to tell apart
keep no mark of their own. Exit replay sits apart from the timeline. A step is one action, as undo counts them, so a moved reminder
is never seen off the board.

Every action that changes what the board draws is a step, compared on the whole seat view, so a mark
added to the seats later is a step without anyone listing it. A replay always rests on a step,
however it was opened, so the slider, the arrows and the board agree. Each step names its changes in
one line under the timeline, which a screen reader hears, and rings the seats it changed in brass; a
phase alone names only the phase and rings no seat.

## The script sheet

The official player sheet is the model, kept where it works and adapted where paper and phone
differ. Teams come in a fixed order: Townsfolk, Outsiders, Minions, Demons, then Travellers, Fabled
and Loric. The sheet keeps the distribution table and the two night orders.
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
camera reads contrast.

A custom script shows the bundled custom logo until it has its own. In compose the logo is a
button, with the brass pencil the character editor's token has. A tap picks an image; once the
script has one, the tap opens a menu to choose another or remove it, so the head of the sheet
never grows a control. The image is cropped to its visible pixels and keeps its shape, since a
logo is often wide lettering. A logo given as a web address, as other
tools write it, shows on the sheet only, and only when the network reaches it; otherwise the
bundled art stands in, so the sheet works offline. A list draws a logo the script carries and
never a linked one, which would ask every script's host each time the list opens.

Printing uses A4, black on white with team colours on names, team words and the count table, which
follows the official sheet's framed table. The logo and the title head the first page, the largest
things on it, with the script's Fabled and Loric named beside them. The second page follows the
official one: the night orders in its outer columns behind pale gold bars, and between them the
jinxes, the Fabled, the Loric with the Bootlegger's rules, the Travellers under a band, so a handful
of those never take a page of their own, and the count table last. The foot of every page names who
owns the game and what the asterisk means. Ability text never shrinks below 8 pt: a long script
continues onto another page rather than clipping. Art on the sheet is an image, never a CSS
background, because browsers leave backgrounds off paper unless the reader turns them on.

## The theme

`theme.ts` holds the palette, type, spacing and touch sizes, each with its reason, and a piece takes
its colours from there. Lower layers never import it. What is drawn rather than themed keeps its
colours beside the drawing: the board's frame, the bag, the QR code, shadows, and the printed
sheet's inks, which include a blue and a red of their own. The page's background before the app
loads repeats the felt.

The team colours are fixed, because players know them from the official material: they come from
the official Script Tool's stylesheet. Everything else, the felt, the parchment and the accent, is
the design's to choose.
