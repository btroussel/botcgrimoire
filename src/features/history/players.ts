import type { Alignment, Team } from '../../content'
import { character } from '../../content'
import type { Grimoire } from '../../engine'

export const playersOn = (seats: Grimoire['seats'], alignment: Alignment) => {
  const order: readonly Team[] = alignment === 'good'
    ? ['townsfolk', 'outsider', 'traveller', 'demon', 'minion', 'fabled', 'loric']
    : ['demon', 'minion', 'traveller', 'townsfolk', 'outsider', 'fabled', 'loric']
  // Alignment can differ from the character's team. Keep flipped players on their actual side.
  return order.flatMap((team) => seats.filter((seat) => seat.alignment === alignment && character(seat.character).team === team))
}
