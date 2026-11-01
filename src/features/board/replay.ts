import type { CharacterId, Locale, Script } from '../../content'
import { character } from '../../content'
import type { Event, SeatId } from '../../engine'
import { apply, emptyGrimoire } from '../../engine'
import { setupStart } from '../../store/replay'
import { boardView } from './board'

// Compare what the board draws, excluding event identities and the elapsed clock. One pass over
// the log: the bluffs are followed as the events go by, the way bluffsOf reads them back, rather
// than by rescanning every prefix.
export const replayStops = (log: readonly Event[], script: Script, locale: Locale): readonly number[] => {
  const start = setupStart(log)
  const stops = [start]
  let board = emptyGrimoire(script)
  let previous = ''
  let chosen: readonly CharacterId[] | undefined
  // Older games saved the selection as a showing to the Demon.
  const shown = new Map<SeatId, readonly CharacterId[]>()
  for (const [index, event] of log.entries()) {
    board = apply(board, event)
    if (event.kind === 'setBluffs') chosen = event.characters
    else if (event.kind === 'info' && event.to.length === 1 && event.told.kind === 'characters') shown.set(event.to[0]!, event.told.characters)
    const demon = board.seats.find(seat => character(seat.character).team === 'demon')
    const view = boardView(board, [], locale, chosen ?? (demon ? shown.get(demon.id) : undefined) ?? [])
    const signature = JSON.stringify({
      phase: board.clock.phase, night: board.clock.night,
      seats: view.seats.map(seat => ({
        id: seat.id, name: seat.name, character: seat.character, alignment: seat.alignment,
        dead: seat.dead, ghostVote: seat.dead && seat.ghostVote,
        chips: seat.chips.map(chip => ({ label: chip.label, character: chip.character, alignment: chip.alignment })),
      })),
      bluffs: view.bluffs, loose: view.loose,
      grants: view.grants.map(grant => ({ character: grant.character, from: grant.from })),
    })
    if (index + 1 > start && (signature !== previous || event.kind === 'phase')) stops.push(index + 1)
    previous = signature
  }
  return stops
}
