import type { Locale } from '../../content'
import { gameText } from '../../content'
import type { Grimoire, Payload, SeatId } from '../../engine'
import { playerIdentity } from '../../engine'

export const canDiscover = (g: Grimoire): boolean =>
  g.clock.phase === 'setup' && g.seats.length > 0 && g.seats.every(seat => playerIdentity(g, seat.id) !== undefined)

// Only display values leave this projection, never the seat's actual role or reminders.
export const discoveryPlayer = (g: Grimoire, cursor: string, locale: Locale) => {
  const index = g.seats.findIndex(seat => seat.id === cursor)
  const seat = g.seats[index]
  if (!seat) return undefined
  const identity = playerIdentity(g, seat.id)
  if (!identity) return undefined
  const role = gameText(locale).role(identity.character)
  return {
    id: seat.id,
    name: seat.name,
    number: index + 1,
    total: g.seats.length,
    next: g.seats[index + 1]?.id,
    character: identity.character,
    alignment: identity.alignment,
    roleName: role.name,
    ability: role.ability,
  }
}

export type DiscoveryPlayer = NonNullable<ReturnType<typeof discoveryPlayer>>

export const discoveryName = (seat: SeatId, previous: string, draft: string): Payload | undefined => {
  const name = draft.trim()
  return name && name !== previous ? { kind: 'renameSeat', seat, name } : undefined
}
