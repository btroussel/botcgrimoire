import { asCharacterId, character } from '../../content'
import type { CharacterId, Team } from '../../content'
import { baseCounts } from '../../engine'
import { listed } from '../../store/scriptSheet'
import { randomBag } from './randomBag'
import type { BagRole } from './randomBag'
import { seatedCharacters } from './setup'

const roles = (...ids: string[]) => ids.map(id => character(asCharacterId(id)))
const townsfolk = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor']
const outsiders = ['butler', 'drunk', 'recluse', 'saint']
const countTeam = (bag: readonly CharacterId[], team: Team) => bag.filter(id => character(id).team === team).length
const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

test('a seven-player Baron bag replaces two Townsfolk with Outsiders', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'baron', 'imp'), 7, () => 0)!
  expect(bag).toHaveLength(7)
  expect(bag).toContain('baron')
  expect(countTeam(bag, 'townsfolk')).toBe(3)
  expect(countTeam(bag, 'outsider')).toBe(2)
})

test('a Huntsman bag includes the Damsel even at a base count of zero Outsiders', () => {
  const bag = randomBag(roles('huntsman', 'chef', 'empath', 'damsel', 'poisoner', 'imp'), 5, () => 0)!
  expect(bag).toHaveLength(5)
  expect(bag).toContain('huntsman')
  expect(bag).toContain('damsel')
})

test.each([['fanggu', 7, 1], ['vigormortis', 8, 0], ['vigormortis', 7, 0]] as const)(
  '%s adjusts Outsiders for %i players', (demon, players, expected) => {
    const bag = randomBag(roles(...townsfolk, ...outsiders, 'poisoner', demon), players, () => 0)!
    expect(bag).toHaveLength(players)
    expect(countTeam(bag, 'outsider')).toBe(expected)
    expect(countTeam(bag, 'demon')).toBe(1)
  },
)

test('Baron and Vigormortis apply their combined adjustment before filling good characters', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'baron', 'vigormortis'), 7, () => 0)!
  expect(bag).toHaveLength(7)
  expect(countTeam(bag, 'outsider')).toBe(1)
})

test('Godfather can add or remove one Outsider but cannot choose an unchanged count', () => {
  const counts = new Set<number>()
  for (let seed = 0; seed < 30; seed++) {
    const bag = randomBag(roles(...townsfolk, ...outsiders, 'godfather', 'imp'), 8, rng(seed))!
    expect(bag).toHaveLength(8)
    counts.add(countTeam(bag, 'outsider'))
  }
  expect([...counts].sort()).toEqual([0, 2])
})

test('Godfather adds an Outsider when the base count is zero', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'godfather', 'imp'), 7, () => 0)!
  expect(countTeam(bag, 'outsider')).toBe(1)
})

test('Balloonist can leave the Outsider count unchanged or add one', () => {
  const counts = new Set<number>()
  const pool = roles('balloonist', 'chef', 'empath', 'butler', 'poisoner', 'imp')
  for (let seed = 0; seed < 50; seed++) {
    const bag = randomBag(pool, 5, rng(seed))!
    expect(bag).toContain('balloonist')
    counts.add(countTeam(bag, 'outsider'))
  }
  expect([...counts].sort()).toEqual([0, 1])
})

test('Huntsman can use an existing Damsel slot without adding a second one', () => {
  const bag = randomBag(roles('huntsman', 'chef', 'empath', 'damsel', 'poisoner', 'imp'), 6, () => 0)!
  expect(bag).toHaveLength(6)
  expect(bag.filter(id => id === 'damsel')).toHaveLength(1)
  expect(countTeam(bag, 'outsider')).toBe(1)
})

test('Choirboy keeps the King and the normal Townsfolk count', () => {
  const bag = randomBag(roles('choirboy', 'king', 'chef', 'poisoner', 'imp'), 5, () => 0)!
  expect(bag).toHaveLength(5)
  expect(bag).toEqual(expect.arrayContaining(['choirboy', 'king']))
  expect(countTeam(bag, 'townsfolk')).toBe(3)
})

test.each(['huntsman', 'choirboy'])('a missing companion does not let %s silently enter the bag', source => {
  expect(randomBag(roles(source, 'chef', 'empath', 'poisoner', 'imp'), 5, () => 0)).toBeUndefined()
  const bag = randomBag(roles(source, ...townsfolk, 'poisoner', 'imp'), 5, () => 0)!
  expect(bag).toHaveLength(5)
  expect(bag).not.toContain(source)
})

