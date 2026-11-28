import { asCharacterId, t } from '../../content'
import { game, info, kill, nominate, setCharacter, token, vote, wake } from '../../engine/testing/board'
import { phaseMarks } from '../../store/replay'
import { newGame } from '../../store/saved'
import { appendAll, openSession } from '../../store/session'
import { marksOnSteps, replaySteps, stepAt } from './replay'
import { edits } from './seat'

const replayStops = (...args: Parameters<typeof replaySteps>) => replaySteps(...args).map(step => step.cursor)

describe('visible replay steps', () => {
  test('skips wakes, stopping at reminders, nominations, the block, death and ghost votes', () => {
    const { log } = game('tb', { legacy: true }).seat('Ann', 'poisoner').seat('Bob', 'monk')
      .night(1, [wake('Ann', 10), token('Ann', 'poisoner/Poisoned', 'Bob')])
      .day([nominate('Ann', 'Bob'), vote('Ann'), kill('Bob'), vote('Bob')])
      .add(() => ({ kind: 'phase', to: 'over' })).build()
    // An older day puts the vote's leader on the block, so the first hand shows on the board.
    expect(replayStops(log, 'tb', 'en')).toEqual([2, 3, 5, 6, 7, 8, 9, 10, 11])
    expect(log).toHaveLength(11)
  })

  test('skips an edit that does not change what the board shows', () => {
    const { log } = game().seat('Ann', 'imp').night(1)
      .add(id => ({ kind: 'setAlignment', seat: id('Ann'), to: 'evil' }))
      .day().build()
    expect(replayStops(log, 'tb', 'en')).toEqual([1, 2, 4])
    expect(replayStops([], 'tb', 'en')).toEqual([0])
  })

  test('one action is one step, so a moved reminder never shows off the board, and a phase keeps its stop', () => {
    const table = game().seat('Ann', 'poisoner').seat('Bob', 'monk').night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).build()
    const session = openSession({ ...newGame('tb', 1000), log: table.log })
    const placedBy = table.g.seats[1]!.tokens[0]!.placedBy
    const moved = appendAll(session, edits.moveToken(table.g, placedBy, table.id('Ann')), 1001)
    expect(moved.game.log).toHaveLength(6)
    expect(replayStops(moved.game.log, 'tb', 'en')).toEqual([2, 3, 4, 6])
    const dawn = appendAll(moved, [{ kind: 'phase', to: 'day' }, edits.removeToken(moved.game.log.at(-1)!.id)], 1002)
    expect(replayStops(dawn.game.log, 'tb', 'en')).toEqual([2, 3, 4, 6, 7, 8])
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

describe('where the phases are marked on the replay', () => {
  test('a first night started with the deal shares its step with setup, and the step is marked once, as the night', () => {
    const table = game().seat('Ann', '_empty').seat('Bob', '_empty').build()
    const started = appendAll(openSession({ ...newGame('tb', 1000), log: table.log }), [
      { kind: 'setCharacter', seat: table.id('Ann'), to: asCharacterId('imp'), alignment: 'evil' },
      { kind: 'setCharacter', seat: table.id('Bob'), to: asCharacterId('monk'), alignment: 'good' },
      { kind: 'phase', to: 'night', night: 1 },
    ], 1001)
    const log = appendAll(started, [{ kind: 'phase', to: 'day' }], 1002).game.log
    const marks = phaseMarks(log)
    expect(marks.map(mark => [mark.phase, mark.cursor])).toEqual([['setup', 5], ['night', 5], ['day', 6]])
    expect(marksOnSteps(marks, replaySteps(log, 'tb', 'en'))).toEqual([
      { at: 0, mark: { cursor: 5, phase: 'night', night: 1 } },
      { at: 1, mark: { cursor: 6, phase: 'day', night: 1 } },
    ])
  })
})

describe('what a replay step says it changed', () => {
  const captions = (steps: ReturnType<typeof replaySteps>) => steps.map(step => step.changes.map(change => t('en', change.key, change.values)))

  test('every mark the board draws is a step: nominations, the block and a seat laid out', () => {
    const { log, id } = game().seat('Ann', 'imp').seat('Bob', 'monk').seat('Cat', 'chef').night(1).day([nominate('Ann', 'Bob')])
      .add(id => ({ kind: 'markForExecution', seat: id('Bob') }))
      .add(id => ({ kind: 'placeSeat', seat: id('Cat'), at: { x: 0.2, y: 0.3 } }))
      .add(id => ({ kind: 'nominate', by: id('Cat'), of: id('Ann') }))
      .build()
    const steps = replaySteps(log, 'tb', 'en')
    expect(steps.map(step => step.cursor)).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(captions(steps).slice(3)).toEqual([['Ann nominates Bob'], ['Bob is on the block'], ['Cat moves'], ['Cat nominates Ann']])
    expect(steps.slice(3).map(step => step.seats)).toEqual([[id('Ann'), id('Bob')], [id('Bob')], [id('Cat')], [id('Cat'), id('Ann')]])
  })

  test('a reminder moved is one step, read seat by seat round the ring', () => {
    const table = game().seat('Ann', 'poisoner').seat('Bob', 'monk').night(1, [token('Ann', 'poisoner/Poisoned', 'Bob'), kill('Bob')]).build()
    const session = openSession({ ...newGame('tb', 1000), log: table.log })
    const moved = appendAll(session, edits.moveToken(table.g, table.g.seats[1]!.tokens[0]!.placedBy, table.id('Ann')), 1001)
    expect(captions(replaySteps(moved.game.log, 'tb', 'en')).slice(-3)).toEqual([['Poisoned on Bob'], ['Bob dies'], ['Poisoned on Ann', 'Poisoned removed from Bob']])
  })

  test('a seat cleared of its character and bluffs cleared each say so, and the cleared seat is lit', () => {
    const bluffs = (...ids: readonly string[]) => () => ({ kind: 'setBluffs' as const, characters: ids.map(asCharacterId) })
    const { log, id } = game().seat('Ann', 'imp').seat('Bob', 'monk')
      .night(1, [bluffs('chef', 'mayor', 'saint'), setCharacter('Bob', '_empty'), bluffs()]).build()
    const steps = replaySteps(log, 'tb', 'en').slice(-2)
    expect(captions(steps)).toEqual([['Bob no longer has a character'], ['Bluffs cleared']])
    expect(steps.map(step => step.seats)).toEqual([[id('Bob')], []])
  })

  test('a phase alone says nothing and lights no seat, even as the day marks go', () => {
    const { log } = game().seat('Ann', 'imp').seat('Bob', 'monk').night(1).day([nominate('Ann', 'Bob')]).night(2).build()
    const dusk = replaySteps(log, 'tb', 'en').at(-1)!
    expect(dusk).toEqual({ cursor: log.length, seats: [], changes: [] })
  })

  test('a cursor between steps shows the step before it, and one before the first shows the first', () => {
    const steps = replaySteps(game().seat('Ann', 'imp').seat('Bob', 'monk').add(id => ({ kind: 'wake', seat: id('Ann'), step: 1 })).build().log, 'tb', 'en')
    expect(steps.map(step => step.cursor)).toEqual([2])
    expect(stepAt(steps, 3)).toBe(0)
    expect(stepAt(steps, 0)).toBe(0)
  })
})
