import { asCharacterId } from '../content'
import { game, token } from '../engine/testing/board'
import { deserialize, newGame, serialize } from './saved'
import { appendAll, boardOf, lookAt, openSession, redo, undo } from './session'

test('manual edits appended to legacy games preserve reminders and round-trip as one undoable action', () => {
  const b = game().seat('Ann', 'poisoner').seat('Bob', 'chef')
    .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).build()
  const before = openSession({ ...newGame('tb', 1000), mode: 'storyteller', log: b.log })
  const after = appendAll(before, [
    { kind: 'setCharacter', seat: b.id('Ann'), to: asCharacterId('imp') },
    { kind: 'setGhostVote', seat: b.id('Bob'), available: false },
    { kind: 'moveSeat', seat: b.id('Bob'), to: 0 },
    { kind: 'endGame', winner: 'good', note: 'Storyteller ruling' },
  ], 1001)
  expect(after.game.log.slice(0, b.log.length)).toEqual(b.log)
  expect(after.game.log.slice(b.log.length).every(event => event.manual)).toBe(true)
  const reopened = openSession(deserialize(serialize(after.game)))
  expect(boardOf(reopened)).toEqual(boardOf(after))
  expect(boardOf(reopened).seats[0]).toMatchObject({ id: b.id('Bob'), ghostVote: false, tokens: b.g.seats[1]!.tokens })
  expect(boardOf(reopened).result).toEqual({ winner: 'good', note: 'Storyteller ruling' })
  expect(boardOf(lookAt(reopened, b.log.length))).toEqual(b.g)
  const undone = undo(reopened, 1002)
  expect(undone.game.log).toEqual(before.game.log)
  expect(boardOf(undone)).toEqual(b.g)
  expect(redo(undone, 1003).game.log).toEqual(after.game.log)
})
