import type { SeatId } from '../../engine'
import { game, info, token } from '../../engine/testing/board'
import { bluffsOf } from '../../store/bluffs'
import { believed, showTokens, showing } from './show'

// Uppercase ids verify that card names come from the supplied locale lookup.
const name = (id: string) => id.toUpperCase()
const printed = (...ids: readonly string[]) => ids.map((id) => ({ id, name: name(id) }))
const table = () => game().seat('Ann', 'imp').seat('Bob', 'poisoner').seat('Cat', 'drunk', { shown: 'empath' }).seat('Dan', 'chef')

describe('showing a card from the board', () => {
  test('a seat card starts from the seat token when nothing else is shown', () => {
    const { g, id } = game().seat('Player', 'drunk').build()
    expect(believed(g, id('Player'))).toBe('drunk')
    expect(showing(g, 'youAre', { seat: id('Player'), characters: ['drunk'] }, 'You are', name)).toMatchObject({ characters: printed('drunk') })
  })

  test('YOU ARE starts from the believed character without an information event', () => {
    const { g, id } = table().build()
    expect(believed(g, id('Cat'))).toBe('empath')
    expect(showing(g, 'youAre', { seat: id('Cat'), characters: ['empath'] }, 'You are', name)).toEqual({
      kind: 'youAre', words: 'You are', characters: printed('empath'), tint: 'good',
    })
  })

  test('YOU ARE carries a plain character in the seat alignment', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).build()
    expect(showing(g, 'youAre', { seat: id('Bob'), characters: ['chef'] }, 'w', name)).toMatchObject({ characters: printed('chef'), tint: 'evil' })
  })

  test('YOU ARE keeps a Marionette sitting as the Chef on the good side', () => {
    const { g, id } = game().seat('Bob', 'chef', { alignment: 'evil' }).add(token('storyteller', 'marionette/Is The Marionette', 'Bob')).build()
    expect(believed(g, id('Bob'))).toBe('chef')
    expect(showing(g, 'youAre', { seat: id('Bob'), characters: ['chef'] }, 'w', name)).toMatchObject({ characters: printed('chef'), tint: 'good' })
  })

  test('YOU ARE prints the characters the Storyteller picks in the seat alignment', () => {
    const { g, id } = table().build()
    expect(showing(g, 'youAre', { seat: id('Ann'), characters: ['chef', 'monk'] }, 'w', name)).toEqual({
      kind: 'youAre', words: 'w', characters: printed('chef', 'monk'), tint: 'evil',
    })
  })

  test('THIS PLAYER IS names the selected player without leaking a disguised role', () => {
    const { g, id } = table().build()
    expect(showing(g, 'thisPlayerIs', { seat: id('Cat'), characters: [believed(g, id('Cat'))!] }, 'This player is', name)).toEqual({
      kind: 'thisPlayerIs', words: 'This player is', characters: printed('empath'), caption: 'Cat', tint: 'good',
    })
  })

  test('THIS PLAYER IS shows a false character in its own colours, never the seat side', () => {
    const { g, id } = table().build()
    expect(showing(g, 'thisPlayerIs', { seat: id('Ann'), characters: ['chef'] }, 'w', name)).toEqual({
      kind: 'thisPlayerIs', words: 'w', characters: printed('chef'), caption: 'Ann',
    })
    expect(showing(g, 'thisPlayerIs', { seat: id('Ann'), characters: ['imp', 'chef'] }, 'w', name)).toEqual({
      kind: 'thisPlayerIs', words: 'w', characters: printed('imp', 'chef'), caption: 'Ann',
    })
  })

  test.each(['youAreGood', 'youAreEvil', 'thisIsTheDemon', 'theseAreYourMinions'] as const)('%s opens without any player selection', (kind) => {
    const { g } = game().build()
    expect(showTokens.find((token) => token.kind === kind)?.about).toBeUndefined()
    expect(showing(g, kind, {}, 'w', name)).toEqual({ kind, words: 'w' })
  })

  test('character cards print every selected character in order', () => {
    const { g } = table().build()
    expect(showing(g, 'notInPlay', { characters: ['monk', 'saint', 'butler'] }, 'w', name)).toEqual({
      kind: 'notInPlay', words: 'w', characters: printed('monk', 'saint', 'butler'), tint: 'good',
    })
    expect(showing(g, 'selectedYou', { characters: ['poisoner'] }, 'w', name)).toEqual({
      kind: 'selectedYou', words: 'w', characters: printed('poisoner'),
    })
    expect(showing(g, 'thisCharacterIs', { characters: ['chef'] }, 'w', name)).toEqual({
      kind: 'thisCharacterIs', words: 'w', characters: printed('chef'),
    })
  })

  test('several characters on one card keep their own sides', () => {
    const { g } = table().build()
    for (const kind of ['thisCharacterIs', 'selectedYou'] as const) {
      expect(showing(g, kind, { characters: ['empath', 'imp'] }, 'w', name)).toEqual({ kind, words: 'w', characters: printed('empath', 'imp') })
    }
  })

  test('manual displays leave the board, saved bluffs and existing log unchanged', () => {
    const { g, log, id } = table().night(1, [info('Ann', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] })]).build()
    const before = JSON.stringify({ g, log })
    for (let repeat = 0; repeat < 2; repeat++) {
      showing(g, 'notInPlay', { characters: ['chef', 'saint', 'butler'] }, 'w', name)
      showing(g, 'youAre', { seat: id('Ann'), characters: ['chef'] }, 'w', name)
      showing(g, 'youAreEvil', {}, 'w', name)
    }
    expect(JSON.stringify({ g, log })).toBe(before)
    expect(bluffsOf(g, log)).toEqual(['librarian', 'monk', 'slayer'])
  })

  test('a card requiring content refuses missing or empty seats and missing characters', () => {
    const { g, id } = game().seat('Empty', '_empty').seat('Dan', 'chef').build()
    expect(believed(g, id('Empty'))).toBeUndefined()
    expect(showing(g, 'thisPlayerIs', { characters: ['chef'] }, 'w', name)).toBeUndefined()
    expect(showing(g, 'thisPlayerIs', { seat: id('Dan') }, 'w', name)).toBeUndefined()
    expect(showing(g, 'notInPlay', {}, 'w', name)).toBeUndefined()
    expect(showing(g, 'selectedYou', { characters: [] }, 'w', name)).toBeUndefined()
    expect(showing(g, 'youAre', { seat: 'nobody' as SeatId, characters: ['chef'] }, 'w', name)).toBeUndefined()
    expect(showing(g, 'youAre', { seat: id('Empty'), characters: ['chef'] }, 'w', name)).toBeUndefined()
  })
})
