import { asCharacterId } from '../content'
import type { Event } from './events'
import { asEventId } from './ids'
import { reduce } from './reduce'
import { execute, game, grant, kill, nominate, revive, setCharacter, token, vote } from './testing/board'

// Replay compatibility: logs saved before manual edits keep the board they were played with.
const legacy = (script: 'tb' | 'bmr' | 'snv' = 'tb') => game(script, { legacy: true })

describe('replaying unflagged events', () => {
  test("an unflagged revive clears the Puzzlemaster's spent guess and keeps their drunk player", () => {
    const b = legacy().seat('Puzzle', 'puzzlemaster').seat('Target', 'chef').seat('Demon', 'imp')
      .night(1, [token('Puzzle', 'puzzlemaster/Drunk', 'Target')])
      .day([token('Puzzle', 'puzzlemaster/Guess Used', 'Puzzle'), kill('Puzzle'), revive('Puzzle')]).build()
    expect(b.g.seats[0]!.tokens.some(t => t.def[1] === 'Guess Used')).toBe(false)
    expect(b.g.seats[1]!.tokens.some(t => t.def[0] === 'puzzlemaster' && t.def[1] === 'Drunk')).toBe(true)
  })

  test('an unflagged day kill leaves the seat dead, as a manual one does', () => {
    const { g, id } = legacy().seat('Ann', 'imp').seat('Bob', 'monk').night(1).day([kill('Bob', 'ability')]).build()
    expect(g.seats.find((s) => s.id === id('Bob'))?.alive).toBe(false)
  })

  test('an unflagged character change drops the tokens it placed and keeps what others placed', () => {
    const built = legacy()
      .seat('Ann', 'poisoner')
      .seat('Bob', 'monk')
      .seat('Cat', 'chef')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Cat'), token('Bob', 'monk/Safe', 'Ann'), setCharacter('Ann', 'imp')])
      .build()
    const ann = built.g.seats.find((s) => s.id === built.id('Ann'))
    const cat = built.g.seats.find((s) => s.id === built.id('Cat'))
    expect(ann?.character).toBe(asCharacterId('imp'))
    expect(ann?.tokens.map((t) => t.def)).toEqual([['monk', 'Safe']])
    expect(cat?.tokens).toEqual([])
  })

  test('an unflagged character change clears the shown character', () => {
    const built = legacy().seat('Ann', 'drunk', { shown: 'chef' }).night(1, [setCharacter('Ann', 'imp')]).build()
    expect(built.g.seats[0]?.shown).toBeUndefined()
    expect(reduce('tb', built.log.slice(0, 2)).seats[0]?.shown).toBe(asCharacterId('chef'))
  })

  test("the Fang Gu's spent jump survives an unflagged character change and revocation", () => {
    const changed = legacy('bmr').seat('Ann', 'fanggu').seat('Bob', 'chambermaid')
      .night(1, [token('Ann', 'fanggu/Once', 'Ann'), token('Ann', 'fanggu/Dead', 'Bob'), setCharacter('Ann', 'imp')]).build()
    expect(changed.g.seats.map(s => s.tokens.map(t => t.def))).toEqual([[['fanggu', 'Once']], []])
    const revoked = legacy('bmr').seat('Ann', 'philosopher').seat('Bob', 'chambermaid')
      .night(1, [grant('Ann', 'fanggu'), token('Ann', 'fanggu/Once', 'Ann'), token('Ann', 'fanggu/Dead', 'Bob')])
      .build()
    const grantedBy = revoked.g.seats[0]!.abilities[0]!.grantedBy
    const g = reduce('bmr', [...revoked.log, { id: asEventId(revoked.log.length), audience: 'storyteller', kind: 'revoke', grantedBy }])
    expect(g.seats[0]!.abilities).toEqual([])
    expect(g.seats.map(s => s.tokens.map(t => t.def))).toEqual([[['fanggu', 'Once']], []])
  })

  test("an unflagged revocation ends the last copy's sourced reminders", () => {
    const b = legacy('snv').seat('Ann', 'philosopher').seat('Bob', 'chef')
      .night(1, [grant('Ann', 'sage'), token('Ann', 'sage/Know', 'Bob')]).build()
    const grantedBy = b.g.seats[0]!.abilities[0]!.grantedBy
    const g = reduce('snv', [...b.log, { id: asEventId(b.log.length), audience: 'storyteller', kind: 'revoke', grantedBy }])
    expect(g.seats[1]!.tokens).toEqual([])
  })

  test("an unflagged character change drops the Philosopher's own grant", () => {
    const b = legacy('snv').seat('Ann', 'philosopher').seat('Bob', 'chef')
      .night(1, [grant('Ann', 'sage', 'Ann'), grant('Ann', 'savant', 'storyteller'), setCharacter('Ann', 'chef')]).build()
    expect(b.g.seats[0]!.abilities.map(a => [a.of, a.source])).toEqual([['savant', 'storyteller']])
  })

  test('an unflagged dead vote spends the ghost vote unless the hand was free', () => {
    const { g, id } = legacy()
      .seat('Ann', 'imp').seat('Bob', 'monk').seat('Cat', 'chef').seat('Tim', 'thief')
      .night(1)
      .day([kill('Bob', 'storyteller'), kill('Cat', 'storyteller'), nominate('Ann', 'Tim'), vote('Bob', 'Tim'), vote('Cat', 'Tim', 1, true)])
      .build()
    expect(g.seats.find((s) => s.id === id('Bob'))?.ghostVote).toBe(false)
    expect(g.seats.find((s) => s.id === id('Cat'))?.ghostVote).toBe(true)
    expect(g.days[0]?.nominations.map((n) => n.weight)).toEqual([2])
  })

  test('an unflagged vote by a Zombuul with its Dead token spends the ghost vote', () => {
    const { g, id } = legacy('bmr').seat('Ann', 'zombuul').seat('Bob', 'chambermaid')
      .night(1).day([token('Ann', 'zombuul/Dead', 'Ann'), nominate('Bob', 'Bob'), vote('Ann', 'Bob')]).build()
    const ann = g.seats.find((s) => s.id === id('Ann'))
    expect(ann?.alive).toBe(true)
    expect(ann?.ghostVote).toBe(false)
  })

  test('an unflagged unvote may leave a negative total', () => {
    const b = legacy().seat('Ann', 'chef').seat('Bob', 'imp').night(1).day([nominate('Ann', 'Bob'), vote('Ann', 'Bob')]).build()
    const opened = b.g.days[0]!.nominations[0]!.opened
    const unvote: Event = { id: asEventId(b.log.length), audience: 'storyteller', kind: 'unvote', nomination: opened, seat: b.id('Ann'), weight: 3 }
    expect(reduce('tb', [...b.log, unvote]).days[0]!.nominations[0]!.weight).toBe(-2)
  })

  test('an unflagged day after setup opens no ledger entry, and an execution closes the day', () => {
    const early = legacy().seat('Ann', 'chef').day().build()
    expect(early.g.clock.phase).toBe('day')
    expect(early.g.days).toEqual([])
    const b = legacy().seat('Ann', 'chef').night(1).day([execute('Ann'), () => ({ kind: 'execute', cause: 'vote' })]).build()
    expect(b.g.days[0]).toMatchObject({ closed: true })
  })
})
