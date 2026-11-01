import { asSeatId, onTheBlock } from '../engine'
import { contentPin } from '../content'
import { deserialize, InvalidSavedGame, migrate, SAVED_VERSION, serialize } from './saved'
import { append, boardOf, lookAt, openSession, redo, undo } from './session'

// Version 13 derives the marker from votes and contains no explicit marker events.
const previousFormat = {
  version: 13, id: 'gmarker001', createdAt: 1000, updatedAt: 2000,
  content: contentPin, script: 'tb', mode: 'free', playTime: [],
  log: [
    { id: 0, audience: 'storyteller', manual: true, kind: 'addSeat', seat: 'a', name: 'Alice', at: 0, character: 'imp', alignment: 'evil' },
    { id: 1, audience: 'storyteller', manual: true, kind: 'addSeat', seat: 'b', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
    { id: 2, audience: 'storyteller', manual: true, kind: 'phase', to: 'day' },
    { id: 3, audience: 'storyteller', manual: true, kind: 'nominate', by: 'a', of: 'b' },
    { id: 4, audience: 'storyteller', manual: true, kind: 'setVoteTotal', nomination: 3, total: 1 },
  ],
}

test('version 13 migration preserves the log and its derived marker', () => {
  const saved = migrate(previousFormat)
  expect(saved.version).toBe(SAVED_VERSION)
  expect(saved.log).toEqual(previousFormat.log)
  expect(onTheBlock(boardOf(openSession(saved)))).toBe('b')
})

test('manual markers survive reload, undo, redo and replay without killing or executing', () => {
  const original = openSession(migrate(previousFormat))
  const marked = append(original, { kind: 'markForExecution', seat: asSeatId('a') }, 3000)
  expect(marked.game.log.at(-1)).toMatchObject({ kind: 'markForExecution', manual: true, seat: 'a' })
  expect(onTheBlock(boardOf(openSession(deserialize(serialize(marked.game)))))).toBe('a')
  expect(onTheBlock(boardOf(undo(marked, 4000)))).toBe('b')
  expect(onTheBlock(boardOf(redo(undo(marked, 4000), 5000)))).toBe('a')
  expect(onTheBlock(boardOf(lookAt(marked, original.game.log.length)))).toBe('b')
  expect(boardOf(marked).seats.every(seat => seat.alive)).toBe(true)
  expect(boardOf(marked).days[0]).toMatchObject({ closed: false, markedForExecution: 'a' })
  const cleared = append(marked, { kind: 'markForExecution', seat: null }, 6000)
  expect(onTheBlock(boardOf(openSession(deserialize(serialize(cleared.game)))))).toBeUndefined()
  expect(onTheBlock(boardOf(undo(cleared, 7000)))).toBe('a')
})

test('saved marker events require a seat id or explicit null', () => {
  const base = migrate(previousFormat)
  for (const seat of [undefined, '', 4, {}, 'storyteller']) {
    expect(() => migrate({ ...base, log: [...base.log, { id: 5, audience: 'storyteller', manual: true, kind: 'markForExecution', seat }] })).toThrow(InvalidSavedGame)
  }
})
