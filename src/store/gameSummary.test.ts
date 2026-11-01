import { t } from '../content'
import { execute, game, kill } from '../engine/testing/board'
import { newGame } from './saved'
import { describeGame } from './gameSummary'

const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)
const fr = (key: string, values?: Parameters<typeof t>[2]) => t('fr', key, values)

const now = Date.UTC(2026, 8, 5, 21, 0, 0)

const saved = (build: ReturnType<typeof game>, updatedAt = now) => {
  const { log } = build.build()
  return { ...newGame('tb', updatedAt), updatedAt, log }
}

describe('a saved game as a home row', () => {
  test('carries the script, the phase from the reduced board, the seat count and the time', () => {
    const table = game().seat('Ann', 'imp').seat('Bob', 'poisoner').seat('Cat', 'chef').seat('Dan', 'monk').seat('Eve', 'empath')
    const row = describeGame(saved(table.night(1).day().night(2, [kill('Dan')]), now - 3 * 3_600_000), en, 'en')
    expect(row).toMatchObject({ name: 'Trouble Brewing', phase: 'Night 2', players: '5 players', when: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(now - 3 * 3_600_000) })
    expect(row.logo).toBe('tb')
    expect(row.a11y).toContain(row.when)
    expect(row.a11y).toContain(row.duration)
  })

  test('the same game object keeps its row until the game, language or translator changes', () => {
    const played = saved(game().seat('Ann', 'imp').night(1))
    const row = describeGame(played, en, 'en')
    expect(describeGame(played, en, 'en')).toBe(row)
    expect(describeGame({ ...played }, en, 'en')).not.toBe(row)
    expect(describeGame({ ...played }, en, 'en')).toEqual(row)
    expect(describeGame(played, fr, 'fr')).toMatchObject({ phase: 'Nuit 1' })
    expect(describeGame(played, (key, values) => en(key, values), 'en')).not.toBe(row)
  })

  test('an empty log is a game in setup', () => {
    expect(describeGame(saved(game()), en, 'en')).toMatchObject({ phase: 'Setup', players: '0 players' })
  })

  test('a custom script takes the custom logo and its own name', () => {
    const custom = { kind: 'custom' as const, name: 'Teensyville night', items: [{ id: '_meta' as const, name: 'Teensyville night' }, 'imp', 'chef'] }
    const row = describeGame({ ...newGame(custom, now), log: [] }, en, 'en')
    expect(row.name).toBe('Teensyville night')
    expect(row.logo).toBe('custom')
  })

  test('the phase reads in the locale', () => {
    const row = describeGame(saved(game().seat('Ann', 'imp').night(1)), fr, 'fr')
    expect(row.phase).toBe('Nuit 1')
    expect(row.when).toBe(new Intl.DateTimeFormat('fr', { dateStyle: 'medium' }).format(now))
  })
})

describe('finished game colors', () => {
  const table = () => game().seat('Ann', 'imp').seat('Bob', 'chef').seat('Cat', 'monk').seat('Dan', 'empath').seat('Eve', 'saint')
  const end = () => ({ kind: 'phase' as const, to: 'over' as const })

  test('a finished game carries the good winner and its label', () => {
    const row = describeGame(saved(table().night(1).day([execute('Ann'), kill('Ann', 'execution'), () => ({ kind: 'endGame', winner: 'good' })])), en, 'en')
    expect(row).toMatchObject({ winner: 'good', phase: 'Good wins' })
    expect(row.a11y).toContain('Good wins')
  })

  test('the recorded evil result supplies the localized label', () => {
    const row = describeGame(saved(table().night(1).day([execute('Eve'), kill('Eve', 'execution'), () => ({ kind: 'endGame', winner: 'evil' })])), fr, 'fr')
    expect(row).toMatchObject({ winner: 'evil', phase: 'Le Mal gagne' })
  })

  test('an unfinished game and an ending without a verdict remain neutral', () => {
    expect(describeGame(saved(table().night(1)), en, 'en').winner).toBeUndefined()
    expect(describeGame(saved(table().night(1, [end])), en, 'en')).toMatchObject({ phase: 'Game over' })
    expect(describeGame(saved(table().night(1, [end])), en, 'en').winner).toBeUndefined()
  })
})
