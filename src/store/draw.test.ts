import { asCharacterId } from '../content'
import { asSeatId } from '../engine'
import type { Draw } from './draw'
import { deserialize, InvalidSavedGame, newGame, serialize } from './saved'
import { append, appendAll, boardOf, deal, lookAt, openSession, redo, setDraw, undo } from './session'

const setup = () => appendAll(openSession(newGame('tb', 0)), [
  { kind: 'addSeat', seat: asSeatId('a'), name: 'Ann', at: 0, character: asCharacterId('_empty'), alignment: 'good' },
  { kind: 'addSeat', seat: asSeatId('b'), name: 'Bob', at: 1, character: asCharacterId('_empty'), alignment: 'good' },
], 1000)
const bag: Draw = { tokens: [
  { character: asCharacterId('imp'), seat: asSeatId('a') },
  { character: asCharacterId('chef') },
  { character: asCharacterId('drunk'), shown: asCharacterId('empath') },
  { character: asCharacterId('lunatic'), shown: asCharacterId('imp'), chosen: true },
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

describe('the deal empties the bag as part of its action', () => {
  const dealing = [
    { kind: 'setCharacter' as const, seat: asSeatId('a'), to: asCharacterId('imp'), alignment: 'evil' as const },
    { kind: 'setCharacter' as const, seat: asSeatId('b'), to: asCharacterId('chef'), alignment: 'good' as const },
  ]
  const filled = () => setDraw(setup(), bag)

  test('one step deals, undo puts the bag back and redo empties it again', () => {
    const dealt = deal(filled(), dealing, 2000)
    expect(dealt.game).not.toHaveProperty('draw')
    expect(boardOf(dealt).seats.map(seat => seat.character)).toEqual(['imp', 'chef'])
    const undone = undo(dealt, 2001)
    expect(undone.game.draw).toEqual(bag)
    expect(undone.game.log).toEqual(filled().game.log)
    const again = redo(undone, 2002)
    expect(again.game).not.toHaveProperty('draw')
    expect(again.game.log).toEqual(dealt.game.log)
    expect(undo(again, 2003).game.draw).toEqual(bag)
  })

  test('the bag comes back when the deal is undone, not with the edits after it', () => {
    const renamed = append(deal(filled(), dealing, 2000), { kind: 'renameSeat', seat: asSeatId('a'), name: 'Anne' }, 2001)
    const edit = undo(renamed, 2002)
    expect(edit.game).not.toHaveProperty('draw')
    expect(undo(edit, 2003).game.draw).toEqual(bag)
    expect(redo(redo(undo(edit, 2003), 2004), 2005).game).not.toHaveProperty('draw')
  })

  test('an edit made where the deal was undone keeps the bag, and a second deal is its own action', () => {
    const undone = undo(deal(filled(), dealing, 2000), 2001)
    const renamed = append(undone, { kind: 'renameSeat', seat: asSeatId('a'), name: 'Anne' }, 2002)
    expect(renamed.game.draw).toEqual(bag)
    expect(undo(renamed, 2003).game.draw).toEqual(bag)
    const refilled: Draw = { tokens: [{ character: asCharacterId('monk') }] }
    const second = deal(setDraw(renamed, refilled), dealing, 2004)
    expect(second.game).not.toHaveProperty('draw')
    expect(undo(second, 2005).game.draw).toEqual(refilled)
  })

  test('a reload forgets the emptied bag, as it forgets redo', () => {
    const reopened = openSession(deserialize(serialize(deal(filled(), dealing, 2000).game)))
    const undone = undo(reopened, 2001)
    expect(undone.game).not.toHaveProperty('draw')
    expect(boardOf(undone).seats.map(seat => seat.character)).toEqual(['_empty', '_empty'])
  })

  test('with no bag it is an ordinary action', () => {
    const table = setup()
    expect(deal(table, [{ kind: 'phase', to: 'night', night: 1 }], 2000)).toEqual(append(table, { kind: 'phase', to: 'night', night: 1 }, 2000))
  })
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
    { tokens: [{ character: 'drunk', shown: 'empath', chosen: 'yes' }] },
    { tokens: [{ character: 'drunk', chosen: true }] },
    { tokens: [{ character: 'imp', seat: 'a' }, { character: 'chef', seat: 'a' }] },
    { tokens: Array.from({ length: 21 }, () => ({ character: 'chef' })) },
    { tokens: 'imp' },
  ]) expect(() => deserialize(JSON.stringify({ ...game, draw }))).toThrow(InvalidSavedGame)
})
