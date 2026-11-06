# Engine: events and the board

The engine turns a game's event log into the board. It is pure: no React, no storage, no clock.
[Store](store.md) saves the log, stamps its times and runs undo and replay, and [Model](model.md)
explains why the Storyteller, not the app, resolves every ability.

## Events

The event set is closed: one union in `events.ts`, and the reducer ends with an exhaustiveness
check, so a new kind does not compile until it is handled. An event has an id, its position in the
log, and an audience kept for a future shared view; the audience controls nothing today.

- Seats: `addSeat`, `removeSeat`, `moveSeat`, `renameSeat`.
- A player's tokens: `setCharacter`, `setShown`, `setAlignment`, `kill`, `revive`, `setGhostVote`.
- Reminders and notes: `placeToken`, `removeToken`, `setNote`.
- Off the ring: `addLoose`, `removeLoose`, and ability annotations with `grant` and `revoke`.
- Phases: `phase`, `endGame`.
- The day: `nominate`, `cancelNomination`, `vote`, `unvote`, `setVoteTotal`, `markForExecution`,
  `execute`. A Traveller's exile is a `nominate` flagged `exile`, so it shares the vote edits, and
  the execution's threshold and block leave it out.
- Records that change no board field: `setBluffs`, which the store reads back from the log,
  `override`, a free-text note, and `nightChecklist`, `wake`, `nightProgress`, `info` and the
  older `exile` record, kept for older games.

Each event does one thing. Changing a character keeps the seat's reminders, a death leaves ghost
votes alone, a vote does not spend a ghost vote, and marking an execution kills nobody: each of
those is its own edit. A vote total is a recorded number the Storyteller can correct, not a
count, and `endGame` records the winner the Storyteller names. Some kinds have no control today;
they stay valid so saved games replay and a control can return without a format change.
[App](app.md#the-storytellers-path) lists the edits you can make.

## The board is rebuilt from the log

The log is the saved state. `reduce(script, log)` folds every event over an empty board, and a
prefix of the log gives the board at that point, which is all replay needs. Undo and redo only
change the log, so the reducer never knows about them. A seat keeps its id when it moves, is
renamed or changes character, and a reminder or ability annotation remembers the event that
placed it, so a removal names exactly one.

## No character automation

The manual reducer never branches on a character and does not check rules. It does not pick legal
targets, calculate information, kill, pass on a role, expire reminders or declare a winner.
Whether a player may nominate, vote, die or survive is the Storyteller's call. Adding a character
changes data, never engine code.

A few read-only helpers serve the screens: the base setup counts, the night order, what is in
play, who is on the block, nomination thresholds, and what a player is shown of their
seat. They read the board and never append.

## Older games

The union still holds the older `choice`, `prepareInfo`, `dayAction` and `resolveDecision`
payloads, so old logs load and display. They change nothing on the board and cannot be appended.

Every new event carries `manual: true`. An event without it goes first to `engine/legacy.ts`,
which holds every old reduction that differs, such as the cleanup an old character change did. If
it has no case, the manual reduction runs. That file is the only engine code that names a
character, and it only ever replays history already recorded: no new edit reaches it, so old
games read as they did and no automatic workflow comes back.
