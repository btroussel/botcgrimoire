import { asCharacterId, character } from '../../content'
import { asEventId, inPlay, playerIdentity, reduce } from '../../engine'
import { game } from '../../engine/testing/board'
import type { Draw } from '../../store'
import { listed } from '../../store/scriptSheet'
import { bagContents, bagDisguises, dealDraw, dealTaken, drawPlayer, drawRunsShort, drawTurns, fillBag, nextDrawer, refillBag, showAs, takeToken } from './draw'
import { spreadLayout } from './spreadLayout'

const ids = (...names: string[]) => names.map(asCharacterId)
// Four seats, the third already given a character by hand.
const table = () => game().seat('Ann', '_empty').seat('Bob', '_empty').seat('Cat', 'chef').seat('Dan', '_empty').build()
const bag = (...characters: string[]): Draw => ({ tokens: ids(...characters).map(character => ({ character })) })

describe('the players draw from the bag', () => {
  test('the bag holds the seated characters face down, and Lil Monsta stays out of it', () => {
    const draw = fillBag(ids('imp', 'lilmonsta', 'chef', 'empath'), [], () => 0)
    expect(draw?.tokens.map(token => token.character).sort()).toEqual(['chef', 'empath', 'imp'])
    expect(draw?.tokens.every(token => token.seat === undefined)).toBe(true)
    expect(fillBag(ids('lilmonsta'))).toBeUndefined()
    expect(fillBag([])).toBeUndefined()
  })

  test('the empty seats draw in seating order, as many as there are tokens', () => {
    const { g, id } = table()
    expect(drawTurns(g, bag('imp', 'empath', 'monk'))).toEqual([id('Ann'), id('Bob'), id('Dan')])
    expect(drawTurns(g, bag('imp', 'empath'))).toEqual([id('Ann'), id('Bob')])
    expect(nextDrawer(g, bag('imp'))).toBe(id('Ann'))
  })

  test('a taken token cannot be taken again, and a player takes one at most', () => {
    const { g, id } = table()
    const first = takeToken(g, bag('imp', 'empath', 'monk'), id('Ann'), 1)!
    expect(first.tokens.map(token => token.seat)).toEqual([undefined, id('Ann'), undefined])
    expect(nextDrawer(g, first)).toBe(id('Bob'))
    expect(takeToken(g, first, id('Bob'), 1)).toBeUndefined()
    expect(takeToken(g, first, id('Ann'), 0)).toBeUndefined()
    expect(takeToken(g, first, id('Cat'), 0)).toBeUndefined()
    expect(takeToken(g, first, id('Bob'), 5)).toBeUndefined()
  })

  test('a turn shows which places are free and only the character this player took', () => {
    const { g, id } = table()
    const draw = takeToken(g, bag('imp', 'empath', 'monk'), id('Ann'), 2)!
    expect(drawPlayer(g, draw, id('Bob'), 'en')).toEqual({
      id: id('Bob'), name: 'Bob', number: 2, total: 3, next: id('Dan'), free: [true, true, false],
    })
    expect(drawPlayer(g, draw, id('Ann'), 'en')).toMatchObject({ number: 1, character: 'monk', alignment: 'good', roleName: 'Monk' })
    expect(drawPlayer(g, takeToken(g, draw, id('Bob'), 0)!, id('Bob'), 'en')).toMatchObject({ character: 'imp', alignment: 'evil' })
    expect(drawPlayer(g, draw, id('Cat'), 'en')).toBeUndefined()
  })

  test('the deal gives each player their token and the rest at random to the other empty seats', () => {
    const { g, id, log } = table()
    let draw = bag('imp', 'empath', 'monk')
    draw = takeToken(g, draw, id('Bob'), 0)!
    const events = dealDraw(g, draw, () => 0)
    expect(events).toHaveLength(3)
    expect(events).toContainEqual({ kind: 'setCharacter', seat: id('Bob'), to: 'imp', alignment: 'evil' })
    const dealt = reduce(g.script, [...log, ...events.map((event, i) => ({ ...event, id: asEventId(log.length + i), audience: 'storyteller' as const, manual: true as const }))])
    expect(dealt.seats.map(seat => seat.character).sort()).toEqual(['chef', 'empath', 'imp', 'monk'])
    expect(dealt.seats.find(seat => seat.id === id('Cat'))?.character).toBe('chef')
  })

  test('nobody drawing deals the whole bag, and a short bag leaves seats empty', () => {
    const { g, id } = table()
    const events = dealDraw(g, bag('imp', 'empath'), () => 0)
    expect(events.map(event => event.kind === 'setCharacter' ? event.seat : undefined)).toEqual([id('Ann'), id('Bob')])
    expect(drawRunsShort(g, bag('imp', 'empath'))).toBe(true)
    expect(drawRunsShort(g, bag('imp', 'empath', 'monk'))).toBe(false)
  })

  test('a night started before the deal gives the players who drew their tokens, and no one else', () => {
    const { g, id } = table()
    let draw: Draw = { tokens: [{ character: asCharacterId('imp') }, { character: asCharacterId('drunk'), shown: asCharacterId('monk') }, { character: asCharacterId('empath') }] }
    expect(dealTaken(g, draw)).toEqual([])
    draw = takeToken(g, takeToken(g, draw, id('Ann'), 1)!, id('Bob'), 0)!
    expect(dealTaken(g, draw)).toEqual([
      { kind: 'setCharacter', seat: id('Bob'), to: 'imp', alignment: 'evil' },
      { kind: 'setCharacter', seat: id('Ann'), to: 'monk', alignment: 'good' },
      { kind: 'placeToken', token: ['drunk', 'Is The Drunk'], seat: id('Ann') },
    ])
  })

  test('a token held by a seat that has since been filled goes back in the bag', () => {
    const before = table()
    const draw = takeToken(before.g, bag('imp', 'empath', 'monk'), before.id('Ann'), 0)!
    const { g, id } = game().seat('Ann', 'saint').seat('Bob', '_empty').seat('Cat', 'chef').seat('Dan', '_empty').build()
    const moved = { tokens: draw.tokens.map(token => token.seat ? { ...token, seat: id('Ann') } : token) }
    expect(drawTurns(g, moved)).toEqual([id('Bob'), id('Dan')])
    expect(drawPlayer(g, moved, id('Bob'), 'en')?.free).toEqual([true, true, true])
    expect(dealDraw(g, moved, () => 0)).toHaveLength(2)
  })

  test('filling the bag again mid-draw keeps the tokens players took and repeats what it is given', () => {
    const { g, id } = table()
    const draw = takeToken(g, bag('villageidiot', 'villageidiot', 'imp'), id('Ann'), 1)!
    expect(bagContents(g, draw)).toEqual({ taken: [{ character: 'villageidiot', seat: id('Ann') }], faceDown: [{ character: 'villageidiot' }, { character: 'imp' }] })
    const refilled = refillBag(g, draw, ids('villageidiot', 'villageidiot'), [], () => 0)!
    expect(refilled.tokens).toEqual([{ character: 'villageidiot', seat: id('Ann') }, { character: 'villageidiot' }, { character: 'villageidiot' }])
    expect(nextDrawer(g, refilled)).toBe(id('Bob'))
    expect(refillBag(g, undefined, ids('imp'), [], () => 0)).toEqual(bag('imp'))
    expect(refillBag(g, draw, [], [], () => 0)?.tokens).toHaveLength(1)
  })

  test('a refill gives a new Drunk a Townsfolk no player has already seen', () => {
    const { g, id } = table()
    const roles = listed('tb', 'en').filter(role => role.team !== 'townsfolk' || ['chef', 'empath', 'monk'].includes(role.id))
    const draw = takeToken(g, { tokens: [{ character: asCharacterId('drunk'), shown: asCharacterId('empath') }, { character: asCharacterId('imp') }] }, id('Ann'), 0)!
    for (const seed of [0, 0.5, 0.99]) expect(refillBag(g, draw, ids('drunk'), roles, () => seed)!.tokens[1]).toEqual({ character: 'drunk', shown: 'monk' })
  })

  test('a Drunk, Lunatic or Marionette token shows a Townsfolk nobody holds or the Demon in play', () => {
    const roles = listed('bmr', 'en')
    const townsfolk = roles.filter(role => role.team === 'townsfolk').map(role => role.id)
    const demons = roles.filter(role => role.team === 'demon').map(role => role.id)
    for (const seed of [0, 0.3, 0.6, 0.99]) {
      const draw = fillBag(ids('drunk', 'lunatic', 'marionette', 'zombuul', 'grandmother', 'sailor'), roles, () => seed, ids('innkeeper'))!
      const shown = Object.fromEntries(draw.tokens.map(token => [token.character, token.shown]))
      expect(shown.lunatic).toBe('zombuul')
      expect(shown.zombuul).toBeUndefined()
      for (const of of [shown.drunk, shown.marionette]) {
        expect(townsfolk).toContain(of)
        expect(['grandmother', 'sailor', 'innkeeper']).not.toContain(of)
      }
      expect(shown.drunk).not.toBe(shown.marionette)
      expect(demons).toContain(fillBag(ids('lunatic'), roles, () => seed)!.tokens[0]!.shown)
    }
    expect(fillBag(ids('drunk'))!.tokens).toEqual([{ character: 'drunk' }])
  })

  test('a Marionette believes they are the Huntsman only when the Damsel is in play', () => {
    const roles = ids('huntsman', 'empath', 'chef', 'damsel', 'marionette', 'imp').map(id => character(id))
    const shown = (bag: readonly string[]) => new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map(seed =>
      fillBag(ids(...bag), roles, () => seed)!.tokens.find(token => token.character === 'marionette')!.shown))
    expect(shown(['marionette', 'chef', 'imp'])).toEqual(new Set(['empath']))
    expect(shown(['marionette', 'chef', 'damsel', 'imp'])).toEqual(new Set(['empath', 'huntsman']))
  })

  test('a disguised token shows its player what they believe, and lands as in a paper grimoire', () => {
    const { g, id, log } = table()
    let draw: Draw = { tokens: [
      { character: asCharacterId('marionette'), shown: asCharacterId('chef') },
      { character: asCharacterId('lunatic'), shown: asCharacterId('imp') },
      { character: asCharacterId('drunk'), shown: asCharacterId('empath') },
    ] }
    draw = takeToken(g, takeToken(g, draw, id('Ann'), 0)!, id('Bob'), 1)!
    expect(draw.tokens[0]).toEqual({ character: 'marionette', shown: 'chef', seat: id('Ann') })
    expect(drawPlayer(g, draw, id('Ann'), 'en')).toMatchObject({ character: 'chef', alignment: 'good', roleName: 'Chef' })
    expect(drawPlayer(g, draw, id('Bob'), 'en')).toMatchObject({ character: 'imp', alignment: 'evil', roleName: 'Imp' })
    const events = dealDraw(g, draw, () => 0)
    // The Drunk and the Marionette sit as what they saw, under their own reminder; the Lunatic has none.
    expect(events).toEqual([
      { kind: 'setCharacter', seat: id('Ann'), to: 'chef', alignment: 'evil' },
      { kind: 'placeToken', token: ['marionette', 'Is The Marionette'], seat: id('Ann') },
      { kind: 'setCharacter', seat: id('Bob'), to: 'lunatic', alignment: 'good' },
      { kind: 'setShown', seat: id('Bob'), to: 'imp' },
      { kind: 'setCharacter', seat: id('Dan'), to: 'empath', alignment: 'good' },
      { kind: 'placeToken', token: ['drunk', 'Is The Drunk'], seat: id('Dan') },
    ])
    const dealt = reduce(g.script, [...log, ...events.map((event, i) => ({ ...event, id: asEventId(log.length + i), audience: 'storyteller' as const, manual: true as const }))])
    const dan = dealt.seats.find(seat => seat.id === id('Dan'))!
    expect(dan).toMatchObject({ character: 'empath', alignment: 'good' })
    expect(dan.shown).toBeUndefined()
    // The Marionette plays evil, while its player still sees the good Chef they drew.
    expect(dealt.seats.find(seat => seat.id === id('Ann'))).toMatchObject({ character: 'chef', alignment: 'evil' })
    expect(playerIdentity(dealt, id('Ann'))).toEqual({ character: 'chef', alignment: 'good' })
    expect(inPlay(dealt)).toEqual(expect.arrayContaining(['chef', 'marionette', 'lunatic', 'empath', 'drunk']))
    expect(inPlay(dealt)).not.toContain('imp')
  })

  test('the Storyteller can choose the Townsfolk a Drunk shows, among those nobody holds', () => {
    const { g, id } = table()
    const roles = listed('tb', 'en')
    const draw = fillBag(ids('drunk', 'imp', 'empath'), roles, () => 0, inPlay(g))!
    const at = draw.tokens.findIndex(token => token.character === 'drunk')
    const [drunk] = bagDisguises(g, draw, roles)
    // Left alone, the bag picks at random, and Cat's Chef on the board is no choice.
    expect(drunk).toMatchObject({ at, character: 'drunk', chosen: undefined })
    expect(drunk!.choices).toEqual(roles.filter(role => role.team === 'townsfolk' && !['chef', 'empath'].includes(role.id)).map(role => role.id))
    expect(bagDisguises(g, draw, roles)).toHaveLength(1)
    for (const not of ['empath', 'chef', 'imp', 'baron']) expect(showAs(g, draw, at, asCharacterId(not), roles)).toBeUndefined()
    expect(showAs(g, draw, draw.tokens.findIndex(token => token.character === 'imp'), asCharacterId('monk'), roles)).toBeUndefined()

    const chosen = showAs(g, draw, at, asCharacterId('monk'), roles)!
    expect(chosen.tokens[at]).toEqual({ character: 'drunk', shown: 'monk', chosen: true })
    expect(chosen.tokens.filter((_, i) => i !== at)).toEqual(draw.tokens.filter((_, i) => i !== at))
    expect(bagDisguises(g, chosen, roles)[0]).toMatchObject({ chosen: 'monk' })
    // The player who draws it sees the Monk, and the deal seats the Monk under the Drunk's reminder.
    const taken = takeToken(g, chosen, id('Ann'), at)!
    expect(drawPlayer(g, taken, id('Ann'), 'en', roles)).toMatchObject({ character: 'monk', alignment: 'good', roleName: 'Monk' })
    expect(dealTaken(g, taken, roles)).toEqual([
      { kind: 'setCharacter', seat: id('Ann'), to: 'monk', alignment: 'good' },
      { kind: 'placeToken', token: ['drunk', 'Is The Drunk'], seat: id('Ann') },
    ])

    // Back to random, the bag picks again from the same free Townsfolk.
    for (const seed of [0, 0.5, 0.99]) {
      const random = showAs(g, chosen, at, undefined, roles, () => seed)!.tokens[at]!
      expect(random.chosen).toBeUndefined()
      expect(drunk!.choices).toContain(random.shown)
    }
  })

  test('a Lunatic may be shown any Demon, and no two disguises show the same character', () => {
    const { g } = table()
    const roles = listed('bmr', 'en')
    const draw = fillBag(ids('lunatic', 'zombuul', 'drunk', 'marionette'), roles, () => 0)!
    const of = (character: string) => draw.tokens.findIndex(token => token.character === character)
    const choices = (d: Draw, character: string) => bagDisguises(g, d, roles).find(open => open.character === character)!.choices
    expect(choices(draw, 'lunatic')).toEqual(roles.filter(role => role.team === 'demon').map(role => role.id))
    // What the Marionette shows is no choice for the Drunk, and the other way round.
    expect(choices(draw, 'drunk')).not.toContain(draw.tokens[of('marionette')]!.shown)
    const pick = choices(draw, 'drunk')[0]!
    const drunk = showAs(g, draw, of('drunk'), pick, roles)!
    expect(choices(drunk, 'marionette')).not.toContain(pick)
    expect(showAs(g, drunk, of('marionette'), pick, roles)).toBeUndefined()
    const pukka = showAs(g, drunk, of('lunatic'), asCharacterId('pukka'), roles)!
    expect(pukka.tokens[of('lunatic')]).toEqual({ character: 'lunatic', shown: 'pukka', chosen: true })
    expect(pukka.tokens[of('drunk')]).toEqual({ character: 'drunk', shown: pick, chosen: true })
  })

  test('a token a player has taken keeps what they saw', () => {
    const { g, id } = table()
    const roles = listed('tb', 'en')
    const draw = takeToken(g, { tokens: [{ character: asCharacterId('drunk'), shown: asCharacterId('empath') }, { character: asCharacterId('imp') }] }, id('Ann'), 0)!
    expect(bagDisguises(g, draw, roles)).toEqual([])
    expect(showAs(g, draw, 0, asCharacterId('monk'), roles)).toBeUndefined()
    expect(showAs(g, draw, 0, undefined, roles)).toBeUndefined()
  })

  test('a refill keeps a chosen disguise while it still fits the bag, and picks the rest at random', () => {
    const { g, id } = table()
    const roles = listed('tb', 'en')
    // Ann has drawn a Drunk showing the Empath; the Storyteller chose the Monk for the other.
    const draw = takeToken(g, { tokens: [
      { character: asCharacterId('drunk'), shown: asCharacterId('empath') },
      { character: asCharacterId('drunk'), shown: asCharacterId('monk'), chosen: true },
      { character: asCharacterId('imp') },
    ] }, id('Ann'), 0)!
    for (const seed of [0, 0.5, 0.99]) {
      const refilled = refillBag(g, draw, ids('drunk', 'drunk'), roles, () => seed)!
      expect(refilled.tokens[0]).toEqual({ character: 'drunk', shown: 'empath', seat: id('Ann') })
      const fresh = refilled.tokens.slice(1)
      expect(fresh).toHaveLength(2)
      expect(fresh).toContainEqual({ character: 'drunk', shown: 'monk', chosen: true })
      // The other new Drunk avoids the choice, the Townsfolk Ann saw and the Chef on the board.
      const other = fresh.find(token => token.character === 'drunk' && !token.chosen)!
      expect(['monk', 'empath', 'chef']).not.toContain(other.shown)
      expect(roles.find(role => role.id === other.shown)?.team).toBe('townsfolk')
    }
    // A choice the new bag now holds goes back to random, and a bag with no Drunk left drops it.
    const monk = refillBag(g, draw, ids('drunk', 'monk'), roles, () => 0)!.tokens.find(token => token.character === 'drunk' && !token.seat)!
    expect(monk.chosen).toBeUndefined()
    expect(['monk', 'empath', 'chef']).not.toContain(monk.shown)
    expect(refillBag(g, draw, ids('imp'), roles, () => 0)!.tokens).toEqual([{ character: 'drunk', shown: 'empath', seat: id('Ann') }, { character: 'imp' }])
  })

  test('homebrew characters start on their declared side', () => {
    const { g, id } = table()
    const roles = [{ id: asCharacterId('customdemon'), team: 'demon' as const }]
    expect(dealDraw(g, bag('customdemon'), () => 0, roles)).toEqual([{ kind: 'setCharacter', seat: id('Ann'), to: 'customdemon', alignment: 'evil' }])
  })
})

