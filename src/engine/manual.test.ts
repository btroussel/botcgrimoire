import { asCharacterId } from '../content'
import { apply, reduce } from './reduce'
import { asEventId } from './ids'
import type { Event, Payload } from './events'
import { game, grant, kill, token } from './testing/board'

const manual = (payload: Payload, id = 100): Event => ({ ...payload, id: asEventId(id), audience: 'storyteller', manual: true })

test('manual character, revival and grant edits retain every reminder', () => {
  const b = game().seat('Ann', 'slayer').seat('Bob', 'chef')
    .add(token('Ann', 'slayer/No Ability', 'Ann'), grant('Bob', 'slayer', 'Ann'), token('Bob', 'slayer/No Ability', 'Bob'), kill('Ann')).build()
  const initial = b.g.seats.map(s => s.tokens)
  let g = apply(b.g, manual({ kind: 'revive', seat: b.id('Ann') }))
  g = apply(g, manual({ kind: 'setCharacter', seat: b.id('Ann'), to: asCharacterId('monk') }))
  g = apply(g, manual({ kind: 'revoke', grantedBy: g.seats[1]!.abilities[0]!.grantedBy }))
  expect(g.seats.map(s => s.tokens)).toEqual(initial)
  expect(g.seats[0]!.alive).toBe(true)
  expect(g.seats[1]!.abilities).toEqual([])
})

test('manual voting and execution leave ghost votes and life to explicit edits', () => {
  const b = game().seat('Ann', 'chef').seat('Bob', 'imp').add(kill('Ann')).build()
  const log = [...b.log,
    manual({ kind: 'phase', to: 'day' }),
    manual({ kind: 'nominate', by: b.id('Ann'), of: b.id('Bob') }, 101),
    manual({ kind: 'vote', nomination: asEventId(101), seat: b.id('Ann'), weight: 3 }),
    manual({ kind: 'execute', seat: b.id('Bob'), cause: 'vote' }),
  ]
  const g = reduce('tb', log)
  expect(g.days[0]!.nominations[0]!.weight).toBe(3)
  expect(g.seats[0]!.ghostVote).toBe(true)
  expect(g.seats[1]!.alive).toBe(true)
  const spent = apply(g, manual({ kind: 'setGhostVote', seat: b.id('Ann'), available: false }))
  expect(spent.seats[0]!.ghostVote).toBe(false)
  expect(apply(spent, manual({ kind: 'setGhostVote', seat: b.id('Ann'), available: true })).seats[0]!.ghostVote).toBe(true)
})

test('reordering retains identity and result is recorded only by an explicit end', () => {
  const b = game().seat('Ann', 'chef').seat('Bob', 'imp').seat('Cat', 'monk').build()
  const moved = apply(b.g, manual({ kind: 'moveSeat', seat: b.id('Ann'), to: 2 }))
  expect(moved.seats.map(s => s.name)).toEqual(['Bob', 'Cat', 'Ann'])
  expect(moved.seats[2]).toBe(b.g.seats[0])
  expect(b.g.seats.map(s => s.name)).toEqual(['Ann', 'Bob', 'Cat'])
  const ended = apply(moved, manual({ kind: 'endGame', winner: 'evil', note: 'Storyteller ruling' }))
  expect(ended.clock.phase).toBe('over')
  expect(ended.result).toEqual({ winner: 'evil', note: 'Storyteller ruling' })
  expect(moved.result).toBeUndefined()
})

test('night checklist notes do not mutate the board', () => {
  const b = game().seat('Ann', 'chef').build()
  expect(apply(b.g, manual({ kind: 'nightChecklist', entry: 'custom:1', status: 'done', label: 'Remember note' }))).toBe(b.g)
})

test('an execution, with a seat or without one, closes the day without changing life', () => {
  const b = game().seat('Ann', 'chef').build()
  let g = apply(b.g, manual({ kind: 'phase', to: 'day' }))
  g = apply(g, manual({ kind: 'execute', seat: b.id('Ann'), cause: 'vote' }))
  expect(g.days[0]!.closed).toBe(true)
  g = apply(g, manual({ kind: 'execute', cause: 'vote' }))
  expect(g.days[0]!.closed).toBe(true)
  expect(g.seats[0]!.alive).toBe(true)
})

test('an explicit vote total preserves recorded voters and later votes adjust it', () => {
  const b = game().seat('Ann', 'chef').seat('Bob', 'imp').build()
  let g = apply(b.g, manual({ kind: 'phase', to: 'day' }))
  g = apply(g, manual({ kind: 'nominate', by: b.id('Ann'), of: b.id('Bob') }, 101))
  g = apply(g, manual({ kind: 'vote', nomination: asEventId(101), seat: b.id('Ann'), weight: 1 }))
  g = apply(g, manual({ kind: 'setVoteTotal', nomination: asEventId(101), total: 7 }))
  expect(g.days[0]!.nominations[0]).toMatchObject({ votes: [b.id('Ann')], weight: 7 })
  g = apply(g, manual({ kind: 'vote', nomination: asEventId(101), seat: b.id('Bob'), weight: 1 }))
  expect(g.days[0]!.nominations[0]!.weight).toBe(8)
  g = apply(g, manual({ kind: 'unvote', nomination: asEventId(101), seat: b.id('Ann'), weight: 1 }))
  expect(g.days[0]!.nominations[0]).toMatchObject({ votes: [b.id('Bob')], weight: 7 })
  g = apply(g, manual({ kind: 'setVoteTotal', nomination: asEventId(101), total: 0 }))
  g = apply(g, manual({ kind: 'unvote', nomination: asEventId(101), seat: b.id('Bob'), weight: 1 }))
  expect(g.days[0]!.nominations[0]).toMatchObject({ votes: [], weight: 0 })
})
