import { asCharacterId } from '../../content'
import { asEventId, inPlay, playerIdentity, reduce } from '../../engine'
import { game } from '../../engine/testing/board'
import type { Draw } from '../../store'
import { listed } from '../../store/scriptSheet'
import { bagContents, dealDraw, dealTaken, drawPlayer, drawRunsShort, drawTurns, fillBag, nextDrawer, refillBag, takeToken } from './draw'
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
