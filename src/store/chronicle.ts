// What happened in a game, for History: the deaths, changes and nominations the Storyteller
// recorded each night and day, and when each player died. It reads recorded edits only, so a
// death belongs to the phase its edit was made in, and nothing follows from any ability.
import type { Alignment, CharacterId, Script } from '../content'
import { isEmptySeat } from '../content'
import type { Event, EventId, Grimoire, Phase, Seat, SeatId } from '../engine'
import { apply, emptyGrimoire, onTheBlock, seatById, today } from '../engine'

// A seat as it stood when the fact happened.
export interface Player {
  readonly id: SeatId
  readonly name: string
  readonly character: CharacterId
  readonly alignment: Alignment
}

export type Side = Player | 'storyteller' // the Storyteller nominates with a Bishop, or is nominated with an Atheist

export interface Hand {
  readonly player: Player
  readonly ghost: boolean // raised while dead
}

export type Fact =
  | { readonly kind: 'dies' | 'revives' | 'becomes' | 'turns' | 'joins' | 'leaves' | 'executed' | 'exiled' | 'onBlock'; readonly player: Player }
  | { readonly kind: 'nomination'; readonly by: Side; readonly of: Side; readonly hands: readonly Hand[]; readonly count: number }

export interface Chapter {
  readonly phase: 'night' | 'day'
  readonly night: number
  readonly facts: readonly Fact[]
}

export interface Moment {
  readonly phase: Phase
  readonly night: number
}

// Only what differs from the end of the game: a living player has no death, and a player who
// kept their character and side has no start.
export interface PlayerStory {
  readonly died?: Moment
  readonly startedAs?: CharacterId
  readonly startedOn?: Alignment
}

export interface Chronicle {
  readonly chapters: readonly Chapter[] // the nights and days with something recorded, in order
  readonly players: ReadonlyMap<SeatId, PlayerStory>
}

// A day's nominations and its block are settled when the day ends, so a cancelled nomination
// drops out and the final tally counts. Until then they hold their place among the day's facts.
type Draft = Fact
  | { readonly kind: 'nominated'; readonly opened: EventId; readonly by?: Side; readonly of?: Side; readonly hands: Map<SeatId, Hand> }
  | { readonly kind: 'marked' }

const playerOf = (seat: Seat): Player => ({ id: seat.id, name: seat.name, character: seat.character, alignment: seat.alignment })

const sideOf = (g: Grimoire, id: SeatId | 'storyteller'): Side | undefined => {
  if (id === 'storyteller') return 'storyteller'
  const seat = seatById(g, id)
  return seat && playerOf(seat)
}

