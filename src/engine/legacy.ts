// Saved guided events predate manual edits. Every reduction that differs for an event without
// `manual: true` lives here, so undo and replay do not reinterpret existing games. New events
// never reach this code, and nothing else in the engine branches on a character.
import type { TokenRef } from '../content'
import type { Event } from './events'
import type { Grimoire, Seat } from './grimoire'
import { dropTokens, patchSeat, patchToday, raiseHand } from './patch'

const spentCharacters = new Set(['slayer', 'assassin', 'courtier', 'artist', 'bonecollector', 'fool', 'judge', 'virgin', 'professor', 'fisherman', 'engineer', 'seamstress', 'huntsman', 'mezepheles', 'nightwatchman', 'preacher'])

const legacySpentToken = ([character, name]: TokenRef): boolean =>
  (name === 'No Ability' && spentCharacters.has(character)) || (character === 'puzzlemaster' && name === 'Guess Used')

const legacyDeclaredDead = (seat: Seat): boolean =>
  seat.character === 'zombuul' && seat.tokens.some(t => t.def[0] === 'zombuul' && t.def[1] === 'Dead')

// The Fang Gu's jump is spent for the whole game, including future Fang Gu players.
const fangGuJump = (def: TokenRef): boolean => def[0] === 'fanggu' && def[1] === 'Once'

// The old board for an unflagged event, or undefined where it matches the manual reduction.
export const applyLegacy = (g: Grimoire, e: Event): Grimoire | undefined => {
  switch (e.kind) {
    case 'phase':
      // Only the first day after a night opened a ledger entry.
      return e.to === 'day' && g.clock.phase !== 'night' ? { ...g, clock: { night: g.clock.night, phase: e.to } } : undefined
    case 'revive':
      return patchSeat(g, e.seat, (s) => ({
        ...s,
        alive: true,
        // Resurrection restores spent abilities, but not tokens another ability put here.
        tokens: s.tokens.filter((t) => !((t.source === undefined || t.source === s.id) &&
          legacySpentToken(t.def))),
      }))
    case 'vote': {
      const voted = raiseHand(g, e.nomination, e.seat, e.weight)
      // A dead seat spent its ghost vote by raising its hand unless the hand was free. A seat
      // declared dead by its own token voted as a dead one.
      return patchSeat(voted, e.seat, (s) => ((s.alive && !legacyDeclaredDead(s)) || e.free ? s : { ...s, ghostVote: false }))
    }
    case 'unvote': {
      const nomination = g.days[g.days.length - 1]?.nominations.find((n) => n.opened === e.nomination)
      if (!nomination?.votes.includes(e.seat)) return g
      // The total was not clamped at zero.
      const corrected = patchToday(g, (d) => ({
        ...d,
        nominations: d.nominations.map((n) => n.opened === e.nomination
          ? { ...n, votes: n.votes.filter((id) => id !== e.seat), weight: n.weight - e.weight } : n),
      }))
      return e.restoreGhost ? patchSeat(corrected, e.seat, (s) => ({ ...s, ghostVote: true })) : corrected
    }
    case 'setCharacter': {
      const seat = g.seats.find((s) => s.id === e.seat)
      if (!seat) return g
      const old = seat.character
      // The old character's own tokens leave, wherever it placed them; what others placed on
      // this seat stays. Once-per-game abilities restart unspent because their spent state was
      // one of those tokens.
      const cleared = dropTokens(g, (t) => fangGuJump(t.def) || !(t.def[0] === old && (t.source === e.seat || t.source === undefined)))
      return patchSeat(cleared, e.seat, (s) => {
        const { shown: _shown, ...rest } = s
        return { ...rest, character: e.to, abilities: old === 'philosopher' ? s.abilities.filter((a) => a.source !== e.seat) : s.abilities, ...(e.alignment !== undefined ? { alignment: e.alignment } : {}) }
      })
    }
    case 'revoke': {
      const removed = g.seats.flatMap(s => s.abilities.filter(a => a.grantedBy === e.grantedBy).map(a => ({ seat: s.id, of: a.of })))
      const next = {
        ...g,
        storyteller: { abilities: g.storyteller.abilities.filter((a) => a.grantedBy !== e.grantedBy) },
        seats: g.seats.map((s) => ({ ...s, abilities: s.abilities.filter((a) => a.grantedBy !== e.grantedBy) })),
      }
      const ended = removed.filter(a => !next.seats.some(s => s.id === a.seat && (s.character === a.of || s.abilities.some(other => other.of === a.of))))
      // Losing the last copy ended its sourced effects. Reacquiring it started afresh, while
      // removing one of several grants left the still-held ability intact.
      return { ...next, seats: next.seats.map(s => ({ ...s, tokens: s.tokens.filter(t =>
        fangGuJump(t.def) || !ended.some(a => t.source === a.seat && t.def[0] === a.of)) })) }
    }
    default:
      return undefined
  }
}
