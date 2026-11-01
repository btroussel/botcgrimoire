import { asCharacterId } from '../content'
import { addLoose, execute, game, kill, nominate, removeLoose, setCharacter, silentStep, storytellerNominates, token } from './testing/board'
import { reduce } from './reduce'
import type { Event } from './events'
import { asEventId } from './ids'

describe('reduce', () => {
  test('an empty log is an empty board in setup', () => {
    const g = reduce('tb', [])
    expect(g.seats).toEqual([])
    expect(g.clock).toEqual({ night: 0, phase: 'setup' })
    expect(g.days).toEqual([])
  })

  test('seats sit clockwise in the order added, with the alignment of their team', () => {
    const { g } = game().seat('Ann', 'imp').seat('Bob', 'monk').seat('Cat', 'chef').build()
    expect(g.seats.map((s) => [s.name, s.alignment, s.alive])).toEqual([
      ['Ann', 'evil', true],
      ['Bob', 'good', true],
      ['Cat', 'good', true],
    ])
  })

  test('older night steps and markers change nothing on the board', () => {
    const { g } = game().seat('Ann', 'imp').seat('Bob', 'monk').night(2, [silentStep('Bob', 12)]).build()
    expect(g.clock).toEqual({ night: 2, phase: 'night' })
    const marker = game().seat('Ann', 'imp').night(2).add(() => ({ kind: 'nightProgress', marker: 'dusk' })).build()
    expect(marker.g.clock).toEqual({ night: 2, phase: 'night' })
  })

  test('night sets the clock and the first day after it opens the ledger', () => {
    const { g } = game().seat('Ann', 'imp').night(1).day().night(2).day().build()
    expect(g.clock).toEqual({ night: 2, phase: 'day' })
    expect(g.days).toHaveLength(2)
  })

  test('a kill leaves the seat dead with its ghost vote', () => {
    const { g, id } = game().seat('Ann', 'imp').seat('Bob', 'monk').night(1).day([kill('Bob', 'ability')]).build()
    const bob = g.seats.find((s) => s.id === id('Bob'))
    expect(bob?.alive).toBe(false)
    expect(bob?.ghostVote).toBe(true)
  })

  test('an execution closes the day without killing anyone by itself', () => {
    const { g, id } = game().seat('Ann', 'imp').seat('Bob', 'monk').night(1).day([execute('Bob')]).build()
    expect(g.days[0]?.closed).toBe(true)
    expect(g.seats.find((s) => s.id === id('Bob'))?.alive).toBe(true)
  })

  test('votes land on the nomination they name, and a dead voter keeps the ghost vote', () => {
    const board = game().seat('Ann', 'imp').seat('Bob', 'monk').seat('Cat', 'chef').night(1).day([kill('Cat'), nominate('Ann', 'Bob')])
    const built = board.build()
    const nomination = built.g.days[0]?.nominations[0]
    const log: Event[] = [
      ...built.log,
      { id: asEventId(built.log.length), audience: 'storyteller', manual: true, kind: 'vote', nomination: nomination!.opened, seat: built.id('Cat'), weight: 1 },
    ]
    const g = reduce('tb', log)
    expect(g.days[0]?.nominations[0]).toMatchObject({ votes: [built.id('Cat')], weight: 1 })
    expect(g.seats.find((s) => s.id === built.id('Cat'))?.ghostVote).toBe(true)
  })

  test('a token is placed with its source and removed by the event that placed it', () => {
    const built = game().seat('Ann', 'poisoner').seat('Bob', 'monk').night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).build()
    const bob = built.g.seats.find((s) => s.id === built.id('Bob'))
    expect(bob?.tokens).toEqual([{ def: ['poisoner', 'Poisoned'], source: built.id('Ann'), placedBy: built.log.length - 1 }])
    const placedBy = bob!.tokens[0]!.placedBy
    const g = reduce('tb', [...built.log, { id: asEventId(built.log.length), audience: 'storyteller', kind: 'removeToken', placedBy }])
    expect(g.seats.find((s) => s.id === built.id('Bob'))?.tokens).toEqual([])
  })

  test('changing a character keeps the alignment and every reminder until they are edited', () => {
    const built = game()
      .seat('Ann', 'poisoner')
      .seat('Bob', 'monk')
      .seat('Cat', 'chef')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Cat'), token('Bob', 'monk/Safe', 'Ann'), setCharacter('Ann', 'imp')])
      .build()
    const ann = built.g.seats.find((s) => s.id === built.id('Ann'))
    const cat = built.g.seats.find((s) => s.id === built.id('Cat'))
    expect(ann?.character).toBe(asCharacterId('imp'))
    expect(ann?.alignment).toBe('evil')
    expect(ann?.tokens.map((t) => t.def)).toEqual([['monk', 'Safe']])
    expect(cat?.tokens.map((t) => t.def)).toEqual([['poisoner', 'Poisoned']])
  })

  test('a shown character is what the seat believes, and setting the character keeps it', () => {
    const built = game().seat('Ann', 'drunk', { shown: 'chef' }).night(1, [setCharacter('Ann', 'imp')]).build()
    expect(built.g.seats[0]?.shown).toBe(asCharacterId('chef'))
    expect(built.g.seats[0]?.character).toBe(asCharacterId('imp'))
  })

  test('looking back is the same reduction on a shorter log', () => {
    const built = game().seat('Ann', 'imp').seat('Bob', 'monk').night(1, [kill('Bob')]).build()
    expect(reduce('tb', built.log.slice(0, 3)).seats[1]?.alive).toBe(true)
    expect(built.g.seats[1]?.alive).toBe(false)
  })
})

describe('reduce and the Storyteller as a nominee', () => {
  test("the Storyteller's nomination for a Bishop is recorded with no seat behind it", () => {
    const { g, id } = game('bmr').seat('Ann', 'zombuul').seat('Bob', 'chambermaid').seat('Tim', 'bishop').night(1).day([storytellerNominates('Bob')]).build()
    expect(g.days[0]?.nominations.map((n) => [n.by, n.of])).toEqual([['storyteller', id('Bob')]])
  })
})

describe('reduce and the loose characters', () => {
  test('a loose character joins once and leaves again, taking no seat', () => {
    const b = game().seat('Ann', 'imp').seat('Bob', 'monk')
      .add(addLoose('djinn'), addLoose('lilmonsta'), addLoose('djinn')).build()
    expect(b.g.loose).toEqual(['djinn', 'lilmonsta'])
    expect(b.g.seats).toHaveLength(2)
    const gone = game().seat('Ann', 'imp').add(addLoose('djinn'), removeLoose('djinn'), removeLoose('sentinel')).build()
    expect(gone.g.loose).toEqual([])
  })
})
