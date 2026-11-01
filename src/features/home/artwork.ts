import { characters } from '../../content'
import type { CharacterId } from '../../content'

const demons = [...characters.values()].filter(c => c.team === 'demon').map(c => c.id)
const others = [...characters.values()].filter(c => c.team !== 'demon' && c.team !== 'fabled' && c.team !== 'loric').map(c => c.id)

// One Demon on the right, with two different player characters. Fabled and Loric are not seats.
export const randomHomeCharacters = (random: () => number = Math.random): readonly [CharacterId, CharacterId, CharacterId] => {
  const demon = demons[Math.floor(random() * demons.length)]!
  const first = Math.floor(random() * others.length)
  const second = Math.floor(random() * (others.length - 1))
  return [others[first]!, demon, others[second >= first ? second + 1 : second]!]
}
