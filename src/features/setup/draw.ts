// The players draw their own tokens: the bag lies face down, each player in seating order takes
// one, and the Storyteller deals what they took. Until the deal nothing is on the board, so a
// draw can stop and resume, and the Storyteller can deal the rest at random instead.
import { character as characterOf, gameText, isEmptySeat } from '../../content'
import type { CharacterId, Locale, Team } from '../../content'
import { inPlay } from '../../engine'
import type { Grimoire, Payload, SeatId } from '../../engine'
import type { Draw, DrawToken } from '../../store'
import type { BagRole } from './randomBag'
import { shuffled } from './randomBag'
import { dealing, seatedCharacters, sideOf } from './setup'

// These players never see their own token: theirs shows a character of this team instead.
const disguises: Readonly<Record<string, Team>> = { drunk: 'townsfolk', lunatic: 'demon', marionette: 'townsfolk' }

// A Lunatic believes they are the Demon in play, a Drunk or Marionette a Townsfolk nobody holds.
// A script short of those still gets a character of the team rather than the true token.
const believed = (character: CharacterId, roles: readonly BagRole[], present: ReadonlySet<CharacterId>,
  used: ReadonlySet<CharacterId>, random: () => number): CharacterId | undefined => {
  const team = disguises[character]
  if (!team) return undefined
  const candidates = shuffled(roles.filter(role => role.team === team && !used.has(role.id)), random)
  return (candidates.find(role => present.has(role.id) === (team === 'demon')) ?? candidates[0])?.id
}

// `inPlay` holds the characters already on the board, which a disguise avoids like the bag's own.
export const fillBag = (bag: readonly CharacterId[], roles: readonly BagRole[] = [], random = Math.random,
  inPlay: readonly CharacterId[] = []): Draw | undefined => {
  const seated = seatedCharacters(bag)
  const present = new Set([...seated, ...inPlay])
  const used = new Set<CharacterId>()
  const tokens = shuffled(seated, random).map((character): DrawToken => {
    const shown = believed(character, roles, present, used, random)
    if (!shown) return { character }
    used.add(shown)
    return { character, shown }
  })
  return tokens.length ? { tokens } : undefined
}

const emptySeats = (g: Grimoire): ReadonlySet<SeatId> => new Set(g.seats.filter(seat => isEmptySeat(seat.character)).map(seat => seat.id))

// A token held by a seat that was since removed or given a character is back in the bag.
const holders = (g: Grimoire, draw: Draw): readonly (SeatId | undefined)[] => {
  const empty = emptySeats(g)
  return draw.tokens.map(token => token.seat && empty.has(token.seat) ? token.seat : undefined)
}

// The tokens players have taken, which are theirs, and those still face down in the bag.
export const bagContents = (g: Grimoire, draw: Draw) => {
  const held = holders(g, draw)
  return { taken: draw.tokens.filter((_, i) => held[i] !== undefined), faceDown: draw.tokens.filter((_, i) => held[i] === undefined) }
}

// Filling the bag again during a draw replaces only what is still face down: a player who took
// a token has seen it, so it stays theirs, and a new disguise avoids what they saw.
export const refillBag = (g: Grimoire, draw: Draw | undefined, bag: readonly CharacterId[], roles: readonly BagRole[] = [],
  random = Math.random): Draw | undefined => {
  const taken = draw ? bagContents(g, draw).taken : []
  const seen = taken.flatMap(token => [token.character, ...(token.shown ? [token.shown] : [])])
  const tokens = [...taken, ...(fillBag(bag, roles, random, [...inPlay(g), ...seen])?.tokens ?? [])]
  return tokens.length ? { tokens } : undefined
}

// Who draws, in seating order: the empty seats that hold a token, and as many of the others as
// there are tokens left.
export const drawTurns = (g: Grimoire, draw: Draw): readonly SeatId[] => {
  const empty = emptySeats(g)
  const holding = new Set(holders(g, draw).filter(seat => seat !== undefined))
  let left = draw.tokens.length - holding.size
  const turns: SeatId[] = []
  for (const seat of g.seats) {
    if (empty.has(seat.id) && (holding.has(seat.id) || left-- > 0)) turns.push(seat.id)
  }
  return turns
}