export const chronicleOf = (log: readonly Event[], script: Script): Chronicle => {
  const chapters: { readonly phase: 'night' | 'day'; readonly night: number; drafts: Draft[] }[] = []
  let chapter: (typeof chapters)[number] | undefined
  let board = emptyGrimoire(script)
  let playing = false // from the first night or day on
  const first = new Map<SeatId, Seat>() // each seat as it first held a character in play
  const meet = (g: Grimoire) => {
    for (const seat of g.seats) if (!first.has(seat.id) && !isEmptySeat(seat.character)) first.set(seat.id, seat)
  }
  const died = new Map<SeatId, Moment>()

  const settleDay = (g: Grimoire) => {
    if (chapter?.phase !== 'day') return
    const nominations = today(g)?.nominations ?? []
    const block = onTheBlock(g)
    const blocked = block && seatById(g, block)
    const lastMark = chapter.drafts.findLastIndex(d => d.kind === 'marked')
    let lastNomination = -1
    const settled = chapter.drafts.flatMap((d, i): Draft[] => {
      if (d.kind === 'marked') return i === lastMark && blocked ? [{ kind: 'onBlock', player: playerOf(blocked) }] : []
      if (d.kind !== 'nominated') return [d]
      const nomination = nominations.find(n => n.opened === d.opened)
      if (!nomination || !d.by || !d.of) return []
      lastNomination = i
      const hands = nomination.votes.flatMap((id): Hand[] => {
        const seat = seatById(g, id)
        const hand = d.hands.get(id) ?? (seat && { player: playerOf(seat), ghost: false })
        return hand ? [hand] : []
      })
      return [{ kind: 'nomination', by: d.by, of: d.of, hands, count: nomination.weight }]
    })
    // An older day put its leader on the block from the votes alone, with no marker edit.
    if (blocked && lastMark === -1) settled.splice(lastNomination + 1, 0, { kind: 'onBlock', player: playerOf(blocked) })
    chapter.drafts = settled
  }

  // Setup and the time after the ending have no chapter, so their edits tell no story.
  const record = (draft: Draft) => chapter?.drafts.push(draft)
  const opened = (id: EventId) => chapter?.drafts.find((d): d is Extract<Draft, { kind: 'nominated' }> => d.kind === 'nominated' && d.opened === id)

  for (const event of log) {
    const before = board
    const after = apply(before, event)
    board = after
    if (event.kind === 'phase' || event.kind === 'endGame') {
      // A phase edit that leaves the clock where it was continues the same chapter.
      if (event.kind === 'phase' && after.clock.phase === before.clock.phase && after.clock.night === before.clock.night) continue
      settleDay(before)
      if (!playing && before.clock.phase === 'setup' && after.clock.phase !== 'setup') {
        playing = true
        meet(after)
      }
      const { phase, night } = after.clock
      chapter = phase === 'night' || phase === 'day' ? { phase, night, drafts: [] } : undefined
      if (chapter) chapters.push(chapter)
      continue
    }
    if (after.seats !== before.seats) {
      for (const seat of after.seats) {
        const was = seatById(before, seat.id)
        if (!was) {
          record({ kind: 'joins', player: playerOf(seat) })
        } else if (was !== seat) {
          if (was.alive && !seat.alive) {
            died.set(seat.id, { phase: before.clock.phase, night: before.clock.night })
            record({ kind: 'dies', player: playerOf(was) })
          } else if (!was.alive && seat.alive) {
            died.delete(seat.id)
            record({ kind: 'revives', player: playerOf(seat) })
          }
          if (was.character !== seat.character) {
            // Dealing an empty seat or clearing one changes nobody's character.
            if (!isEmptySeat(was.character) && !isEmptySeat(seat.character)) record({ kind: 'becomes', player: playerOf(seat) })
          } else if (was.alignment !== seat.alignment) record({ kind: 'turns', player: playerOf(seat) })
        }
      }
      for (const seat of before.seats) if (!seatById(after, seat.id)) record({ kind: 'leaves', player: playerOf(seat) })
      if (playing) meet(after)
    }
    switch (event.kind) {
      case 'nominate': {
        const by = sideOf(after, event.by)
        const of = sideOf(after, event.of)
        record({ kind: 'nominated', opened: event.id, ...(by ? { by } : {}), ...(of ? { of } : {}), hands: new Map() })
        break
      }
      case 'vote': {
        const seat = seatById(before, event.seat)
        if (seat) opened(event.nomination)?.hands.set(seat.id, { player: playerOf(seat), ghost: !seat.alive })
        break
      }
      case 'unvote':
        opened(event.nomination)?.hands.delete(event.seat)
        break
      case 'markForExecution':
        record({ kind: 'marked' })
        break
      case 'execute':
      case 'exile': {
        const seat = event.seat === undefined ? undefined : seatById(before, event.seat)
        if (seat) record({ kind: event.kind === 'execute' ? 'executed' : 'exiled', player: playerOf(seat) })
        break
      }
      default:
        break
    }
  }
  settleDay(board)

  const players = new Map<SeatId, PlayerStory>()
  for (const seat of board.seats) {
    const start = first.get(seat.id)
    const startedAs = start && start.character !== seat.character ? start.character : undefined
    const startedOn = start && start.alignment !== seat.alignment ? start.alignment : undefined
    const death = seat.alive ? undefined : died.get(seat.id)
    if (death || startedAs || startedOn) {
      players.set(seat.id, { ...(death ? { died: death } : {}), ...(startedAs ? { startedAs } : {}), ...(startedOn ? { startedOn } : {}) })
    }
  }
  return {
    chapters: chapters.flatMap(({ phase, night, drafts }) => {
      const facts = drafts.filter((d): d is Fact => d.kind !== 'nominated' && d.kind !== 'marked')
      return facts.length ? [{ phase, night, facts }] : []
    }),
    players,
  }
}
