import { asCharacterId, emptySeat } from '../content'
import { asSeatId, reduce } from '../engine'
import type { Payload } from '../engine'
import { game, token } from '../engine/testing/board'
import { describeGame } from './gameSummary'
import { bluffsOf } from './bluffs'
import { deserialize, InvalidSavedGame, migrate, newGame, serialize } from './saved'
import { append, appendAll, boardOf, canUndo, lookAt, openSession, redo, replayOnto, undo, updateDayTimer } from './session'

const alice = asSeatId('alice')
const bob = asSeatId('bob')
const start = () => appendAll(openSession(newGame('tb', 1, 'free')), [
  { kind: 'addSeat', seat: alice, name: 'Alice', at: 0, character: emptySeat, alignment: 'good' },
  { kind: 'addSeat', seat: bob, name: 'Bob', at: 1, character: emptySeat, alignment: 'good' },
], 2)

test('manual character changes and life edits preserve every reminder and note through save, undo and replay', () => {
  let s = append(start(), { kind: 'setCharacter', seat: alice, to: asCharacterId('poisoner') }, 3)
  s = appendAll(s, [
    { kind: 'placeToken', seat: alice, token: ['poisoner', 'Poisoned'], source: alice },
    { kind: 'placeToken', seat: bob, token: ['poisoner', 'Poisoned'], source: alice },
    { kind: 'placeToken', seat: alice, token: ['puzzlemaster', 'Guess Used'] },
    { kind: 'placeToken', seat: alice, token: ['note', ''], note: 'Claims Empath' },
  ], 4)
  const before = boardOf(s)
  const changed = append(s, { kind: 'setCharacter', seat: alice, to: asCharacterId('empath') }, 5)
  const revived = append(append(changed, { kind: 'kill', seat: alice, cause: 'storyteller' }, 6), { kind: 'revive', seat: alice }, 7)
  const reopened = openSession(deserialize(serialize(revived.game)))
  expect(reopened.game.mode).toBe('free')
  expect(boardOf(reopened).seats.map(seat => seat.tokens)).toEqual(before.seats.map(seat => seat.tokens))
  expect(boardOf(reopened).seats[0]).toMatchObject({ character: 'empath', alive: true })
  expect(boardOf(reopened).clock).toEqual({ phase: 'setup', night: 0 })
  expect(boardOf(lookAt(reopened, s.game.log.length))).toEqual(before)
  expect(boardOf(undo(changed, 8))).toEqual(before)
  expect(boardOf(redo(undo(changed, 8), 9))).toEqual(boardOf(changed))
  expect(reopened.game.log.every(event => event.manual)).toBe(true)
  const cleared = append(reopened, { kind: 'setCharacter', seat: alice, to: emptySeat }, 10)
  expect(boardOf(cleared).seats[0]).toMatchObject({ character: emptySeat, name: 'Alice' })
  expect(boardOf(cleared).seats[0]?.tokens).toEqual(before.seats[0]?.tokens)
})

test('only explicit removal takes a reminder off the free board', () => {
  const s = append(start(), { kind: 'placeToken', seat: bob, token: ['monk', 'Safe'] }, 3)
  const removed = append(s, { kind: 'removeToken', placedBy: s.game.log.at(-1)!.id }, 4)
  expect(boardOf(removed).seats[1]?.tokens).toEqual([])
  expect(boardOf(undo(removed, 5))).toEqual(boardOf(s))
  expect(canUndo(start())).toBe(false)
})

test('free-board bluffs persist, appear in the log and support undo and redo without changing the board', () => {
  const initial = start()
  const characters = ['chef', 'monk', 'saint'].map(asCharacterId)
  const selected = append(initial, { kind: 'setBluffs', characters }, 3)
  const reopened = openSession(deserialize(serialize(selected.game)))
  expect(bluffsOf(boardOf(reopened), reopened.game.log)).toEqual(characters)
  expect(reopened.game.log.at(-1)).toMatchObject({ kind: 'setBluffs', characters, manual: true })
  expect(boardOf(reopened)).toEqual(boardOf(initial))
  const undone = undo(reopened, 4)
  expect(bluffsOf(boardOf(undone), undone.game.log)).toEqual([])
  const restored = redo(undone, 5)
  expect(bluffsOf(boardOf(restored), restored.game.log)).toEqual(characters)
  expect(append(restored, { kind: 'setBluffs', characters }, 6)).toBe(restored)
})

