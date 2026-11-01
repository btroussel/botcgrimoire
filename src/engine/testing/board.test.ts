import { addTraveller, execute, game, info, nominate, removeSeat, removeToken, token, vote } from './board'

describe('the board builder', () => {
  test('events are manual edits unless the game replays a legacy log', () => {
    expect(game().seat('Ann', 'imp').build().log.every((e) => e.manual)).toBe(true)
    expect(game('tb', { legacy: true }).seat('Ann', 'imp').build().log.some((e) => e.manual)).toBe(false)
  })

  test('a vote lands on the last nomination of the named nominee', () => {
    const { g, id } = game()
      .seat('Ann', 'imp')
      .seat('Bob', 'monk')
      .seat('Cat', 'chef')
      .night(1)
      .day([nominate('Ann', 'Bob'), nominate('Bob', 'Cat'), vote('Ann', 'Bob'), vote('Cat'), execute('Cat')])
      .build()
    const [first, second] = g.days[0]?.nominations ?? []
    expect(first).toMatchObject({ of: id('Bob'), votes: [id('Ann')], weight: 1 })
    expect(second).toMatchObject({ of: id('Cat'), votes: [id('Cat')], weight: 1 })
  })

  test('a vote with nobody nominated is a mistake in the scenario', () => {
    expect(() => game().seat('Ann', 'imp').night(1).day([vote('Ann')]).build()).toThrow(/no nomination/)
  })

  test('removeToken takes the last token of that kind off the seat', () => {
    const { g, id } = game()
      .seat('Ann', 'poisoner')
      .seat('Bob', 'chef')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob'), removeToken('Bob', 'poisoner/Poisoned')])
      .build()
    expect(g.seats.find((s) => s.id === id('Bob'))?.tokens).toEqual([])
  })

  test('a traveller joins at the index given and is named like any seat', () => {
    const { g, id } = game()
      .seat('Ann', 'imp')
      .seat('Bob', 'chef')
      .night(1)
      .day([addTraveller('Tim', 'thief', 1, 'evil'), removeSeat('Bob')])
      .build()
    expect(g.seats.map((s) => s.id)).toEqual([id('Ann'), id('Tim')])
    expect(g.seats[1]).toMatchObject({ character: 'thief', alignment: 'evil' })
  })

  test('info resolves seat names inside what was told and defaults truth to it', () => {
    const { log, id } = game()
      .seat('Ann', 'imp')
      .seat('Bob', 'washerwoman')
      .seat('Cat', 'chef')
      .night(1, [info('Bob', { kind: 'oneOfTwo', seats: ['Ann', 'Cat'], character: 'chef' })])
      .build()
    expect(log[log.length - 1]).toMatchObject({
      kind: 'info',
      to: [id('Bob')],
      told: { kind: 'oneOfTwo', seats: [id('Ann'), id('Cat')], character: 'chef' },
      truth: { kind: 'oneOfTwo', seats: [id('Ann'), id('Cat')], character: 'chef' },
      malfunctioned: false,
    })
  })
})
