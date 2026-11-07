import { expect, test, vi } from 'vitest'

import { reminderSize, reminderStack } from '../../ui/reminderStack'
import { boardGeometry } from './boardGeometry'
import { stackAngle } from './ring'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

// A default name such as "Seat 20" measures about 50 points at the seat name size.
const nameHalfWidth = 25

test('on an upright phone each seat\'s first reminder clears every other seat\'s name and first reminder', () => {
  for (const [width, height] of [[390, 844], [414, 896]] as const) {
    for (let seats = 9; seats <= 20; seats++) {
      const { ring } = boardGeometry({ width, height, landscape: false, live: true, reserved: 40, toolbar: { width: 94, height: 50 },
        bluffs: { width: 190, height: 76 }, clockHeight: 68, seats, strip: 0 })
      const { size, positions, band, rx, ry } = ring
      const centre = { x: band.width / 2, y: band.height / 2 }
      const nameHeight = size >= 64 ? 16 : 14
      const firsts = positions.map(at => {
        const { chipSize, points } = reminderStack(size, stackAngle(at, centre, rx, ry, { size, chip: reminderSize(size) }), 1, false)
        return { x: at.x + points[0]!.x, y: at.y + points[0]!.y, r: chipSize / 2 }
      })
      firsts.forEach((reminder, i) => {
        positions.forEach((seat, j) => {
          if (i === j) return
          const top = seat.y + size / 2 + 2
          const dx = Math.max(seat.x - nameHalfWidth - reminder.x, 0, reminder.x - seat.x - nameHalfWidth)
          const dy = Math.max(top - reminder.y, 0, reminder.y - top - nameHeight)
          expect(Math.hypot(dx, dy), `${width}x${height}, ${seats} seats: seat ${i + 1}'s reminder on seat ${j + 1}'s name`).toBeGreaterThanOrEqual(reminder.r - 1)
          const other = firsts[j]!
          expect(Math.hypot(reminder.x - other.x, reminder.y - other.y), `${width}x${height}, ${seats} seats: seats ${i + 1} and ${j + 1}`)
            .toBeGreaterThanOrEqual(reminder.r + other.r - 0.5)
        })
      })
    }
  }
})