test('manual boards accept phase and identity edits in a single undoable batch', () => {
  const s = start()
  const actions: Payload[] = [
    { kind: 'phase', to: 'night' },
    { kind: 'wake', seat: alice, step: 1 },
    { kind: 'nominate', by: alice, of: bob },
    { kind: 'setShown', seat: alice, to: asCharacterId('chef') },
  ]
  for (const action of actions) {
    const changed = appendAll(s, [{ kind: 'renameSeat', seat: alice, name: 'Changed' }, action], 3)
    expect(changed.game.log.slice(-2).every(event => event.manual)).toBe(true)
    expect(changed.game.log.at(-1)).toMatchObject(action)
    expect(boardOf(undo(changed, 4))).toEqual(boardOf(s))
  }
  expect(updateDayTimer(s, 'pause', 4)).toBe(s)
})

test('pending timed reminders in an older free board never expire on its next edit', () => {
  const old = game('tb').seat('Ann', 'poisoner').seat('Bob', 'monk')
    .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).day().night(2).build()
  const s = openSession({ ...newGame('tb', 1, 'free'), log: old.log })
  const next = append(s, { kind: 'renameSeat', seat: old.id('Ann'), name: 'Alice' }, 5)
  expect(next.game.log).toHaveLength(old.log.length + 1)
  expect(boardOf(next).seats[1]?.tokens).toEqual(old.g.seats[1]?.tokens)
})

test('a manual death does not fire character reactions', () => {
  const old = game('tb').seat('Demon', 'imp').seat('Minion', 'scarletwoman').seat('A', 'chef').seat('B', 'monk').seat('C', 'empath').night(2).build()
  const s = append(openSession({ ...newGame('tb', 1, 'free'), log: old.log }), { kind: 'kill', seat: old.id('Demon'), cause: 'storyteller' }, 3)
  expect(s.game.log).toHaveLength(old.log.length + 1)
  expect(boardOf(s).seats[1]?.character).toBe('scarletwoman')
})

test('version 11 boards migrate by their old marker without rewriting their historical events', () => {
  const script = { kind: 'custom' as const, name: 'Free board', items: [{ id: '_meta' as const, author: 'botc-grimoire:free-board' }, 'poisoner', 'chef'] }
  const old = game(script).seat('Ann', 'poisoner').seat('Bob', 'chef')
    .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).build()
  const raw = { ...newGame(script, 1), version: 11, mode: undefined, log: old.log }
  const migrated = migrate(raw)
  expect(migrated.mode).toBe('free')
  expect(migrated.script).toEqual(script)
  expect(migrated.log).toEqual(old.log)
  expect(reduce(migrated.script, migrated.log)).toEqual(old.g)
  expect(migrate({ ...raw, script: 'tb' }).mode).toBe('storyteller')
  expect(() => migrate({ ...newGame('tb', 1), mode: 'unknown' })).toThrow(InvalidSavedGame)
  const manual = append(start(), { kind: 'setCharacter', seat: alice, to: asCharacterId('chef') }, 3).game
  expect(deserialize(serialize({ ...manual, mode: 'storyteller' })).log).toEqual(manual.log)
})

test('history labels a free board without calculating a winner', () => {
  const s = start()
  const row = describeGame(s.game, key => key, 'en')
  expect(row.phase).toBe('board.setup')
  expect(row.winner).toBeUndefined()
})

test('a window\'s own edits replay onto another window\'s copy, its references moved past the other window\'s events', () => {
  const seen = start()
  // The other window marks Alice dead; this one places a reminder on Bob, then takes it off.
  const stored = append(seen, { kind: 'kill', seat: alice, cause: 'ability' }, 10).game
  let mine = append(seen, { kind: 'placeToken', seat: bob, token: ['poisoner', 'Poisoned'] }, 11)
  const placed = mine.game.log.at(-1)!.id
  mine = append(mine, { kind: 'placeToken', seat: bob, token: ['monk', 'Safe'] }, 12)
  mine = append(mine, { kind: 'removeToken', placedBy: placed }, 13)

  const replayed = replayOnto(stored, seen.game, mine.game, 20)!
  expect(replayed.game.log.slice(0, stored.log.length)).toEqual(stored.log)
  expect(replayed.game.log).toHaveLength(stored.log.length + 3)
  const remove = replayed.game.log.at(-1)!
  expect(remove).toMatchObject({ kind: 'removeToken', placedBy: stored.log.length })
  const board = boardOf(replayed)
  expect(board.seats.find(seat => seat.id === alice)?.alive).toBe(false)
  expect(board.seats.find(seat => seat.id === bob)?.tokens.map(placed => placed.def[1])).toEqual(['Safe'])

  // A copy that did not grow from the one this window saw cannot take its edits.
  expect(replayOnto(start().game, mine.game, mine.game, 20)).toBeUndefined()
})
