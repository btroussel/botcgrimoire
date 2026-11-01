import { describe, expect, test, vi } from 'vitest'

import { placeSeatMenu } from './seatMenu'
import type { Point, SeatMenuPlace } from './seatMenu'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

const menu = { width: 168, height: 280 }
const size = 72
// A whole band in view, its ring centred on it.
const on = (band: { width: number; height: number }) => ({
  centre: { x: band.width / 2, y: band.height / 2 }, room: { left: 0, top: 0, right: band.width, bottom: band.height },
})
const overlaps = (place: SeatMenuPlace, at: Point, half: number) => place.left < at.x + half && place.left + menu.width > at.x - half
  && place.top < at.y + half && place.top + menu.height > at.y - half

describe('where a seat menu opens', () => {
  test('beside the token on the right when that side has room and covers nothing', () => {
    const band = { width: 1000, height: 700 }
    expect(placeSeatMenu({ at: { x: 200, y: 350 }, size, ...on(band), menu, others: [] })).toEqual({ left: 244, top: 210 })
  })

  test('on the left when the right runs off the band', () => {
    const band = { width: 1000, height: 700 }
    expect(placeSeatMenu({ at: { x: 900, y: 350 }, size, ...on(band), menu, others: [] })).toEqual({ left: 688, top: 210 })
  })

  test('below the top seat, under its name, when neither side has room on a phone', () => {
    const band = { width: 320, height: 520 }
    const at = { x: 160, y: 60 }
    const place = placeSeatMenu({ at, size, ...on(band), menu, others: [] })
    expect(place.left).toBe(76)
    expect(place.top).toBeGreaterThanOrEqual(at.y + size / 2 + 16)
    expect(overlaps(place, at, size / 2)).toBe(false)
  })

  test('above the bottom seat, toward the centre', () => {
    const band = { width: 320, height: 520 }
    const at = { x: 160, y: 460 }
    const place = placeSeatMenu({ at, size, ...on(band), menu, others: [] })
    expect(place.top + menu.height).toBeLessThanOrEqual(at.y - size / 2)
  })

  test('off a side that would hide a neighbour it could nominate', () => {
    const band = { width: 390, height: 700 }
    const at = { x: 280, y: 120 }
    const neighbour = { x: 100, y: 130 }
    const place = placeSeatMenu({ at, size, ...on(band), menu, others: [neighbour, { x: 60, y: 350 }, { x: 330, y: 560 }] })
    expect(overlaps(place, neighbour, size / 4)).toBe(false)
    expect(overlaps(place, at, size / 2)).toBe(false)
    expect(place.top).toBeGreaterThan(at.y)
  })

  test('toward the middle of a narrow ring, grazing the flank seats rather than hiding them', () => {
    const band = { width: 390, height: 760 }
    const at = { x: 258, y: 180 }
    const others = [{ x: 175, y: 70 }, { x: 88, y: 170 }, { x: 52, y: 310 }, { x: 283, y: 310 }, { x: 52, y: 440 }, { x: 283, y: 440 }]
    const place = placeSeatMenu({ at, size: 88, ...on(band), menu: { width: 168, height: 300 }, others })
    expect(place.left).toBe(90)
    expect(place.top).toBeGreaterThan(at.y + 44)
  })

  test('as clear of its token as a cramped board allows', () => {
    const band = { width: 280, height: 480 }
    const at = { x: 211, y: 134 }
    const others = [{ x: 140, y: 60 }, { x: 228, y: 240 }, { x: 211, y: 346 }, { x: 140, y: 420 }, { x: 69, y: 346 }, { x: 52, y: 240 }, { x: 69, y: 134 }]
    const place = placeSeatMenu({ at, size: 64, ...on(band), menu: { width: 168, height: 323 }, others })
    expect(place.left + 168).toBeLessThanOrEqual(at.x - 32)
  })

  test('inside the part of the band a keyboard leaves in view', () => {
    const at = { x: 120, y: 700 }
    const room = { left: 0, top: 80, right: 350, bottom: 430 }
    const place = placeSeatMenu({ at, size, centre: { x: 175, y: 378 }, room, menu, others: [] })
    expect(place.top).toBeGreaterThanOrEqual(room.top)
    expect(place.top + menu.height).toBeLessThanOrEqual(room.bottom)
  })

  test('over other seats rather than over its own token when nothing is clear', () => {
    const band = { width: 320, height: 420 }
    const at = { x: 160, y: 60 }
    const others = [{ x: 60, y: 200 }, { x: 260, y: 200 }, { x: 160, y: 250 }, { x: 60, y: 60 }, { x: 260, y: 60 }]
    const place = placeSeatMenu({ at, size, ...on(band), menu, others })
    expect(overlaps(place, at, size / 2)).toBe(false)
  })
})
