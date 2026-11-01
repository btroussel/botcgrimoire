import { character, characters } from '../../content'
import { randomHomeCharacters } from './artwork'

test('always draws one Demon and two distinct non-Demons, including random boundaries', () => {
  for (const value of [0, 0.25, 0.5, 0.75, 0.999999]) {
    const roles = randomHomeCharacters(() => value)
    expect(new Set(roles).size).toBe(3)
    expect(roles.every(id => characters.has(id))).toBe(true)
    expect(character(roles[1]).team).toBe('demon')
    expect(roles.filter(id => character(id).team === 'demon')).toHaveLength(1)
    expect(roles.some(id => ['fabled', 'loric'].includes(character(id).team))).toBe(false)
  }
})

test('the draw reaches every player character and never includes Fabled or Loric', () => {
  const seen = new Set<string>()
  // Each catalogue bucket is crossed at least once, including the last entry.
  for (let step = 0; step < characters.size * 2; step++) {
    randomHomeCharacters(() => step / (characters.size * 2)).forEach(id => seen.add(id))
  }
  const eligible = [...characters.values()].filter(c => c.team !== 'fabled' && c.team !== 'loric').map(c => c.id)
  expect([...seen].sort()).toEqual(eligible.sort())
})
