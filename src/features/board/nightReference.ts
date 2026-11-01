// The rows of a night reference: the script's night order, with any recorded character the
// script does not list slotted in at its ordinal, then filtered to what is in play. Recorded
// means on a seat, shown to a seat, marked by a global reminder, held as an ability or loose on
// the board, dead seats included, so a Marionette sitting as the Chef keeps the Marionette's row.
import type { CharacterId, NightMarker } from '../../content'
import { asCharacterId, character, gameText, nightMarkers } from '../../content'
import type { Grimoire, Seat } from '../../engine'
import { markedCharacters } from '../../engine'
import type { SheetNightOrders } from '../../store/scriptSheet'

export interface ReferenceEntry {
  readonly id: string
  readonly label: string
  readonly character: CharacterId | undefined
  readonly marker: NightMarker | undefined
  readonly ordinal: number
  readonly instruction: string
}

// The characters a seat records, as counted above. The reference keeps their rows and names the
// seat on each.
export const seatCharacters = (seat: Seat): readonly CharacterId[] =>
  [seat.character, ...(seat.shown ? [seat.shown] : []), ...markedCharacters(seat), ...seat.abilities.map(ability => ability.of)]

const recordedCharacters = (board: Grimoire): ReadonlySet<CharacterId> => new Set([
  ...board.loose, ...board.storyteller.abilities.map(ability => ability.of), ...board.seats.flatMap(seatCharacters),
])

// Below seven players, Travellers not counted, the Minions and Demon never learn each other and
// the Demon gets no bluffs. An empty seat still counts: it is a player not yet dealt.
export const evilLearnsTeam = (board: Grimoire): boolean =>
  board.seats.filter(seat => character(seat.character).team !== 'traveller').length >= 7

export const nightEntries = (board: Grimoire, night: 'first' | 'other', orders: SheetNightOrders,
  text: ReturnType<typeof gameText>, filter: 'inPlay' | 'all'): readonly ReferenceEntry[] => {
  const recorded = recordedCharacters(board)
  const instructionKey = night === 'first' ? 'firstNight' : 'otherNight'
  const markerOrdinals: Readonly<Partial<Record<NightMarker, number>>> = nightMarkers[night]
  const skipped: ReadonlySet<NightMarker> = new Set(evilLearnsTeam(board) ? [] : ['minionInfo', 'demonInfo'])
  const entries: ReferenceEntry[] = orders[night].filter(item => item.kind === 'character' || !skipped.has(item.marker)).map(item => item.kind === 'character' ? {
    id: item.id, label: item.name, character: asCharacterId(item.id), marker: undefined,
    ordinal: character(asCharacterId(item.id)).ordinals[night] ?? 10000,
    instruction: text.role(asCharacterId(item.id))[instructionKey],
  } : {
    id: item.marker, label: item.label, character: undefined, marker: item.marker,
    ordinal: markerOrdinals[item.marker] ?? 10000, instruction: text.nightMarker(item.marker, night),
  })
  for (const id of recorded) {
    if (entries.some(entry => entry.id === id)) continue
    const ordinal = character(id).ordinals[night]
    if (ordinal !== undefined) entries.push({ id, label: text.role(id).name, character: id, marker: undefined, ordinal,
      instruction: text.role(id)[instructionKey] })
  }
  entries.sort((a, b) => a.ordinal - b.ordinal)
  return filter === 'all' ? entries : entries.filter(entry => !entry.character || recorded.has(entry.character))
}
