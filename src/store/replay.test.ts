import { game, kill, token } from '../engine/testing/board'
import { phaseAt, phaseMarks, replayStart, setupStart } from './replay'
import { newGame } from './saved'
import { append, boardOf, lookAt, openSession, returnToPresent } from './session'

describe('board replay', () => {
  test('setup returns to dealt roles while replay opens with preparation tokens in place', () => {
    const { log } = game().seat('Ann', 'washerwoman').seat('Bob', 'chef')
      .add(token('Ann', 'washerwoman/Townsfolk', 'Bob')).night(1).day()
      .add(() => ({ kind: 'phase', to: 'over' })).build()
    const session = openSession({ ...newGame('tb', 1000), log })
    const initial = boardOf(lookAt(session, setupStart(log)))
    const start = boardOf(lookAt(session, replayStart(log)))
    expect(initial.seats).toHaveLength(2)
    expect(initial.seats[1]?.tokens).toHaveLength(0)
    expect(start.seats[1]?.tokens).toHaveLength(1)
    expect(start.clock.phase).toBe('night')
    expect(phaseMarks(log)).toEqual([
      { cursor: 2, phase: 'setup', night: 0 },
      { cursor: 4, phase: 'night', night: 1 },
      { cursor: 5, phase: 'day', night: 1 },
      { cursor: 6, phase: 'over', night: 1 },
    ])
    const marks = phaseMarks(log)
    expect(phaseAt(marks, 3).phase).toBe('setup')
    expect(phaseAt(marks, 4).phase).toBe('night')
    expect(phaseAt(marks, 5).phase).toBe('day')
    expect(phaseAt(marks, 6).phase).toBe('over')
  })

  test('opens at the first night, or the dealt board before play starts', () => {
    const setup = game().seat('Ann', 'imp').seat('Bob', 'chef')
    expect(replayStart(setup.build().log)).toBe(2)
    const { log } = setup.night(1).day().night(2).build()
    expect(replayStart(log)).toBe(3)
    expect(replayStart([])).toBe(0)
  })

  test('day and night jumps restore life states without changing the saved game', () => {
    const { log } = game().seat('Ann', 'imp').seat('Bob', 'chef')
      .night(1).day().night(2, [kill('Bob')]).day().build()
    const session = openSession({ ...newGame('tb', 1000), log })
    const marks = phaseMarks(log)
    const night = marks.find(mark => mark.phase === 'night' && mark.night === 2)!
    const day = marks.find(mark => mark.phase === 'day' && mark.night === 2)!
    const before = lookAt(session, night.cursor)
    const after = lookAt(session, day.cursor)
    expect(boardOf(before).seats[1]?.alive).toBe(true)
    expect(boardOf(after).seats[1]?.alive).toBe(false)
    expect(boardOf(after).clock).toMatchObject({ phase: 'day', night: 2 })
    expect(before.game).toBe(session.game)
    expect(after.game).toBe(session.game)
    expect(after.lookingAt).toBe(log.length)
    expect(() => append(after, { kind: 'phase', to: 'night', night: 3 }, 2000)).toThrow()
    expect(returnToPresent(after).lookingAt).toBeUndefined()
    expect(boardOf(returnToPresent(after))).toEqual(boardOf(session))
  })
})
