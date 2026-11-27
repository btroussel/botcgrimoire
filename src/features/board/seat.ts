// Manual board edits and localized picker rows.
import type { Alignment, CharacterId, Locale, Script, Team } from '../../content'
import { character, characters, gameText, isCustom, scriptCharacters, teams } from '../../content'
import type { Event, EventId, Grimoire, Payload, Place, SeatId } from '../../engine'
import { inPlay, isNote, mintSeatId, noteToken } from '../../engine'
import { unknownIds } from '../../store/scriptSheet'

// Whether putting the seat at `from` into the gap before `gap` changes anyone's neighbours. The
// gaps on either side of a seat leave the ring as it was; on a ring of two, every gap does.
export const insertionMoves = (count: number, from: number, gap: number): boolean =>
  Number.isInteger(gap) && gap >= 0 && gap <= count && count > 2 && gap !== from && gap !== from + 1
  && !(from === 0 && gap === count) && !(from === count - 1 && gap === 0)

// Every character the table may name: the script's bag and its Travellers (docs/app.md,
// Board edits: characters off the script are not offered). A custom script lists its Travellers
// among its items; an edition's are the ones upstream files under it. An id this build does not
// know has no name or ability to offer, so it waits for the update that bundles it.
export const roster = (script: Script): readonly CharacterId[] => {
  const unknown = new Set(unknownIds(script))
  const bag = scriptCharacters(script).filter((id) => !unknown.has(id))
  if (isCustom(script)) return bag
  const travellers = [...characters.values()].filter((c) => c.edition === script && c.team === 'traveller').map((c) => c.id)
  return [...bag, ...travellers]
}

export interface CharacterGroup {
  readonly team: Team
  readonly ids: readonly CharacterId[]
}

export const byTeam = (ids: readonly CharacterId[]): readonly CharacterGroup[] =>
  teams
    .map((team) => ({ team, ids: ids.filter((id) => character(id).team === team) }))
    .filter((g) => g.ids.length > 0)

// The roster by team in the sheet's fixed order.
export const characterGroups = (script: Script): readonly CharacterGroup[] => byTeam(roster(script))

// Reminders from characters in play come first, wherever the token will be placed.
export interface ReminderEntry {
  readonly key: string
  readonly character: CharacterId
  readonly characterName: string
  readonly reminder: string
  readonly label: string
}

export interface ReminderGroup {
  readonly key: string
  readonly entries: readonly ReminderEntry[]
}

const entriesOf = (id: CharacterId, text: ReturnType<typeof gameText>): readonly ReminderEntry[] =>
  character(id).reminders.map((r) => ({
    key: `${id}/${r.name}`,
    character: id,
    characterName: text.role(id).name,
    reminder: r.name,
    label: text.reminder(r.name),
  }))

export const reminderGroups = (g: Grimoire, locale: Locale): readonly ReminderGroup[] => {
  const text = gameText(locale)
  const playing = new Set(inPlay(g))
  const all = [...new Set([...characterGroups(g.script).flatMap((group) => group.ids), ...g.loose])]
  return (['inPlay', 'notInPlay'] as const)
    .map((kind): ReminderGroup => ({
      key: kind,
      entries: all.filter((id) => playing.has(id) === (kind === 'inPlay')).flatMap((id) => entriesOf(id, text)),
    }))
    .filter((group) => group.entries.length > 0)
}

// Every note written this game, newest first and each text once, so the picker can place one
// again. A rewritten note offers only its new text; a removed one is still offered.
export const writtenNotes = (log: readonly Event[]): readonly string[] => {
  const latest = new Map<EventId, string>()
  for (const e of log) {
    if (e.kind === 'placeToken' && isNote(e.token, e.note) && e.note?.trim()) latest.set(e.id, e.note.trim())
    if (e.kind === 'setNote' && latest.has(e.placedBy) && e.note.trim()) {
      latest.delete(e.placedBy)
      latest.set(e.placedBy, e.note.trim())
    }
  }
  return [...new Set([...latest.values()].reverse())]
}

// The script's Townsfolk and Outsiders, split by whether a character is recorded, dead seats and
// ability annotations included.
const goodByPlay = (g: Grimoire, recorded: boolean): readonly CharacterId[] => {
  const playing = new Set(inPlay(g))
  const customTeams = new Map(isCustom(g.script) ? g.script.items.flatMap(item =>
    typeof item !== 'string' && 'team' in item ? [[item.id, item.team] as const] : []) : [])
  return roster(g.script).filter(id => {
    const team = customTeams.get(id) ?? character(id).team
    return (team === 'townsfolk' || team === 'outsider') && playing.has(id) === recorded
  })
}

// The bluff catalogue excludes recorded characters.
export const bluffChoices = (g: Grimoire): readonly CharacterId[] => goodByPlay(g, false)

// Where a seat's token stands in the window, so a drawer that changes the seat can leave it in view.
export const seatSpan = (seat: string): { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number } | undefined => {
  const token = document.querySelector(`[data-seat-context-target="${seat}"] [role="button"]`)?.getBoundingClientRect()
  return token ? { top: token.top, bottom: token.bottom, left: token.left, right: token.right } : undefined
}

// The night sheet shows the Lunatic "3 good character tokens", not the Demon's not-in-play ones, so
// the card offers these too.
export const goodInPlay = (g: Grimoire): readonly CharacterId[] => goodByPlay(g, true)

const placeNote = (text: string, seat: SeatId): Payload => ({ kind: 'placeToken', token: noteToken, note: text, seat })

