import { asCharacterId } from '../content'
import { asSeatId } from '../engine'
import type { Draw } from './draw'
import { deserialize, InvalidSavedGame, newGame, serialize } from './saved'
import { append, appendAll, lookAt, openSession, setDraw, undo } from './session'

const setup = () => appendAll(openSession(newGame('tb', 0)), [
  { kind: 'addSeat', seat: asSeatId('a'), name: 'Ann', at: 0, character: asCharacterId('_empty'), alignment: 'good' },
  { kind: 'addSeat', seat: asSeatId('b'), name: 'Bob', at: 1, character: asCharacterId('_empty'), alignment: 'good' },
], 1000)
const bag: Draw = { tokens: [
  { character: asCharacterId('imp'), seat: asSeatId('a') },
  { character: asCharacterId('chef') },
  { character: asCharacterId('drunk'), shown: asCharacterId('empath') },
] }

test('filling the bag or taking a token records no game action and keeps redo', () => {
  const before = undo(append(setup(), { kind: 'override', note: 'correction' }, 1001), 1002)
  const after = setDraw(before, bag)
  expect(after.game.draw).toEqual(bag)
  expect(after.game.log).toBe(before.game.log)
  expect(after.redo).toBe(before.redo)
  expect(setDraw(after, undefined).game).not.toHaveProperty('draw')
})

test('a bag half drawn survives save and reload, and edits keep it', () => {
  const saved = append(setDraw(setup(), bag), { kind: 'renameSeat', seat: asSeatId('a'), name: 'Anne' }, 2000)
  expect(saved.game.draw).toEqual(bag)
  expect(openSession(deserialize(serialize(saved.game))).game.draw).toEqual(bag)
})

test('the bag cannot change while looking back', () => {
  const looking = lookAt(setup(), 1)
  expect(setDraw(looking, bag)).toBe(looking)
})

test('a malformed bag is refused on load', () => {
  const game = setup().game
  for (const draw of [
    { tokens: [] },
    { tokens: [{ character: '' }] },
    { tokens: [{ character: 'drunk', shown: '' }] },
    { tokens: [{ character: 'drunk', shown: 7 }] },
    { tokens: [{ character: 'imp', seat: 'a' }, { character: 'chef', seat: 'a' }] },
    { tokens: Array.from({ length: 21 }, () => ({ character: 'chef' })) },
    { tokens: 'imp' },
  ]) expect(() => deserialize(JSON.stringify({ ...game, draw }))).toThrow(InvalidSavedGame)
})
