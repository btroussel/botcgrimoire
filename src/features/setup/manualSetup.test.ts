import { asCharacterId, character } from '../../content'
import { asEventId, baseCounts, inPlay, reduce } from '../../engine'
import type { Payload } from '../../engine'
import { listed } from '../../store/scriptSheet'
import { dealDraw, fillBag } from './draw'
import { randomBag, shuffled } from './randomBag'
import { dealTarget, looseEvents, openingEvents, scriptLoose, seatedCharacters, showsCopies, trimBag } from './setup'

const ids = ['drunk', 'marionette', 'imp'].map(asCharacterId)
const reduced = (payloads: readonly Payload[]) => reduce('tb', payloads.map((event, i) => ({ ...event, id: asEventId(i), audience: 'storyteller' as const, manual: true })))
test('a chosen bag is shuffled without changing the choices, the Drunk and Marionette under their reminders', () => {
  const opening = openingEvents(['a', 'b', 'c', 'd'])
  const events = dealDraw(reduced(opening), fillBag(ids, listed('tb', 'en'), () => 0)!, () => 0)
  expect(events.flatMap(e => e.kind === 'placeToken' ? [e.token[0]] : []).sort()).toEqual(['drunk', 'marionette'])
  expect(events.flatMap(e => e.kind === 'setCharacter' ? [character(e.to).team] : []).sort()).toEqual(['demon', 'townsfolk', 'townsfolk'])
  expect(inPlay(reduced([...opening, ...events]))).toEqual(expect.arrayContaining([...ids]))
  expect(ids).toEqual(['drunk', 'marionette', 'imp'])
  expect(shuffled(ids, () => 0)).toEqual(['marionette', 'imp', 'drunk'])
})
test('one or twenty players can open empty, without any preparation or role validation', () => {
  for (const count of [1, 20]) {
    const payloads = openingEvents(Array.from({ length: count }, (_, n) => `Player ${n}`))
    const board = reduce('tb', payloads.map((event, i) => ({ ...event, id: asEventId(i), audience: 'storyteller' as const })))
    expect(board.seats).toHaveLength(count)
    expect(board.seats.every(s => s.character === '_empty')).toBe(true)
    expect(fillBag([])).toBeUndefined()
  }
})

test('random selection follows ordinary team counts when no setup modifiers are on the script', () => {
  const roles = listed('tb', 'en').filter(role => role.id !== 'baron')
  for (const count of [5, 7, 10, 15, 20]) {
    const bag = randomBag(roles, count, () => 0)!
    const teamCount = (team: string) => bag.filter(id => roles.find(role => role.id === id)?.team === team).length
    expect(bag).toHaveLength(count)
    expect(new Set(bag).size).toBe(count)
    const expected = baseCounts(Math.min(count, 15))!
    expect({ townsfolk: teamCount('townsfolk'), outsiders: teamCount('outsider'), minions: teamCount('minion'), demon: teamCount('demon') }).toEqual(expected)
    expect(teamCount('traveller')).toBe(Math.max(0, count - 15))
  }
  expect(randomBag(roles, 7, () => 0)).not.toEqual(randomBag(roles, 7, () => 0.99))
})

test('an impossible random setup does not fill missing teams with arbitrary characters', () => {
  const roles = [
    { id: asCharacterId('homebrewdemon'), team: 'demon' as const },
    { id: asCharacterId('homebrewoutsider'), team: 'outsider' as const },
    { id: asCharacterId('chef'), team: 'townsfolk' as const },
    { id: asCharacterId('chef'), team: 'townsfolk' as const },
    { id: asCharacterId('sentinel'), team: 'fabled' as const },
    { id: asCharacterId('homebrewloric'), team: 'loric' as const },
    { id: asCharacterId('thief'), team: 'traveller' as const },
  ]
  expect(randomBag(roles, 7, () => 0)).toBeUndefined()
  expect(randomBag(roles, 1, () => 0)).toHaveLength(1)
  expect(randomBag([], 7)).toBeUndefined()
})

