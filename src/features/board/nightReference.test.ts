import type { CustomScript, Homebrew, Team } from '../../content'
import { gameText, registerHomebrew, scriptHomebrew } from '../../content'
import { markedCharacters } from '../../engine'
import { addLoose, game, grant, kill, token } from '../../engine/testing/board'
import { listed, nightOrders } from '../../store/scriptSheet'
import { nightEntries, seatCharacters } from './nightReference'

const table = () =>
  game()
    .seat('Ann', 'imp')
    .seat('Bob', 'poisoner')
    .seat('Cat', 'drunk', { shown: 'empath' })
    .seat('Dan', 'chef')
    .seat('Eve', 'sailor')
    .seat('Fay', 'monk')
    .seat('Gus', 'ravenkeeper')

const rows = (board: ReturnType<ReturnType<typeof table>['build']>['g'], night: 'first' | 'other', filter: 'inPlay' | 'all' = 'inPlay') =>
  nightEntries(board, night, nightOrders(board.script, listed(board.script, 'en'), 'en', marker => marker), gameText('en'), filter)
const ids = (entries: ReturnType<typeof rows>) => entries.map(entry => entry.id)

describe('the night reference', () => {
  test('in play keeps the markers and the recorded characters, in night order', () => {
    const { g } = table().build()
    const first = ids(rows(g, 'first'))
    expect(first.filter(id => ['dusk', 'minionInfo', 'demonInfo', 'dawn'].includes(id))).toEqual(['dusk', 'minionInfo', 'demonInfo', 'dawn'])
    expect(first).toContain('poisoner')
    expect(first).not.toContain('washerwoman')
    expect(ids(rows(g, 'first', 'all'))).toContain('washerwoman')
    const ordinals = rows(g, 'first').map(entry => entry.ordinal)
    expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b))
  })

  test('a character shown to a seat wakes in its place', () => {
    expect(ids(rows(table().build().g, 'first'))).toContain('empath')
    expect(ids(rows(game().seat('Cat', 'drunk').build().g, 'first'))).not.toContain('empath')
  })

  test('a seat sitting as another character under its global reminder keeps that character on the sheet', () => {
    const { g } = game({ kind: 'custom', name: 'Puppets', items: ['imp', 'chef', 'marionette'] })
      .seat('Ann', 'imp').seat('Bob', 'chef').add(token('storyteller', 'marionette/Is The Marionette', 'Bob')).build()
    const first = ids(rows(g, 'first'))
    expect(first).toContain('marionette')
    expect(first).toContain('chef')
  })

  test('a seat records its character, the one it was shown, the one its reminder marks and its abilities', () => {
    const { g, id } = game({ kind: 'custom', name: 'Puppets', items: ['imp', 'chef', 'drunk', 'empath', 'marionette', 'monk'] })
      .seat('Ann', 'drunk', { shown: 'empath' }).seat('Bob', 'chef').seat('Cat', 'imp')
      .add(token('storyteller', 'marionette/Is The Marionette', 'Bob'), grant('Bob', 'monk', 'storyteller')).build()
    const seat = (name: string) => g.seats.find(s => s.id === id(name))!
    expect(seatCharacters(seat('Ann'))).toEqual(['drunk', 'empath'])
    expect(seatCharacters(seat('Bob'))).toEqual(['chef', 'marionette', 'monk'])
    expect(seatCharacters(seat('Cat'))).toEqual(['imp'])
  })

  test('Is The Demon names Lil\' Monsta\'s babysitter, and its Dead names nobody', () => {
    const { g, id } = game({ kind: 'custom', name: 'Hunt', items: ['witch', 'lilmonsta', 'chef'] })
      .seat('Ann', 'witch').seat('Bob', 'witch').seat('Cat', 'chef')
      .add(addLoose('lilmonsta'), token('storyteller', 'lilmonsta/Is The Demon', 'Ann'), token('storyteller', 'lilmonsta/Dead', 'Cat')).build()
    const seat = (name: string) => g.seats.find(s => s.id === id(name))!
    expect(markedCharacters(seat('Ann'))).toEqual(['lilmonsta'])
    expect(markedCharacters(seat('Cat'))).toEqual([])
  })

  test('a seat or a loose Fabled the script does not list is slotted in at its ordinal', () => {
    const { g } = table().night(1, [addLoose('toymaker')]).build()
    const first = rows(g, 'first')
    for (const id of ['sailor', 'toymaker']) {
      const at = first.findIndex(entry => entry.id === id)
      expect(at).toBeGreaterThan(0)
      expect(first[at]!.instruction).not.toBe('')
      expect(first[at - 1]!.ordinal).toBeLessThanOrEqual(first[at]!.ordinal)
      expect(first[at + 1]!.ordinal).toBeGreaterThanOrEqual(first[at]!.ordinal)
    }
  })

  test('a dead seat keeps its character on the sheet', () => {
    const { g } = table().night(1, [kill('Dan')]).day().build()
    expect(ids(rows(g, 'first'))).toContain('chef')
  })

  test('below seven players, Travellers not counted, the evil team learns nothing', () => {
    const markers = (g: Parameters<typeof rows>[0]) => ids(rows(g, 'first', 'all')).filter(id => ['minionInfo', 'demonInfo'].includes(id))
    const six = () => game().seat('Ann', 'imp').seat('Bob', 'poisoner').seat('Cat', 'chef').seat('Dan', 'monk').seat('Eve', 'empath').seat('Fay', 'saint')
    expect(markers(six().build().g)).toEqual([])
    expect(markers(six().seat('Gil', 'thief').build().g)).toEqual([])
    expect(markers(six().seat('Gus', 'ravenkeeper').build().g)).toEqual(['minionInfo', 'demonInfo'])
  })

  test('homebrew characters after the same step wake in the order they were placed in, as on the script sheet', () => {
    // An Outsider placed after the Minions, all of them after dusk, on a script listing it first.
    const record = (id: string, team: Team, firstNight: number): Homebrew => ({ id, name: id, team, ability: 'x', firstNight, firstNightAfter: 'dusk' })
    const script: CustomScript = {
      kind: 'custom', name: 'Home', items: [{ id: '_meta', name: 'Home' }, record('owl', 'outsider', 0.875), record('hex', 'minion', 0.5), record('jinn', 'minion', 0.75)],
    }
    registerHomebrew(scriptHomebrew(script))
    try {
      const { g } = game(script).seat('Ann', 'owl').seat('Bob', 'hex').seat('Cat', 'jinn').build()
      expect(ids(rows(g, 'first')).slice(0, 4)).toEqual(['dusk', 'hex', 'jinn', 'owl'])
    } finally {
      registerHomebrew([])
    }
  })
})
