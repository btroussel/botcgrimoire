import type { CharacterId } from '../../content'
import { openWells, shuffleWells, tapKey, tapWell } from './bluffWells'

const ids = (...names: readonly string[]) => names as readonly CharacterId[]
const choices = ids('chef', 'empath', 'monk', 'saint', 'recluse')
// The first index every time, which leaves the pool in a known order.
const first = () => 0

describe('the bluffs drawer\'s wells', () => {
  test('it opens with the saved bluffs still to be had, and rings the first empty well', () => {
    expect(openWells(ids('chef', 'washerwoman'), choices)).toEqual({ wells: ['chef', undefined, undefined], ring: 1 })
    expect(openWells([], choices)).toEqual({ wells: [undefined, undefined, undefined], ring: 0 })
    expect(openWells(ids('chef', 'empath', 'monk'), choices)).toEqual({ wells: ['chef', 'empath', 'monk'], ring: 0 })
    expect(openWells(ids('chef'), choices, 2).ring).toBe(2)
  })

  test('three keys fill three wells in order, and a fourth replaces the ringed one', () => {
    let state = openWells([], choices)
    for (const id of ids('chef', 'empath', 'monk')) state = tapKey(state, id)
    expect(state).toEqual({ wells: ['chef', 'empath', 'monk'], ring: 2 })
    expect(tapKey(state, 'saint' as CharacterId)).toEqual({ wells: ['chef', 'empath', 'saint'], ring: 2 })
  })

  test('a full well empties and rings, and a chosen key leaves its well', () => {
    const full = { wells: ids('chef', 'empath', 'monk'), ring: 2 }
    expect(tapWell(full, 0)).toEqual({ wells: [undefined, 'empath', 'monk'], ring: 0 })
    expect(tapKey(full, 'empath' as CharacterId)).toEqual({ wells: ['chef', undefined, 'monk'], ring: 1 })
    // A swap is three taps: the well, a key, then Save.
    expect(tapKey(tapWell(full, 1), 'saint' as CharacterId)).toEqual({ wells: ['chef', 'saint', 'monk'], ring: 1 })
  })

  test('shuffle keeps a hand pick and redraws all three only when none is empty', () => {
    const picked = tapKey(openWells([], choices), 'monk' as CharacterId)
    const filled = shuffleWells(picked, choices, first)
    expect(filled.wells[0]).toBe('monk')
    expect(new Set(filled.wells).size).toBe(3)
    expect(filled.wells.every((w) => w !== undefined && choices.includes(w))).toBe(true)
    const again = shuffleWells(filled, ids('saint', 'recluse', 'chef'), first)
    expect([...again.wells].sort()).toEqual(['chef', 'recluse', 'saint'])
  })

  test('shuffle leaves a well empty when the choices run out', () => {
    expect(shuffleWells(openWells([], ids('chef')), ids('chef'), first).wells).toEqual(['chef', undefined, undefined])
  })
})
