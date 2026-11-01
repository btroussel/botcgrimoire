import { gameText } from '../../content'
import { asEventId, reduce } from '../../engine'
import { game, setAlignment, token } from '../../engine/testing/board'
import { canDiscover, discoveryName, discoveryPlayer } from './discovery'

describe('discovery during setup', () => {
  const table = () => game().seat('First', 'imp').seat('Second', 'drunk', { shown: 'washerwoman' }).seat('Third', 'empath').build()

  test('the entire table needs assigned identities before discovery opens', () => {
    expect(canDiscover(table().g)).toBe(true)
    expect(canDiscover(game().seat('Player', 'drunk').build().g)).toBe(true)
    expect(canDiscover(game().seat('Player', '_empty').build().g)).toBe(false)
    expect(canDiscover(game().build().g)).toBe(false)
    expect(canDiscover(game().seat('Player', 'imp').night(1).build().g)).toBe(false)
  })

  test('the display includes only this player and the next stable seat id', () => {
    const { g, id } = table()
    const before = JSON.stringify(g)
    const role = gameText('fr').role(g.seats[1]!.shown!)
    expect(discoveryPlayer(g, id('Second'), 'fr')).toEqual({
      id: id('Second'), name: 'Second', number: 2, total: 3, next: id('Third'),
      character: 'washerwoman', alignment: 'good', roleName: role.name, ability: role.ability,
    })
    expect(JSON.stringify(g)).toBe(before)
    expect(discoveryPlayer(g, 'removed-seat', 'en')).toBeUndefined()
    expect(discoveryPlayer(g, id('Third'), 'en')?.next).toBeUndefined()
  })

  test('a disguised player sees the side of what they were shown, never their own', () => {
    const { g, id } = game().seat('Puppet', 'marionette', { shown: 'chef' }).seat('Mad', 'lunatic', { shown: 'imp' }).build()
    expect(g.seats.map(seat => seat.alignment)).toEqual(['evil', 'good'])
    expect(discoveryPlayer(g, id('Puppet'), 'en')).toMatchObject({ character: 'chef', alignment: 'good' })
    expect(discoveryPlayer(g, id('Mad'), 'en')).toMatchObject({ character: 'imp', alignment: 'evil' })
  })

  test('a player sitting as the token they believe in, under their own reminder, sees its side until theirs changes', () => {
    const { g, id } = game().seat('Puppet', 'chef', { alignment: 'evil' }).seat('Sot', 'empath')
      .add(token('storyteller', 'marionette/Is The Marionette', 'Puppet'), token('storyteller', 'drunk/Is The Drunk', 'Sot')).build()
    expect(discoveryPlayer(g, id('Puppet'), 'en')).toMatchObject({ character: 'chef', alignment: 'good' })
    expect(discoveryPlayer(g, id('Sot'), 'en')).toMatchObject({ character: 'empath', alignment: 'good' })
    const turned = game().seat('Sot', 'empath').add(token('storyteller', 'drunk/Is The Drunk', 'Sot'), setAlignment('Sot', 'evil')).build()
    expect(discoveryPlayer(turned.g, turned.id('Sot'), 'en')).toMatchObject({ character: 'empath', alignment: 'evil' })
  })

  test('a rename keeps the role, seat and setup phase unchanged and survives reduction', () => {
    const { g, id, log } = table()
    const event = discoveryName(id('Second'), 'Second', '  Léa  ')
    expect(event).toEqual({ kind: 'renameSeat', seat: id('Second'), name: 'Léa' })
    const renamed = reduce(g.script, [...log, { ...event!, id: asEventId(log.length), audience: 'storyteller' }])
    expect(discoveryPlayer(renamed, id('Second'), 'en')).toMatchObject({ name: 'Léa', character: 'washerwoman', next: id('Third') })
    expect(renamed.clock).toEqual(g.clock)
    expect(renamed.seats[1]?.tokens).toEqual(g.seats[1]?.tokens)
    expect(discoveryName(id('Second'), 'Léa', ' Léa ')).toBeUndefined()
    expect(discoveryName(id('Second'), 'Léa', '   ')).toBeUndefined()
  })
})