test('optional modifiers are not counted when the character was left out', () => {
  const pool = roles(...townsfolk, ...outsiders, 'balloonist', 'hermit', 'poisoner', 'imp')
  for (let seed = 0; seed < 100; seed++) {
    const bag = randomBag(pool, 8, rng(seed))!
    const possible = [1, ...(bag.includes(asCharacterId('balloonist')) ? [2] : [])]
    if (bag.includes(asCharacterId('hermit'))) possible.push(...possible.map(n => n - 1))
    expect(possible).toContain(countTeam(bag, 'outsider'))
  }
})

test('Hermit can keep or reduce the Outsider count while remaining in play', () => {
  const counts = new Set<number>()
  for (let seed = 0; seed < 100; seed++) {
    const bag = randomBag(roles(...townsfolk, 'hermit', 'butler', 'poisoner', 'imp'), 9, rng(seed))!
    expect(bag).toHaveLength(9)
    if (bag.includes(asCharacterId('hermit'))) counts.add(countTeam(bag, 'outsider'))
  }
  expect([...counts].sort()).toEqual([1, 2])
})

test('Xaan overrides the Baron Outsider adjustment', () => {
  const pool = roles(...townsfolk, 'butler', 'xaan', 'baron', 'imp')
  const counts = new Set<number>()
  for (let seed = 0; seed < 30; seed++) {
    const bag = randomBag(pool, 10, rng(seed))!
    expect(bag).toHaveLength(10)
    expect(bag).toEqual(expect.arrayContaining(['xaan', 'baron']))
    counts.add(countTeam(bag, 'outsider'))
  }
  expect([...counts].sort()).toEqual([0, 1])
})

test('Summoner replaces the starting Demon with a good character', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'summoner'), 7, () => 0)!
  expect(bag).toHaveLength(7)
  expect(countTeam(bag, 'demon')).toBe(0)
  expect(countTeam(bag, 'minion')).toBe(1)
  expect(countTeam(bag, 'townsfolk')).toBe(6)
})

test('an Atheist bag contains only good characters', () => {
  const pool = roles('atheist', ...townsfolk.slice(0, 5), 'butler', 'imp', 'baron')
  const seen = new Set<string>()
  for (let seed = 0; seed < 50; seed++) {
    const bag = randomBag(pool, 7, rng(seed))!
    expect(bag).toHaveLength(7)
    expect(bag).toContain('atheist')
    expect(bag.every(id => ['townsfolk', 'outsider'].includes(character(id).team))).toBe(true)
    bag.forEach(id => seen.add(id))
  }
  expect(seen).toContain('butler')
})

test.each([5, 7, 10, 15])('Legion repeats the Demon and replaces Minions at %i players', players => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'legion', 'poisoner'), players, () => 0)!
  expect(bag).toHaveLength(players)
  expect(countTeam(bag, 'minion')).toBe(0)
  expect(bag.filter(id => id === 'legion')).toHaveLength(players - baseCounts(players)!.minions - 1)
  const good = bag.filter(id => id !== 'legion')
  expect(new Set(good).size).toBe(good.length)
})

test('Lil Monsta adds a Minion and a loose token without taking a player seat', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'lilmonsta', 'poisoner', 'baron'), 7, () => 0)!
  expect(bag).toContain('lilmonsta')
  expect(seatedCharacters(bag)).toHaveLength(7)
  expect(countTeam(bag, 'minion')).toBe(2)
  expect(countTeam(bag, 'outsider')).toBe(2)
  expect(randomBag(roles(...townsfolk, 'lilmonsta'), 7, () => 0)).toBeUndefined()
})

test('a script with too few Minions repeats them, so Lil\' Monsta gets its two Witches', () => {
  const hunt = randomBag(roles(...townsfolk, 'lilmonsta', 'witch'), 7, () => 0)!
  expect(seatedCharacters(hunt)).toHaveLength(7)
  expect(hunt.filter(id => id === 'witch')).toHaveLength(2)
  const large = randomBag(roles(...townsfolk, ...outsiders, 'witch', 'poisoner', 'imp'), 15, () => 0)!
  expect(countTeam(large, 'minion')).toBe(3)
  expect(new Set(large.filter(id => character(id).team === 'minion'))).toEqual(new Set(['witch', 'poisoner']))
})

test('Kazali starts with good players until the Demon chooses its Minions', () => {
  const bag = randomBag(roles(...townsfolk, ...outsiders, 'kazali', 'baron'), 7, () => 0)!
  expect(bag).toHaveLength(7)
  expect(countTeam(bag, 'minion')).toBe(0)
  expect(countTeam(bag, 'demon')).toBe(1)
})