test('Lil Monsta stays loose when counting, trimming and dealing the selected characters', () => {
  const bag = ['chef', 'lilmonsta', 'poisoner', 'baron'].map(asCharacterId)
  expect(seatedCharacters(bag)).toEqual(['chef', 'poisoner', 'baron'])
  expect(trimBag(bag, 2)).toEqual(['chef', 'lilmonsta', 'poisoner'])
  const opening = [...openingEvents(['A', 'B', 'C']), ...looseEvents(bag)]
  const board = reduced([...opening, ...dealDraw(reduced(opening), fillBag(bag, [], () => 0)!, () => 0)])
  expect(board.seats.map(seat => seat.character).sort()).toEqual(['baron', 'chef', 'poisoner'])
  expect(board.loose).toContain('lilmonsta')
  expect(bag).toEqual(['chef', 'lilmonsta', 'poisoner', 'baron'])
})

test('a script\'s Fabled and Loric start selected for the board and never take a seat', () => {
  const script = { kind: 'custom', name: 'Ruled', items: [{ id: '_meta', name: 'Ruled' }, 'chef', 'empath', 'poisoner', 'imp', 'djinn', 'stormcatcher'] } as const
  const roles = listed(script, 'en')
  expect(scriptLoose(roles)).toEqual(['djinn', 'stormcatcher'])
  const bag = ['chef', 'djinn', 'poisoner', 'imp', 'stormcatcher'].map(asCharacterId)
  expect(seatedCharacters(bag)).toEqual(['chef', 'poisoner', 'imp'])
  expect(trimBag(bag, 1)).toEqual(['chef', 'djinn', 'stormcatcher'])
  const opening = [...openingEvents(['A', 'B', 'C']), ...looseEvents([...bag, asCharacterId('djinn')])]
  const board = reduced([...opening, ...dealDraw(reduced(opening), fillBag(bag, roles, () => 0)!, () => 0)])
  expect(board.seats.map(seat => seat.character).sort()).toEqual(['chef', 'imp', 'poisoner'])
  expect(board.loose).toEqual(['djinn', 'stormcatcher'])
  for (const seed of [0, 0.3, 0.7]) expect(randomBag(roles, 4, () => seed)?.some(id => scriptLoose(roles).includes(id))).toBe(false)
})

test('dealing homebrew evil characters respects their declared teams', () => {
  const roles = [
    { id: asCharacterId('customdemon'), team: 'demon' as const },
    { id: asCharacterId('customminion'), team: 'minion' as const },
    { id: asCharacterId('customoutsider'), team: 'outsider' as const },
  ]
  const board = reduced(openingEvents(['a', 'b', 'c']))
  const events = dealDraw(board, { tokens: roles.map(role => ({ character: role.id })) }, () => 0, roles)
  expect(events.map(event => event.kind === 'setCharacter' ? [event.to, event.alignment] : [])).toEqual(expect.arrayContaining([
    ['customminion', 'evil'], ['customoutsider', 'good'], ['customdemon', 'evil'],
  ]))
  expect(events).toHaveLength(3)
})

test('the deal aims each team at the ordinary count for the chosen number of players', () => {
  expect(dealTarget(4)).toEqual({})
  expect(dealTarget(7)).toEqual({ townsfolk: 5, outsider: 0, minion: 1, demon: 1 })
  expect(dealTarget(8)).toEqual({ townsfolk: 5, outsider: 1, minion: 1, demon: 1 })
  expect(dealTarget(15)).toEqual({ townsfolk: 9, outsider: 2, minion: 3, demon: 1 })
  expect(dealTarget(18)).toEqual({ townsfolk: 9, outsider: 2, minion: 3, demon: 1, traveller: 3 })
})

test('a selected Lil\' Monsta gives the Demon\'s seat to an extra Minion', () => {
  const bag = ['lilmonsta', 'witch'].map(asCharacterId)
  expect(dealTarget(7, bag)).toEqual({ townsfolk: 5, outsider: 0, minion: 2, demon: 0 })
  expect(dealTarget(10, bag)).toEqual({ townsfolk: 7, outsider: 0, minion: 3, demon: 0 })
  expect(dealTarget(4, bag)).toEqual({})
})

test('count controls come with the Village Idiot or Legion, and with any other seated repeat', () => {
  const id = asCharacterId
  expect(showsCopies(id('villageidiot'), 1)).toBe(true)
  expect(showsCopies(id('legion'), 1)).toBe(true)
  expect(showsCopies(id('villageidiot'), 0)).toBe(false)
  expect(showsCopies(id('witch'), 1)).toBe(false)
  expect(showsCopies(id('witch'), 2)).toBe(true)
  expect(showsCopies(id('lilmonsta'), 2)).toBe(false)
  expect(showsCopies(id('fibbin'), 1)).toBe(false)
})
