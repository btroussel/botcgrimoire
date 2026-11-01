import { asCharacterId } from '../../content'
import { game, info, kill, nominate, setCharacter, token, vote, wake } from '../../engine/testing/board'
import { replayStops } from './replay'

describe('visible replay steps', () => {
  test('skips wakes, nominations and living votes, preserving reminders, death and ghost votes', () => {
    const { log } = game('tb', { legacy: true }).seat('Ann', 'poisoner').seat('Bob', 'monk')
      .night(1, [wake('Ann', 10), token('Ann', 'poisoner/Poisoned', 'Bob')])
      .day([nominate('Ann', 'Bob'), vote('Ann'), kill('Bob'), vote('Bob')])
      .add(() => ({ kind: 'phase', to: 'over' })).build()
    expect(replayStops(log, 'tb', 'en')).toEqual([2, 3, 5, 6, 9, 10, 11])
    expect(log).toHaveLength(11)
  })

  test('skips an edit that does not change what the board shows', () => {
    const { log } = game().seat('Ann', 'imp').night(1)
      .add(id => ({ kind: 'setAlignment', seat: id('Ann'), to: 'evil' }))
      .day().build()
    expect(replayStops(log, 'tb', 'en')).toEqual([1, 2, 4])
    expect(replayStops([], 'tb', 'en')).toEqual([0])
  })

  test('stops where the bluffs change, whether chosen or shown to the Demon in an older game', () => {
    const chosen = (...ids: readonly string[]) => () => ({ kind: 'setBluffs' as const, characters: ids.map(asCharacterId) })
    const { log } = game().seat('Ann', 'imp').seat('Bob', 'chef').seat('Cat', 'monk')
      .night(1, [
        info('Ann', { kind: 'characters', characters: ['saint', 'soldier', 'mayor'] }),
        info('Bob', { kind: 'characters', characters: ['empath'] }),
        chosen('virgin', 'slayer', 'butler'),
        info('Ann', { kind: 'characters', characters: ['saint', 'soldier', 'mayor'] }),
        chosen('slayer', 'virgin', 'butler'),
      ])
      .day([setCharacter('Ann', 'chef'), setCharacter('Bob', 'imp')]).build()
    // The legacy showing to the Demon counts; one to another seat, or after a choice, does not.
    expect(replayStops(log, 'tb', 'en')).toEqual([3, 4, 5, 7, 9, 10, 11, 12])
  })
})