test('Lord of Typhon adds a Minion and permits a variable Outsider count', () => {
  const counts = new Set<number>()
  for (let seed = 0; seed < 30; seed++) {
    const bag = randomBag(roles(...townsfolk, ...outsiders, 'lordoftyphon', 'poisoner', 'baron'), 7, rng(seed))!
    expect(bag).toHaveLength(7)
    expect(countTeam(bag, 'minion')).toBe(2)
    counts.add(countTeam(bag, 'outsider'))
  }
  expect(counts.size).toBeGreaterThan(1)
})

test('a setup modifier is in the bag as often as the Townsfolk it replaces on the script', () => {
  const tb = listed('tb', 'en')
  const pool = tb.map(role => role.id === 'chef' ? character(asCharacterId('balloonist'))
    : role.id === 'mayor' ? character(asCharacterId('villageidiot')) : role)
  const random = rng(1)
  const shares = (roles: readonly BagRole[], players: number) => {
    const seen = new Map<string, number>()
    for (let i = 0; i < 2000; i++) new Set(randomBag(roles, players, random)).forEach(id => seen.set(id, (seen.get(id) ?? 0) + 1 / 2000))
    return seen
  }
  for (const players of [5, 9, 15]) {
    const before = shares(tb, players), after = shares(pool, players)
    expect(Math.abs(after.get('balloonist')! - before.get('chef')!)).toBeLessThan(0.05)
    expect(Math.abs(after.get('villageidiot')! - before.get('mayor')!)).toBeLessThan(0.05)
  }
})

test('a duplicate script entry cannot fill a missing Townsfolk slot', () => {
  expect(randomBag(roles('chef', 'chef', 'empath', 'poisoner', 'imp'), 5, () => 0)).toBeUndefined()
})

test('Village Idiot can fill up to three Townsfolk slots without duplicating other characters', () => {
  const bag = randomBag(roles('villageidiot', 'poisoner', 'imp'), 5, () => 0)!
  expect(bag).toHaveLength(5)
  expect(bag.filter(id => id === 'villageidiot')).toHaveLength(3)
  expect(randomBag(roles('villageidiot', 'poisoner', 'imp'), 7, () => 0)).toBeUndefined()
})

test('Village Idiot shuffles can select one, two or three copies', () => {
  const copies = new Set<number>()
  for (let seed = 0; seed < 100; seed++) {
    const bag = randomBag(roles('villageidiot', 'chef', 'empath', 'poisoner', 'imp'), 5, rng(seed))!
    expect(bag).toHaveLength(5)
    copies.add(bag.filter(id => id === 'villageidiot').length)
  }
  expect([...copies].sort()).toEqual([1, 2, 3])
})

test('a shortage of Travellers does not add extra primary roles beyond fifteen', () => {
  expect(randomBag(listed('tb', 'en').filter(role => role.team !== 'traveller'), 16, () => 0)).toBeUndefined()
})

test('a tight script finds the feasible Godfather direction without depending on random retries', () => {
  const bag = randomBag(roles(...townsfolk.slice(0, 6), 'godfather', 'imp'), 8, () => 0)!
  expect(bag).toHaveLength(8)
  expect(countTeam(bag, 'outsider')).toBe(0)
})

test.each(['tb', 'bmr', 'snv'] as const)('%s shuffles respect setup counts across all supported table sizes', script => {
  const pool = listed(script, 'en')
  for (let count = 5; count <= 20; count++) {
    for (let seed = 0; seed < 25; seed++) {
      const bag = randomBag(pool, count, rng(seed))!
      expect(bag).toHaveLength(count)
      expect(new Set(bag).size).toBe(count)
      const has = (id: string) => bag.includes(asCharacterId(id))
      const base = baseCounts(Math.min(count, 15))!
      expect(countTeam(bag, 'minion')).toBe(base.minions)
      expect(countTeam(bag, 'demon')).toBe(1)
      expect(countTeam(bag, 'traveller')).toBe(Math.max(0, count - 15))
      const adjustment = (has('baron') ? 2 : 0) + (has('fanggu') ? 1 : 0) - (has('vigormortis') ? 1 : 0)
      const expected = base.outsiders + adjustment
      const possible = has('godfather') ? [expected - 1, expected + 1].filter(n => n >= 0) : [Math.max(0, expected)]
      expect(possible).toContain(countTeam(bag, 'outsider'))
      expect(countTeam(bag, 'townsfolk')).toBe(Math.min(count, 15) - base.minions - 1 - countTeam(bag, 'outsider'))
    }
  }
})

test('selection rules do not depend on translated ability text', () => {
  for (const script of ['tb', 'bmr', 'snv'] as const) {
    expect(randomBag(listed(script, 'fr'), 10, rng(17))).toEqual(randomBag(listed(script, 'en'), 10, rng(17)))
  }
})
