// The board as the ring draws it, read from the grimoire and the log with no React: each seat's
// token, states and chips, the three bluffs, the loose Fabled and Loric, the Storyteller's
// grants. The binding here is a translation of the engine's shapes into the ui pieces' props
// in the chosen language; every judgement stays in the engine.
import type { Alignment, CharacterId, Locale, Script } from '../../content'
import { gameText, isEmptySeat, isLoose, scriptCharacters, characters } from '../../content'
import type { Event, EventId, Grant, Grimoire, Seat, SeatId, TokenInstance } from '../../engine'
import { isNote, onTheBlock } from '../../engine'
import { bluffsOf } from '../../store/bluffs'

export interface ChipView {
  readonly key: string
  readonly label: string
  readonly character?: string // omitted for a note
  readonly alignment?: Alignment
  readonly placedBy?: EventId // placed reminders can be removed; identity chips open the seat menu
}

export interface SeatView {
  readonly id: SeatId
  readonly name: string
  readonly character: string // '' for a seat still waiting for its character
  readonly characterName: string
  readonly alignment: Alignment
  readonly dead: boolean
  readonly onBlock?: boolean
  readonly ghostVote: boolean
  readonly chips: readonly ChipView[]
}

export interface GrantView {
  readonly key: string
  readonly character: string
  readonly from?: string // the granting seat's name; absent when the Storyteller holds the ability
}

export interface BoardView {
  readonly seats: readonly SeatView[]
  readonly bluffs: readonly CharacterId[]
  readonly loose: readonly CharacterId[]
  readonly grants: readonly GrantView[]
}

const chipOf = (token: TokenInstance, g: Grimoire, text: ReturnType<typeof gameText>): ChipView => {
  if (isNote(token.def, token.note)) return { key: String(token.placedBy), label: token.note ?? '', placedBy: token.placedBy }
  const source = token.source !== undefined ? g.seats.find((s) => s.id === token.source) : undefined
  return {
    key: String(token.placedBy),
    label: text.reminder(token.def[1]),
    character: token.def[0],
    // The chip's art takes the placing seat's side, so a Poisoner's token reads red however
    // the character's team is drawn by default.
    ...(source ? { alignment: source.alignment } : {}),
    placedBy: token.placedBy,
  }
}

const chipsOf = (seat: Seat, g: Grimoire, text: ReturnType<typeof gameText>): readonly ChipView[] => {
  const identity = seat.shown ? [{ key: 'shown', label: text.role(seat.shown).name, character: seat.shown }] : []
  return [...identity, ...seat.tokens.map((token) => chipOf(token, g, text))]
}

const seatView = (seat: Seat, g: Grimoire, text: ReturnType<typeof gameText>): SeatView => {
  const role = text.role(seat.character)
  // A seat waiting for its character (setup's placeholder id) draws as empty, with its number.
  const empty = isEmptySeat(seat.character)
  return {
    id: seat.id,
    name: seat.name,
    character: empty ? '' : seat.character,
    characterName: empty ? '' : role.name,
    alignment: seat.alignment,
    dead: !seat.alive,
    ghostVote: seat.ghostVote,
    chips: chipsOf(seat, g, text),
  }
}

// The name stays apart from the Storyteller's own grants, so a player called "self" reads as one.
const grantView = (grant: Grant, g: Grimoire): GrantView => ({
  key: String(grant.grantedBy),
  character: grant.of,
  ...(grant.source === 'storyteller' || grant.source === 'self' ? {} : { from: g.seats.find((s) => s.id === grant.source)?.name ?? grant.source }),
})

// The bluffs come from the log unless the caller has followed them already.
export const boardView = (g: Grimoire, log: readonly Event[], locale: Locale, bluffs = bluffsOf(g, log)): BoardView => {
  const text = gameText(locale)
  const blocked = onTheBlock(g)
  return {
    seats: g.seats.map((s) => ({ ...seatView(s, g, text), onBlock: s.id === blocked })),
    bluffs,
    loose: g.loose,
    grants: g.storyteller.abilities.map((a) => grantView(a, g)),
  }
}

const sameChip = (a: ChipView, b: ChipView): boolean =>
  a.key === b.key && a.label === b.label && a.character === b.character && a.alignment === b.alignment && a.placedBy === b.placedBy

// Whether two views of a seat draw the same. The view is rebuilt on every edit, so the ring
// compares by value to leave the seats an edit did not touch alone.
export const sameSeat = (a: SeatView, b: SeatView): boolean =>
  a === b || (a.id === b.id && a.name === b.name && a.character === b.character && a.characterName === b.characterName &&
    a.alignment === b.alignment && a.dead === b.dead && a.onBlock === b.onBlock &&
    a.ghostVote === b.ghostVote && a.chips.length === b.chips.length && a.chips.every((chip, i) => sameChip(chip, b.chips[i]!)))

// The characters that hold no seat: the script's Fabled, Loric and Lil' Monsta, then every other
// bundled Fabled and Loric. The bag never deals them, so the board is where the Storyteller puts
// one in or takes it out.
export const looseChoices = (script: Script): readonly CharacterId[] =>
  [...new Set([...scriptCharacters(script).filter(isLoose), ...[...characters.values()].filter(c => c.team === 'fabled' || c.team === 'loric').map(c => c.id)])]
