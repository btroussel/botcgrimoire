import { describe, expect, test } from 'vitest'

import { bagToken, dragTo, grab, hitPile, joltPile, letGo, openPile, stepPile, tossPile, wakePile } from './bagPile'
import type { Pile } from './bagPile'
import { screenAxes, shakePush } from './shake'

// The same heap every run.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const radius = 115
const heap = (count: number, seed = 1) => openPile([...Array(count).keys()], radius, bagToken(radius, count), seeded(seed))
const where = (pile: Pile) => pile.discs.map(d => `${d.at}:${d.x.toFixed(3)},${d.y.toFixed(3)}`).sort().join(' ')
const order = (pile: Pile) => [...pile.discs].sort((a, b) => a.z - b.z).map(d => d.at)
const settle = (pile: Pile) => { for (let i = 0; i < 2000 && !pile.asleep; i++) stepPile(pile) }

describe('the open bag', () => {
  test('opens on a heap at rest, inside the mouth, no two discs more than half hidden by each other', () => {
    for (let count = 1; count <= 20; count++) {
      const pile = heap(count, count)
      expect(pile.asleep).toBe(true)
      expect(pile.discs).toHaveLength(count)
      for (const [i, a] of pile.discs.entries()) {
        expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(radius - pile.token * 0.32 + 0.01)
        for (const b of pile.discs.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(pile.token * 0.5)
      }
    }
  })

  test('twenty tokens stay large enough to tap', () => {
    // The mouth's radius is 42% of the bag's room: 288 points on a 320-point phone, 254 on a
    // phone on its side.
    expect(bagToken(288 * 0.42, 20)).toBeGreaterThan(56)
    expect(bagToken(254 * 0.42, 20)).toBeGreaterThan(52)
  })

  test('a heap left alone never creeps, even when woken', () => {
    const pile = heap(15)
    const before = where(pile)
    wakePile(pile)
    for (let i = 0; i < 600; i++) stepPile(pile)
    expect(where(pile)).toBe(before)
    expect(pile.asleep).toBe(true)
  })

  test('a finger lands on the highest disc under it', () => {
    const pile = heap(12)
    for (const d of pile.discs) {
      const hit = hitPile(pile, d.x, d.y)!
      const under = pile.discs.filter(o => Math.hypot(o.x - d.x, o.y - d.y) < pile.token * 0.48)
      expect(hit.z).toBe(Math.max(...under.map(o => o.z)))
    }
    expect(hitPile(pile, radius * 3, 0)).toBeUndefined()
  })

  test('a slid disc rides over the others and nothing else changes layer', () => {
    const pile = heap(12, 4)
    const carried = pile.discs[0]!
    const others = order(pile).filter(at => at !== carried.at)
    grab(pile, carried)
    for (let i = 0; i <= 60; i++) { dragTo(pile, -radius * 0.7 + i * radius * 0.025, Math.sin(i / 8) * 20); stepPile(pile) }
    letGo(pile)
    settle(pile)
    expect(order(pile).at(-1)).toBe(carried.at)
    expect(order(pile).filter(at => at !== carried.at)).toEqual(others)
    expect(pile.asleep).toBe(true)
  })

  test('a shake moves the heap and a hard one throws a low disc on top, then all comes to rest', () => {
    const pile = heap(10, 3)
    const random = seeded(9)
    const before = where(pile)
    joltPile(pile, 3, -2, 20, random)
    tossPile(pile, random)
    settle(pile)
    expect(where(pile)).not.toBe(before)
    expect(pile.asleep).toBe(true)
  })
})

describe('shaking the phone', () => {
  test('handing the phone over moves nothing, a shake pushes the bag the other way', () => {
    expect(shakePush(1.5, -1.2)).toBeUndefined()
    const push = shakePush(10, 0)!
    expect(push.fx).toBeLessThan(0)
    expect(push.fy).toBeCloseTo(0)
    expect(push.strength).toBe(10)
  })

  test('the phone\'s axes turn with the screen', () => {
    // Upright: the device's up is the page's up, so its y flips.
    expect(screenAxes(1, 2, 0).map(v => +v.toFixed(6))).toEqual([1, -2])
    // Turned a quarter anticlockwise: the device's top points to the page's left.
    expect(screenAxes(1, 2, 90).map(v => +v.toFixed(6))).toEqual([-2, -1])
  })
})