// A bag with fewer tokens than empty seats runs out before every seat has drawn.
export const drawRunsShort = (g: Grimoire, draw: Draw): boolean => emptySeats(g).size > drawTurns(g, draw).length

// The first player still to draw, or undefined once everyone has.
export const nextDrawer = (g: Grimoire, draw: Draw): SeatId | undefined => {
  const holding = new Set(holders(g, draw))
  return drawTurns(g, draw).find(seat => !holding.has(seat))
}

// Only display values leave this projection: which places are still free, and the character
// this player's token shows them, never their disguise's truth or what lies under any other.
export const drawPlayer = (g: Grimoire, draw: Draw, cursor: string, locale: Locale, roles: readonly BagRole[] = []) => {
  const turns = drawTurns(g, draw)
  const index = turns.findIndex(seat => seat === cursor)
  const seat = g.seats.find(s => s.id === cursor)
  if (index < 0 || !seat) return undefined
  const held = holders(g, draw)
  const taken = held.indexOf(seat.id)
  const turn = {
    id: seat.id,
    name: seat.name,
    number: index + 1,
    total: turns.length,
    next: turns[index + 1],
    free: held.map(holder => holder === undefined),
  }
  const token = draw.tokens[taken]
  if (!token) return turn
  const character = token.shown ?? token.character
  const role = gameText(locale).role(character)
  return { ...turn, character, alignment: sideOf(roles)(character), roleName: role.name, ability: role.ability }
}

export const takeToken = (g: Grimoire, draw: Draw, seat: SeatId, at: number): Draw | undefined => {
  const held = holders(g, draw)
  if (held[at] !== undefined || held.includes(seat) || !draw.tokens[at] || !drawTurns(g, draw).includes(seat)) return undefined
  return { tokens: draw.tokens.map((token, i) => i === at ? { ...token, seat } : token) }
}

// A disguised token lands as in a paper grimoire: the Drunk and the Marionette as the character
// their player saw, under their own global reminder, Is The Drunk or Is The Marionette, on the
// side they really play, so a Marionette sits evil. The Lunatic has no such reminder, so it
// keeps its token and records the Demon it was shown.
const dealToken = (deal: ReturnType<typeof dealing>, seat: SeatId, token: DrawToken): Payload[] => {
  if (!token.shown) return [deal(seat, token.character)]
  const marker = characterOf(token.character).reminders.find(reminder => reminder.global)
  if (!marker) return [deal(seat, token.character), { kind: 'setShown', seat, to: token.shown }]
  return [deal(seat, token.shown, token.character), { kind: 'placeToken', token: [token.character, marker.name], seat }]
}

// Only the players who drew get a character: a night started before the deal still gives each of
// them the token they saw, and leaves what is face down undealt.
export const dealTaken = (g: Grimoire, draw: Draw, roles: readonly BagRole[] = []): readonly Payload[] => {
  const held = holders(g, draw)
  const deal = dealing(roles)
  return draw.tokens.flatMap((token, i) => {
    const seat = held[i]
    return seat ? dealToken(deal, seat, token) : []
  })
}

// Each player gets the token they took. The others go to the remaining empty seats at random,
// which is the whole deal when nobody drew.
export const dealDraw = (g: Grimoire, draw: Draw, random = Math.random, roles: readonly BagRole[] = []): readonly Payload[] => {
  const held = holders(g, draw)
  const kept = new Map(draw.tokens.flatMap((token, i) => {
    const seat = held[i]
    return seat ? [[seat, token] as const] : []
  }))
  const rest = shuffled(draw.tokens.filter((_, i) => held[i] === undefined), random)
  const deal = dealing(roles)
  let next = 0
  return g.seats.filter(seat => isEmptySeat(seat.character)).flatMap(seat => {
    const token = kept.get(seat.id) ?? rest[next++]
    return token ? dealToken(deal, seat.id, token) : []
  })
}
