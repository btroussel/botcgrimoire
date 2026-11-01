import { expect, test, vi } from 'vitest'

import { boardGeometry, toolbarHeight } from './boardGeometry'
import type { BoardMeasures } from './boardGeometry'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

const board = (measures: Partial<BoardMeasures>): BoardMeasures => ({
  width: 390, height: 844, landscape: false, live: true, reserved: 40,
  toolbar: { width: 94, height: 50 }, bluffs: { width: 190, height: 62 }, clockHeight: 68,
  seats: 20, strip: 0, ...measures,
})

// Each seat's token and name in board coordinates, as the ring draws them under the top band.
const seatBoxes = (g: ReturnType<typeof boardGeometry>) => g.ring.positions.map(at => ({
  left: at.x - g.ring.size / 2 - 8, right: at.x + g.ring.size / 2 + 8,
  top: g.topBandHeight + at.y - g.ring.size / 2, bottom: g.topBandHeight + at.y + g.ring.size / 2 + 2 + 14,
}))
const clear = (box: ReturnType<typeof seatBoxes>[number], control: { left: number; top: number; width: number; height: number }) =>
  box.right <= control.left || box.left >= control.left + control.width || box.bottom <= control.top || box.top >= control.top + control.height

test('a phone in portrait clears the toolbar and keeps the status band whole', () => {
  for (const seats of [5, 20]) {
    const g = boardGeometry(board({ seats }))
    expect(g.fitted).toBe(true)
    expect(g.columnWidth).toBe(350)
    const toolbar = { left: 390 - 12 - 94, top: 12, width: 94, height: 50 }
    for (const box of seatBoxes(g)) {
      expect(clear(box, toolbar)).toBe(true)
      expect(box.bottom).toBeLessThanOrEqual(844 - g.statusHeight)
    }
  }
})

test('a phone in landscape clears the bluffs and the status plaque', () => {
  const g = boardGeometry(board({ width: 844, height: 390, landscape: true }))
  expect(g.fitted).toBe(true)
  const bluffs = { left: 12, top: 390 - 12 - 62, width: 190, height: 62 }
  const plaque = { left: 844 - 12 - g.clockWidth, top: 390 - 12 - 68, width: g.clockWidth, height: 68 }
  for (const box of seatBoxes(g)) {
    expect(clear(box, bluffs)).toBe(true)
    expect(clear(box, plaque)).toBe(true)
  }
})

test('an open reference on a wide screen narrows the ring to the column it leaves', () => {
  const closed = boardGeometry(board({ width: 1280, height: 800, landscape: true }))
  const open = boardGeometry(board({ width: 1280, height: 800, landscape: true, reserved: 520 }))
  expect(open.columnWidth).toBe(760)
  expect(open.band.width).toBeLessThanOrEqual(760)
  expect(open.seatsRight).toBeLessThanOrEqual(760)
  expect(open.seatsRight).toBeLessThan(closed.seatsRight)
})

test('replay keeps full bands and takes no width for the reference', () => {
  const g = boardGeometry(board({ live: false, strip: 2 }))
  expect(g.fitted).toBe(false)
  expect(g.columnWidth).toBe(390)
  expect(g.topBandHeight).toBe(toolbarHeight)
  expect(g.band).toEqual({ width: 390, height: 844 - toolbarHeight - g.statusHeight - g.utilitiesHeight })
  expect(g.utilitiesHeight).toBeGreaterThan(0)
})