describe('the face-down bag', () => {
  test('tokens never overlap and stay inside the square, from one to twenty', () => {
    for (const size of [120, 280, 360]) {
      for (let count = 1; count <= 20; count++) {
        const { token, places } = spreadLayout(count, size, 8)
        expect(places).toHaveLength(count)
        for (const [i, a] of places.entries()) {
          expect(a.x - token / 2).toBeGreaterThanOrEqual(-0.01)
          expect(a.y - token / 2).toBeGreaterThanOrEqual(-0.01)
          expect(a.x + token / 2).toBeLessThanOrEqual(size + 0.01)
          expect(a.y + token / 2).toBeLessThanOrEqual(size + 0.01)
          for (const b of places.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(token + 8 - 0.01)
        }
      }
    }
  })

  test('twenty tokens stay large enough to tap on a phone', () => {
    expect(spreadLayout(20, 326, 8).token).toBeGreaterThan(52)
  })

  test('every row sits in the middle and nests in the hollows of the next', () => {
    for (let count = 2; count <= 20; count++) {
      const { places } = spreadLayout(count, 300, 8)
      const rows = [...new Set(places.map(place => place.y))].map(y => places.filter(place => place.y === y))
      for (const row of rows) expect(row.reduce((sum, place) => sum + place.x, 0) / row.length).toBeCloseTo(150)
      for (const [i, row] of rows.slice(1).entries()) expect(Math.abs(row.length - rows[i]!.length) % 2).toBe(1)
    }
  })

  test('a bag that can keep the same shape upside down does', () => {
    for (const [count, shape] of [[4, [1, 2, 1]], [8, [3, 2, 3]], [10, [3, 4, 3]], [19, [3, 4, 5, 4, 3]]] as const) {
      const { places } = spreadLayout(count, 326, 8)
      expect([...new Set(places.map(place => place.y))].map(y => places.filter(place => place.y === y).length)).toEqual(shape)
    }
  })
})
