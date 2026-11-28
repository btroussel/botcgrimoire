import type { SeatId } from '../../engine'
import { game, info, token } from '../../engine/testing/board'
import { bluffsOf } from '../../store/bluffs'
import { believed, seatCard, seatStart } from './show'

// Uppercase ids verify that card names come from the supplied locale lookup.
const name = (id: string) => id.toUpperCase()
const printed = (...ids: readonly string[]) => ids.map((id) => ({ id, name: name(id) }))
const table = () => game().seat('Ann', 'imp').seat('Bob', 'poisoner').seat('Cat', 'drunk', { shown: 'empath' }).seat('Dan', 'chef')

describe('a card from a seat', () => {
  test('YOU ARE starts from the believed character without an information event', () => {
    const { g, id } = table().build()
    expect(believed(g, id('Cat'))).toBe('empath')
    expect(seatCard(g, 'youAre', id('Cat'), 'You are', name)).toEqual({ words: 'You are', characters: printed('empath'), tint: 'good' })
  })

  test('YOU ARE carries a plain character in the seat alignment', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).build()
    expect(seatCard(g, 'youAre', id('Bob'), 'w', name)).toEqual({ words: 'w', characters: printed('chef'), tint: 'evil' })
  })

  test('YOU ARE keeps a Marionette sitting as the Chef on the good side', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).add(token('storyteller', 'marionette/Is The Marionette', 'Bob')).build()
    expect(believed(g, id('Bob'))).toBe('chef')
    expect(seatCard(g, 'youAre', id('Bob'), 'w', name)).toEqual({ words: 'w', characters: printed('chef'), tint: 'good' })
  })

  test('THIS PLAYER IS names the player under the token and keeps it in its team colours, never the seat side', () => {
    const { g, id } = table().build()
    expect(seatCard(g, 'thisPlayerIs', id('Ann'), 'This player is', name)).toEqual({ words: 'This player is', characters: printed('imp'), caption: 'Ann' })
    // A Nightwatchman who has turned evil wakes their target: red would give the side away.
    const turned = game().seat('Nat', 'nightwatchman', { alignment: 'evil' }).build()
    expect(seatCard(turned.g, 'thisPlayerIs', turned.id('Nat'), 'w', name)).toEqual({ words: 'w', characters: printed('nightwatchman'), caption: 'Nat' })
  })

  test('THIS PLAYER IS comes up without a token on a disguised seat, for the Storyteller to type', () => {
    const { g, id } = table().build()
    expect(seatCard(g, 'thisPlayerIs', id('Cat'), 'w', name)).toEqual({ words: 'w', characters: [], caption: 'Cat' })
  })

  test('YOU ARE starts from what the player believes, THIS PLAYER IS from the seat unless it is disguised', () => {
    const { g, id } = table().build()
    expect(seatStart(g, 'youAre', id('Ann'))).toEqual(['imp'])
    expect(seatStart(g, 'thisPlayerIs', id('Ann'))).toEqual(['imp'])
    expect(seatStart(g, 'youAre', id('Cat'))).toEqual(['empath'])
    expect(seatStart(g, 'thisPlayerIs', id('Cat'))).toEqual([])
    const marionette = game().seat('Bob', 'chef', { alignment: 'evil' }).add(token('storyteller', 'marionette/Is The Marionette', 'Bob')).build()
    expect(seatStart(marionette.g, 'youAre', marionette.id('Bob'))).toEqual(['chef'])
    expect(seatStart(marionette.g, 'thisPlayerIs', marionette.id('Bob'))).toEqual([])
    const lunatic = game('bmr').seat('Lou', 'lunatic', { shown: 'zombuul' }).build()
    expect(seatStart(lunatic.g, 'youAre', lunatic.id('Lou'))).toEqual(['zombuul'])
    expect(seatStart(lunatic.g, 'thisPlayerIs', lunatic.id('Lou'))).toEqual([])
    const empty = game().seat('Empty', '_empty').build()
    expect(seatStart(empty.g, 'youAre', empty.id('Empty'))).toEqual([])
  })

  test('a seat card leaves the board, saved bluffs and existing log unchanged', () => {
    const { g, log, id } = table().night(1, [info('Ann', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] })]).build()
    const before = JSON.stringify({ g, log })
    for (let repeat = 0; repeat < 2; repeat++) {
      seatCard(g, 'youAre', id('Ann'), 'w', name)
      seatCard(g, 'thisPlayerIs', id('Cat'), 'w', name)
    }
    expect(JSON.stringify({ g, log })).toBe(before)
    expect(bluffsOf(g, log)).toEqual(['librarian', 'monk', 'slayer'])
  })

  test('a missing seat or one without a token has no card', () => {
    const { g, id } = game().seat('Empty', '_empty').seat('Dan', 'chef').build()
    expect(believed(g, id('Empty'))).toBeUndefined()
    expect(seatCard(g, 'youAre', 'nobody' as SeatId, 'w', name)).toBeUndefined()
    expect(seatCard(g, 'youAre', id('Empty'), 'w', name)).toBeUndefined()
    expect(seatCard(g, 'thisPlayerIs', id('Empty'), 'w', name)).toBeUndefined()
  })
})
