# Model: a manual digital grimoire

Why the app is shaped the way it is. The details live in [Content](content.md), [Engine](engine.md),
[Store](store.md), [App](app.md) and [UI](ui.md).

## The Storyteller owns the game

The app is the grimoire the Storyteller keeps: seats, tokens, reminders, notes, bluffs, night
references, nominations and votes. The app records, the Storyteller rules, and each consequence is
its own edit: changing a character doesn't clear its poison, reviving doesn't refresh an ability,
and marking an execution doesn't kill anyone. One action can group edits into one undo step.

The app never calculates information, applies a reaction, picks legal targets, kills a player,
passes on a role, expires a reminder or declares a winner. The player counts and night order are
references, never limits. The setup shuffle is a helper before the game and never rewrites a
manual choice ([App](app.md#setup)).

## Character support

Every bundled character is supported as reference material: name, ability, team, reminders, art,
night order and jinxes. A homebrew character gets the same from its own record
([Content](content.md#homebrew-characters)). The same manual controls work for every character, so
none is more automated than another. Adding a character changes data, never code: no rule handler,
target filter, scenario or special flow. A missing or wrong reference is a content fix, made
upstream and taken at the next sync.

## Identity survives changes to the ring

A seat is a player, whatever its position, name or role. Moving or renaming it keeps its history; a
removed player and a later addition are different seats.

Actual character, shown character, alignment, life, ghost vote, reminders and ability annotations
are independent. As on a paper grimoire, a Drunk or Marionette sits as the character the player
believes, under their own reminder and on their real side, and that reminder counts the real
character as in play. A Lunatic keeps its own token with the Demon it was shown. Nothing works out a
shown character during play. Characters can also sit outside the ring.

## The log records edits

A saved game is its script plus an event log, and a pure reducer rebuilds the board from it. Undo
drops the last action's events and replay reduces a prefix, so there's no second board to sync. The
log records what was done in the app, not the game at the table: a night step checked in an older
game doesn't prove anyone woke. Old events keep their meaning, and compatibility code never runs
for new edits.

## One offline device

A game needs no account, server or network, and a future account stays optional for play. The
Storyteller is the only viewer: the event audience field is metadata, not access control, and a
shared view would need its own privacy design first.

## Boundaries

Put a new capability in the smallest layer that explains it, within the imports [App](app.md#layers)
allows. A new board operation needs an event, its reduction, validation and a history entry, with
round-trip and undo tests where it touches state.
