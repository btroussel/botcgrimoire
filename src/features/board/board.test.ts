import { addLoose, game, grant, info, kill, token } from '../../engine/testing/board'
import { asEventId, isNote } from '../../engine'
import { boardView, looseChoices, sameSeat } from './board'

const table = () =>
  game()
    .seat('Ann', 'imp')
    .seat('Bob', 'poisoner')
    .seat('Cat', 'drunk', { shown: 'empath' })
    .seat('Dan', 'chef')
    .seat('Eve', 'monk')

describe('the board view', () => {
  test('the day vote leader gets a marker without being marked dead', () => {
    const { g, log, id } = table().night(1).day().add(
      seat => ({ kind: 'nominate', by: seat('Ann'), of: seat('Bob') }),
      (_seat, ctx) => ({ kind: 'setVoteTotal', nomination: asEventId(ctx.log.length - 1), total: 3 }),
    ).build()
    const view = boardView(g, log, 'en')
    expect(view.seats.filter(seat => seat.onBlock).map(seat => seat.id)).toEqual([id('Bob')])
    expect(view.seats.find(seat => seat.id === id('Bob'))?.dead).toBe(false)
    expect(boardView({ ...g, clock: { ...g.clock, phase: 'night' } }, log, 'en').seats.some(seat => seat.onBlock)).toBe(false)
  })
  test('the view keeps notes and reminders without touching the saved board', () => {
    const { g, log, id } = table().night(1, [
      token('storyteller', 'note/', 'Cat', 'Private note'),
      token('storyteller', '/', 'Dan', 'Legacy private note'),
      token('Bob', 'poisoner/Poisoned', 'Cat', 'Reminder metadata'),
      info('Ann', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] }),
      grant('storyteller', 'boffin', 'storyteller'),
      kill('Dan'),
    ]).build()
    const saved = JSON.stringify(g)
    const original = boardView(g, log, 'en')
    expect(original.seats.find((s) => s.id === id('Cat'))?.chips).toHaveLength(3)
    expect(original.seats.find((s) => s.id === id('Dan'))?.chips).toEqual([expect.objectContaining({ label: 'Legacy private note' })])
    expect(JSON.stringify(g)).toBe(saved)
  })

  test('a seat carries its token, states and localized names', () => {
    const { g, log, id } = table().night(1, [kill('Dan')]).build()
    const view = boardView(g, log, 'en')
    const dan = view.seats.find((s) => s.id === id('Dan'))
    expect(dan).toMatchObject({ name: 'Dan', character: 'chef', characterName: 'Chef', alignment: 'good', dead: true, ghostVote: true })
    expect(view.seats.find((s) => s.id === id('Bob'))?.alignment).toBe('evil')
    expect(boardView(g, log, 'fr').seats.find((s) => s.id === id('Bob'))?.characterName).not.toBe('')
  })

  test('the selected character stays primary and a manually shown token is a separate chip', () => {
    const { g, log, id } = table().night(1, [token('Cat', 'drunk/Is The Drunk', 'Cat')]).build()
    const cat = boardView(g, log, 'en').seats.find(s => s.id === id('Cat'))
    expect(cat?.character).toBe('drunk')
    expect(cat?.chips).toEqual([
      expect.objectContaining({ character: 'empath', label: 'Empath' }),
      expect.objectContaining({ character: 'drunk', label: 'Is The Drunk' }),
    ])
  })

  test('a reminder chip carries its source art in the placing seat\'s tint, a note carries its text alone', () => {
    const { g, log, id } = table()
      .night(1, [token('Bob', 'poisoner/Poisoned', 'Dan'), token('storyteller', 'note/', 'Dan', 'Claimed Chef')])
      .build()
    const dan = boardView(g, log, 'en').seats.find((s) => s.id === id('Dan'))
    expect(dan?.chips).toHaveLength(2)
    expect(dan?.chips[0]).toMatchObject({ label: 'Poisoned', character: 'poisoner', alignment: 'evil' })
    expect(dan?.chips[1]).toMatchObject({ label: 'Claimed Chef' })
    expect(dan?.chips[1]?.character).toBeUndefined()
  })

  test('a grant names its source seat, or the Storyteller', () => {
    const { g, log } = table().night(1, [grant('storyteller', 'plague_doctor_st', 'Dan'), grant('storyteller', 'boffin', 'storyteller')]).build()
    const view = boardView(g, log, 'en')
    expect(view.grants.map((x) => x.from)).toEqual(['Dan', undefined])
    expect(view.grants[0]?.character).toBe('plague_doctor_st')
  })

  test('a seat named "self" that grants an ability reads as that seat, not the Storyteller', () => {
    const { g, log } = game().seat('Ann', 'imp').night(1, [grant('storyteller', 'boffin', 'Ann'), (id) => ({ kind: 'renameSeat', seat: id('Ann'), name: 'self' })]).build()
    expect(boardView(g, log, 'en').grants.map((x) => x.from)).toEqual(['self'])
  })


  test('a seat waiting for its character draws as empty', () => {
    const { g, log } = game().seat('Ann', '_empty').build()
    expect(boardView(g, log, 'en').seats[0]).toMatchObject({ character: '', characterName: '' })
  })

  test('a note is a token with no character behind it', () => {
    expect(isNote(['note', ''], 'x')).toBe(true)
    expect(isNote(['', ''], 'x')).toBe(true)
    expect(isNote(['poisoner', 'Poisoned'], 'x')).toBe(false)
    expect(isNote(['note', ''], undefined)).toBe(false)
  })
})

describe('the loose characters a script offers', () => {
  test('an edition offers every bundled Fabled and Loric, and a script with Lil\' Monsta offers it too', () => {
    expect(looseChoices('tb')).toContain('angel')
    expect(looseChoices({ kind: 'custom', name: 'Mine', items: ['imp', 'djinn', 'lilmonsta', 'gardener', 'chef'] }))
      .toEqual(expect.arrayContaining(['djinn', 'lilmonsta', 'gardener']))
  })

  test('the board draws whatever the log put among them', () => {
    const { g, log } = table().add(addLoose('djinn')).build()
    expect(boardView(g, log, 'en').loose).toEqual(['djinn'])
  })
})

describe('comparing seat views', () => {
  test('a rebuilt view of an untouched seat draws the same, and any drawn change does not', () => {
    const { g, log, id } = table().night(1, [token('Bob', 'poisoner/Poisoned', 'Cat', 'Reminder metadata')]).build()
    const cat = (view: ReturnType<typeof boardView>) => view.seats.find(seat => seat.id === id('Cat'))!
    const seat = cat(boardView(g, log, 'en'))
    const again = cat(boardView(g, log, 'en'))
    expect(again).not.toBe(seat)
    expect(sameSeat(seat, again)).toBe(true)
    const chip = seat.chips[1]!
    for (const changed of [
      { ...seat, name: 'Cathy' }, { ...seat, dead: true }, { ...seat, ghostVote: !seat.ghostVote }, { ...seat, onBlock: true },
      { ...seat, alignment: 'evil' as const }, { ...seat, chips: seat.chips.slice(0, 1) },
      { ...seat, chips: [seat.chips[0]!, { ...chip, label: 'Drunk' }] },
      { ...seat, chips: [seat.chips[0]!, { ...chip, placedBy: asEventId(99) }] },
    ]) expect(sameSeat(seat, changed)).toBe(false)
  })
})
