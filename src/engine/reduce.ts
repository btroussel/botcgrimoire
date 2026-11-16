// Live play, undo and replay share the same reduction over a longer or shorter event log.
import type { Script } from '../content'
import type { Event } from './events'
import { unreachable } from './events'
import type { Grimoire, Seat, TokenInstance } from './grimoire'
import { applyLegacy } from './legacy'
import { dropTokens, patchSeat, patchToday, raiseHand } from './patch'

export const emptyGrimoire = (script: Script): Grimoire => ({
  script,
  seats: [],
  loose: [],
  storyteller: { abilities: [] },
  clock: { night: 0, phase: 'setup' },
  days: [],
})

// An unflagged event was saved before manual edits and keeps its old reduction where it differs.
export const apply = (g: Grimoire, e: Event): Grimoire => (e.manual ? undefined : applyLegacy(g, e)) ?? applyManual(g, e)

const applyManual = (g: Grimoire, e: Event): Grimoire => {
  switch (e.kind) {
    case 'markForExecution':
      return g.clock.phase === 'day' ? patchToday(g, d => ({ ...d, markedForExecution: e.seat })) : g
    case 'cancelNomination':
      return patchToday(g, d => ({ ...d, nominations: d.nominations.filter(n => n.opened !== e.nomination) }))
    case 'setVoteTotal':
      return patchToday(g, d => ({ ...d, nominations: d.nominations.map(n => n.opened === e.nomination ? { ...n, weight: e.total } : n) }))
    case 'setGhostVote':
      return patchSeat(g, e.seat, s => ({ ...s, ghostVote: e.available }))
    case 'moveSeat': {
      const seat = g.seats.find(s => s.id === e.seat)
      if (!seat || !Number.isFinite(e.to)) return g
      const seats = g.seats.filter(s => s.id !== e.seat)
      seats.splice(Math.max(0, Math.min(Math.trunc(e.to), seats.length)), 0, seat)
      return { ...g, seats }
    }
    case 'endGame':
      return { ...g, clock: { ...g.clock, phase: 'over' }, result: { ...(e.winner ? { winner: e.winner } : {}), ...(e.note !== undefined ? { note: e.note } : {}) } }
    case 'nightChecklist':
      return g
    case 'phase': {
      const night = e.to === 'night' ? (e.night ?? g.clock.night + 1) : g.clock.night
      const clock = { night, phase: e.to }
      // The first day after any other phase opens the ledger entry for that night's number.
      const opensDay = e.to === 'day' && g.clock.phase !== 'day'
      const days = opensDay ? [...g.days, { nominations: [], closed: false }] : g.days
      return { ...g, clock, days }
    }
    case 'kill':
      return patchSeat(g, e.seat, (s) => ({ ...s, alive: false }))
    case 'execute':
      // The executed seat stays in the event, for History; the board only closes the day.
      return patchToday(g, (d) => ({ ...d, closed: true }))
    case 'revive':
      return patchSeat(g, e.seat, (s) => ({ ...s, alive: true }))
    case 'nominate':
      return patchToday(g, (d) => ({
        ...d,
        nominations: [
          ...d.nominations,
          { opened: e.id, by: e.by, of: e.of, votes: [], weight: 0, ...(e.exile ? { exile: true as const } : {}) },
        ],
      }))
    case 'vote':
      // Ghost votes change only through their own edit.
      return raiseHand(g, e.nomination, e.seat, e.weight)
    case 'unvote': {
      const nomination = g.days[g.days.length - 1]?.nominations.find((n) => n.opened === e.nomination)
      if (!nomination?.votes.includes(e.seat)) return g
      const corrected = patchToday(g, (d) => ({
        ...d,
        nominations: d.nominations.map((n) => n.opened === e.nomination
          ? { ...n, votes: n.votes.filter((id) => id !== e.seat), weight: Math.max(0, n.weight - e.weight) } : n),
      }))
      // Restore only the token this hand spent, never one spent on an earlier nomination.
      return e.restoreGhost ? patchSeat(corrected, e.seat, (s) => ({ ...s, ghostVote: true })) : corrected
    }
    case 'placeToken': {
      const token: TokenInstance = {
        def: e.token,
        placedBy: e.id,
        ...(e.source !== undefined ? { source: e.source } : {}),
        ...(e.note !== undefined ? { note: e.note } : {}),
      }
      return patchSeat(g, e.seat, (s) => ({ ...s, tokens: [...s.tokens, token] }))
    }
    case 'removeToken':
      return dropTokens(g, (t) => t.placedBy !== e.placedBy)
    case 'setNote': {
      // Rewritten in place, so the note keeps its spot in the seat's stack.
      const note = e.note.trim()
      if (!note) return g
      return { ...g, seats: g.seats.map((s) => ({ ...s, tokens: s.tokens.map((t) => t.placedBy === e.placedBy && t.note !== undefined ? { ...t, note } : t) })) }
    }
    case 'addSeat': {
      const seat: Seat = {
        id: e.seat,
        name: e.name,
        character: e.character,
        abilities: [],
        alignment: e.alignment,
        alive: true,
        ghostVote: true,
        tokens: [],
      }
      const seats = [...g.seats]
      seats.splice(Math.min(Math.max(e.at, 0), seats.length), 0, seat)
      return { ...g, seats }
    }
    case 'removeSeat':
      // Tokens the seat placed on others stay; its own leave with it.
      return { ...g, seats: g.seats.filter((s) => s.id !== e.seat) }
    case 'renameSeat':
      return e.name.trim() ? patchSeat(g, e.seat, (s) => ({ ...s, name: e.name.trim() })) : g
    case 'setCharacter':
      // Reminders, abilities and the shown character stay until the Storyteller edits them.
      return patchSeat(g, e.seat, (s) => ({
        ...s, character: e.to, ...(e.alignment !== undefined ? { alignment: e.alignment } : {}),
      }))
    case 'setShown':
      return patchSeat(g, e.seat, (s) => {
        const { shown: _shown, ...rest } = s
        return e.to === undefined ? rest : { ...rest, shown: e.to }
      })
    case 'setAlignment':
      return patchSeat(g, e.seat, (s) => ({ ...s, alignment: e.to }))
    case 'addLoose':
      return g.loose.includes(e.character) ? g : { ...g, loose: [...g.loose, e.character] }
    case 'removeLoose':
      return { ...g, loose: g.loose.filter((id) => id !== e.character) }
    case 'grant': {
      const grant = { of: e.of, source: e.source, grantedBy: e.id }
      if (e.seat === 'storyteller') return { ...g, storyteller: { abilities: [...g.storyteller.abilities, grant] } }
      return patchSeat(g, e.seat, (s) => ({ ...s, abilities: [...s.abilities, grant] }))
    }
    case 'revoke':
      return {
        ...g,
        storyteller: { abilities: g.storyteller.abilities.filter((a) => a.grantedBy !== e.grantedBy) },
        seats: g.seats.map((s) => ({ ...s, abilities: s.abilities.filter((a) => a.grantedBy !== e.grantedBy) })),
      }
    case 'wake':
    case 'nightProgress':
    case 'choice':
    case 'info':
    case 'setBluffs':
    case 'prepareInfo':
    case 'dayAction':
    case 'exile':
    case 'resolveDecision':
    case 'override':
      // Readable history with no board field. An exiled traveller leaves with a removeSeat the
      // Storyteller records.
      return g
    default:
      return unreachable(e)
  }
}

export const reduce = (script: Script, log: readonly Event[]): Grimoire => log.reduce(apply, emptyGrimoire(script))
