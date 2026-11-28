import type { CharacterId } from '../../content'
import { openPicks, shufflePicks, tapPick } from './bluffPicks'

const ids = (...names: readonly string[]) => names as readonly CharacterId[]
const choices = ids('chef', 'empath', 'monk', 'saint', 'recluse')
// The first index every time, which leaves the pool in a known order.
const first = () => 0

describe('the bluffs drawer\'s picks', () => {
  test('it opens with the saved bluffs, one that has since come into play included', () => {
    // The Washerwoman is no longer among the choices: the Demon was still shown it.
    expect(openPicks(ids('chef', 'washerwoman'))).toEqual(['chef', 'washerwoman'])
    expect(openPicks([])).toEqual([])
    expect(openPicks(ids('chef', 'empath', 'monk'))).toEqual(['chef', 'empath', 'monk'])
  })

  test('three keys are ticked in order, and a fourth waits for one to come off', () => {
    let picks = openPicks([])
    for (const id of ids('chef', 'empath', 'monk')) picks = tapPick(picks, id)
    expect(picks).toEqual(['chef', 'empath', 'monk'])
    expect(tapPick(picks, 'saint' as CharacterId)).toEqual(['chef', 'empath', 'monk'])
  })

  test('a ticked key comes back off, so a swap is two keys', () => {
    const full = ids('chef', 'empath', 'monk')
    expect(tapPick(full, 'empath' as CharacterId)).toEqual(['chef', 'monk'])
    expect(tapPick(tapPick(full, 'empath' as CharacterId), 'saint' as CharacterId)).toEqual(['chef', 'monk', 'saint'])
  })

  test('shuffle keeps a hand pick and redraws all three only once three are ticked', () => {
    const filled = shufflePicks(ids('monk'), choices, first)
    expect(filled[0]).toBe('monk')
    expect(new Set(filled).size).toBe(3)
    expect(filled.every((id) => choices.includes(id))).toBe(true)
    const again = shufflePicks(filled, ids('saint', 'recluse', 'chef'), first)
    expect([...again].sort()).toEqual(['chef', 'recluse', 'saint'])
  })

  test('shuffle keeps a saved bluff now in play while it fills, and lets it go on a redraw', () => {
    expect(shufflePicks(ids('washerwoman'), choices, first)).toHaveLength(3)
    expect(shufflePicks(ids('washerwoman'), choices, first)[0]).toBe('washerwoman')
    expect(shufflePicks(ids('washerwoman', 'chef', 'monk'), choices, first)).not.toContain('washerwoman')
  })

  test('shuffle stops short when the choices run out', () => {
    expect(shufflePicks([], ids('chef'), first)).toEqual(['chef'])
  })
})