// Each saved edit can be undone independently.
export const edits = {
  setCharacter: (seat: SeatId, to: CharacterId): Payload => ({ kind: 'setCharacter', seat, to }),
  setGhostVote: (seat: SeatId, available: boolean): Payload => ({ kind: 'setGhostVote', seat, available }),
  setAlignment: (seat: SeatId, to: Alignment): Payload => ({ kind: 'setAlignment', seat, to }),
  // A death the Storyteller records by hand has no cause the engine could name.
  kill: (seat: SeatId): Payload => ({ kind: 'kill', seat, cause: 'storyteller' }),
  revive: (seat: SeatId): Payload => ({ kind: 'revive', seat }),
  removeToken: (placedBy: EventId): Payload => ({ kind: 'removeToken', placedBy }),
  // A reminder dragged to another seat comes off and goes on again as one action, so one undo
  // puts it back where it was. The copy keeps the source's tint and a note's text.
  moveToken: (g: Grimoire, placedBy: EventId, to: SeatId): readonly Payload[] => {
    const from = g.seats.find((s) => s.tokens.some((t) => t.placedBy === placedBy))
    const token = from?.tokens.find((t) => t.placedBy === placedBy)
    if (!from || !token || from.id === to || !g.seats.some((s) => s.id === to)) return []
    return [{ kind: 'removeToken', placedBy }, {
      kind: 'placeToken',
      seat: to,
      token: token.def,
      ...(token.source !== undefined ? { source: token.source } : {}),
      ...(token.note !== undefined ? { note: token.note } : {}),
    }]
  },
  setNote: (placedBy: EventId, text: string): Payload => ({ kind: 'setNote', placedBy, note: text.trim() }),
  placeReminder: (entry: { readonly character: CharacterId; readonly reminder: string }, seat: SeatId): Payload => ({
    kind: 'placeToken',
    token: [entry.character, entry.reminder],
    seat,
  }),
  placeNote,
  removeSeat: (seat: SeatId): Payload => ({ kind: 'removeSeat', seat }),
  renameSeat: (seat: SeatId, name: string): Payload => ({ kind: 'renameSeat', seat, name: name.trim() }),
  addSeat: (name: string, at: number, characterId: CharacterId, alignment: Alignment): Payload => ({
    kind: 'addSeat',
    seat: mintSeatId(),
    name,
    at,
    character: characterId,
    alignment,
  }),
  // Turning the ring one place moves the seat at one end to the other, so every player keeps
  // their neighbours and only who sits at the top changes. Seat 0 is at the top, running clockwise.
  turnSeats: (seats: readonly SeatId[], direction: 'clockwise' | 'counterclockwise'): Payload | undefined => {
    if (seats.length < 2) return undefined
    return direction === 'clockwise'
      ? { kind: 'moveSeat', seat: seats[seats.length - 1]!, to: 0 }
      : { kind: 'moveSeat', seat: seats[0]!, to: seats.length - 1 }
  },
  // Two seats trade places and everyone else stays put. It is two moves recorded as one action,
  // so one undo puts both back.
  swapSeats: (seats: readonly SeatId[], a: SeatId, b: SeatId): readonly Payload[] => {
    const i = seats.indexOf(a)
    const j = seats.indexOf(b)
    if (i < 0 || j < 0 || i === j) return []
    const [first, second] = i < j ? [a, b] : [b, a]
    return [{ kind: 'moveSeat', seat: first, to: Math.max(i, j) }, { kind: 'moveSeat', seat: second, to: Math.min(i, j) }]
  },
  // A seat lifted into the gap before `gap` (0 to the seat count, the last gap being the one
  // between the last seat and the first). The seats between shift one place to close the hole.
  // A gap beside the seat moves nothing, and the seat at the top stays there.
  insertSeat: (seats: readonly SeatId[], seat: SeatId, gap: number): Payload | undefined => {
    const i = seats.indexOf(seat)
    if (i < 0 || !insertionMoves(seats.length, i, gap)) return undefined
    return { kind: 'moveSeat', seat, to: i < gap ? gap - 1 : gap }
  },
  // Selection belongs to the board; showing these characters is a separate information event.
  setBluffs: (bluffs: readonly CharacterId[]): Payload => ({ kind: 'setBluffs', characters: bluffs }),
  // A token laid where its player sits, or back on the circle without a place.
  placeSeat: (seat: SeatId, at?: Place): Payload => ({ kind: 'placeSeat', seat, ...(at ? { at } : {}) }),
  // Once tokens are laid out as the room, swapping or turning the seats moves players between
  // its spots, as it moves them between places on the circle: each spot stays where it is and
  // takes the seat that now holds its place in the order. A board on the circle needs nothing.
  keepSpots: (g: Grimoire, moves: readonly Payload[]): readonly Payload[] => {
    if (!g.seats.some(seat => seat.place)) return moves
    const ids = g.seats.map(seat => seat.id)
    for (const move of moves) {
      if (move.kind !== 'moveSeat') continue
      const from = ids.indexOf(move.seat)
      if (from < 0) continue
      ids.splice(from, 1)
      ids.splice(Math.max(0, Math.min(move.to, ids.length)), 0, move.seat)
    }
    const spots = ids.flatMap((id, i) => {
      const spot = g.seats[i]!.place
      const held = g.seats.find(seat => seat.id === id)?.place
      return spot === held ? [] : [{ kind: 'placeSeat', seat: id, ...(spot ? { at: spot } : {}) } as Payload]
    })
    return [...moves, ...spots]
  },
  // Every laid-out token back on the circle, as one action.
  backToCircle: (g: Grimoire): readonly Payload[] =>
    g.seats.flatMap(seat => seat.place ? [{ kind: 'placeSeat', seat: seat.id } as Payload] : []),

}
