import { game, info, token } from '../../engine/testing/board'
import { bluffsOf } from '../../store/bluffs'
import { showTokens, showing } from './show'

// Uppercase ids verify that card names come from the supplied locale lookup.
const name = (id: string) => id.toUpperCase()
const printed = (...ids: readonly string[]) => ids.map((id) => ({ id, name: name(id) }))
const table = () => game().seat('Ann', 'imp').seat('Bob', 'poisoner').seat('Cat', 'drunk', { shown: 'empath' }).seat('Dan', 'chef')

describe('showing a card from the board', () => {
  test('without an optional shown token a manual card uses the selected character', () => {
    const { g, id } = game().seat('Player', 'drunk').build()
    expect(showing(g, 'youAre', [id('Player')], 'You are', name)).toMatchObject({ characters: printed('drunk') })
    expect(showing(g, 'thisPlayerIs', [id('Player')], 'This player is', name)).toMatchObject({ characters: printed('drunk') })
  })
  test('YOU ARE carries the believed character without an information event', () => {
    const { g, id } = table().build()
    expect(showing(g, 'youAre', [id('Cat')], 'You are', name)).toEqual({
      kind: 'youAre', words: 'You are', characters: printed('empath'), tint: 'good',
    })
  })

  test('YOU ARE carries a plain character in the seat alignment', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).build()
    expect(showing(g, 'youAre', [id('Bob')], 'w', name)).toMatchObject({ characters: printed('chef'), tint: 'evil' })
  })

  test('YOU ARE keeps a Marionette sitting as the Chef on the good side', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).add(token('storyteller', 'marionette/Is The Marionette', 'Bob')).build()
    expect(showing(g, 'youAre', [id('Bob')], 'w', name)).toMatchObject({ characters: printed('chef'), tint: 'good' })
  })

  test('THIS PLAYER IS names the selected player without leaking a disguised role', () => {
    const { g, id } = table().build()
    expect(showing(g, 'thisPlayerIs', [id('Cat')], 'This player is', name)).toEqual({
      kind: 'thisPlayerIs', words: 'This player is', characters: printed('empath'), caption: 'Cat', tint: 'good',
    })
  })

  test.each(['youAreGood', 'youAreEvil', 'thisIsTheDemon', 'theseAreYourMinions'] as const)('%s opens without any player selection', (kind) => {
    const { g } = game().build()
    expect(showTokens.find((token) => token.kind === kind)?.about).toBeUndefined()
    expect(showing(g, kind, [], 'w', name)).toEqual({ kind, words: 'w' })
  })

  test('character cards preserve their selected content and alignment', () => {
    const { g } = table().build()
    expect(showing(g, 'notInPlay', ['monk', 'saint', 'butler'], 'w', name)).toEqual({
      kind: 'notInPlay', words: 'w', characters: printed('monk', 'saint', 'butler'), tint: 'good',
    })
    expect(showing(g, 'selectedYou', ['poisoner'], 'w', name)).toEqual({
      kind: 'selectedYou', words: 'w', characters: printed('poisoner'), tint: 'evil',
    })
    expect(showing(g, 'thisCharacterIs', ['chef'], 'w', name)).toMatchObject({ characters: printed('chef'), tint: 'good' })
  })

  test('manual displays leave the board, saved bluffs and existing log unchanged', () => {
    const { g, log } = table().night(1, [info('Ann', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] })]).build()
    const before = JSON.stringify({ g, log })
    for (let repeat = 0; repeat < 2; repeat++) {
      showing(g, 'notInPlay', ['chef', 'saint', 'butler'], 'w', name)
      showing(g, 'youAreEvil', [], 'w', name)
    }
    expect(JSON.stringify({ g, log })).toBe(before)
    expect(bluffsOf(g, log)).toEqual(['librarian', 'monk', 'slayer'])
  })

  test('a card requiring content refuses missing or empty seats and missing characters', () => {
    const { g, id } = game().seat('Empty', '_empty').build()
    expect(showing(g, 'thisPlayerIs', [], 'w', name)).toBeUndefined()
    expect(showing(g, 'notInPlay', [], 'w', name)).toBeUndefined()
    expect(showing(g, 'selectedYou', [], 'w', name)).toBeUndefined()
    expect(showing(g, 'youAre', ['nobody'], 'w', name)).toBeUndefined()
    expect(showing(g, 'youAre', [id('Empty')], 'w', name)).toBeUndefined()
  })
})
