import type { CustomScript, Homebrew, Team } from '../content'
import { sheetOrder } from './reference'

// A script of nothing but homebrew, listed as the composer lists it: the Outsider before the Minions.
const record = (id: string, team: Team, firstNight: number): Homebrew => ({ id, name: id, team, ability: 'x', firstNight, firstNightAfter: 'dusk' })
const script = (owl: number): CustomScript => ({
  kind: 'custom', name: 'Home', items: [{ id: '_meta', name: 'Home' }, record('owl', 'outsider', owl), record('hex', 'minion', 0.5), record('jinn', 'minion', 0.75)],
})
const characters = (s: CustomScript) => sheetOrder(s, 'first').flatMap((step) => (step.kind === 'character' ? [step.character] : []))

describe('the sheet order', () => {
  test('wakes homebrew characters after the same step in the order they were placed in', () => {
    expect(characters(script(0.875))).toEqual(['hex', 'jinn', 'owl'])
    expect(characters(script(0.625))).toEqual(['hex', 'owl', 'jinn'])
    expect(sheetOrder(script(0.875), 'first').slice(0, 5).map((step) => (step.kind === 'marker' ? step.marker : step.character)))
      .toEqual(['dusk', 'hex', 'jinn', 'owl', 'minionInfo'])
  })

  test('keeps the script\'s order for two saved at one place', () => {
    expect(characters(script(0.5))).toEqual(['owl', 'hex', 'jinn'])
  })
})
