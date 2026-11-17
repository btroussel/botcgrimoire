import { countStartBetween, countStartOnRing, lean, seatPositions } from './ring'

// A worked example: a 390 x 527 middle band on a 390 x 844 phone, and a margin of 90, gives
// radii of 105 and 173.5.
const band = { width: 390, height: 527 }
const margin = 90
const rx = band.width / 2 - margin
const ry = band.height / 2 - margin

describe('seat positions on the ring', () => {
  test('a lean turns part of the way toward another direction, the short way round', () => {
    expect(lean(0, 90, 0.5)).toBeCloseTo(45)
    expect(lean(-72, -18, 0.5)).toBeCloseTo(-45)
    expect(lean(170, -170, 0.5)).toBeCloseTo(180)
    expect(lean(10, 80, 0)).toBeCloseTo(10)
    expect(lean(10, 80, 1)).toBeCloseTo(80)
  })

  test('a count starts on the ring halfway to the next seat, pointing round to it', () => {
    const centre = { x: band.width / 2, y: band.height / 2 }
    for (const count of [5, 7, 20]) {
      const seats = seatPositions(band, rx, ry, count)
      for (let nominee = 0; nominee < count; nominee++) {
        const from = seats[nominee]!
        const to = seats[(nominee + 1) % count]!
        const mark = countStartOnRing(band, rx, ry, count, nominee)!
        // On the ellipse through the seats' centres, nearer each of the two seats than any other.
        expect(((mark.x - centre.x) / rx) ** 2 + ((mark.y - centre.y) / ry) ** 2).toBeCloseTo(1)
        const distance = (p: { x: number; y: number }) => Math.hypot(mark.x - p.x, mark.y - p.y)
        const nearest = seats.map(distance).sort((a, b) => a - b)
        expect(nearest.slice(0, 2)).toEqual(expect.arrayContaining([distance(from), distance(to)]))
        const a = mark.angle * Math.PI / 180
        expect(Math.cos(a) * (to.x - from.x) + Math.sin(a) * (to.y - from.y)).toBeGreaterThan(0)
      }
    }
    expect(countStartOnRing(band, rx, ry, 1, 0)).toBeUndefined()
    expect(countStartOnRing(band, rx, ry, 5, -1)).toBeUndefined()
    expect(countStartBetween({ x: 0, y: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 5, angle: 90 })
  })

  test('one position per seat, the first at the top and the rest clockwise', () => {
    const seats = seatPositions(band, rx, ry, 8)
    expect(seats).toHaveLength(8)
    const top = seats[0]!
    expect(top.x).toBeCloseTo(band.width / 2, 5)
    expect(top.y).toBeCloseTo(margin, 5)
    // Clockwise in screen coordinates: the second seat is to the right of the first.
    expect(seats[1]!.x).toBeGreaterThan(top.x)
    // Half way round is the bottom.
    expect(seats[4]!.y).toBeCloseTo(band.height - margin, 5)
  })

  test('every seat stays inside the band with the outer margin free', () => {
    for (const n of [5, 12, 20]) {
      for (const s of seatPositions(band, rx, ry, n)) {
        expect(s.x).toBeGreaterThanOrEqual(margin - 1e-6)
        expect(s.x).toBeLessThanOrEqual(band.width - margin + 1e-6)
        expect(s.y).toBeGreaterThanOrEqual(margin - 1e-6)
        expect(s.y).toBeLessThanOrEqual(band.height - margin + 1e-6)
      }
    }
  })

  test('seats are spaced by arc length, so neighbours on a tall oval are evenly apart', () => {
    const seats = seatPositions(band, rx, ry, 12)
    const gaps = seats.map((s, i) => {
      const next = seats[(i + 1) % seats.length]!
      return Math.hypot(next.x - s.x, next.y - s.y)
    })
    // Chords of equal arcs differ only by the curvature, a few percent on this oval.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.1)
  })

  test('the outer side follows the normal: the ends face up and down, the flanks left and right', () => {
    const sides = seatPositions(band, rx, ry, 4).map((s) => Math.round(s.angle))
    expect(sides).toEqual([270, 0, 90, 180])
  })

  test('a seat on the flank of the oval faces sideways even where the parameter angle would not', () => {
    // On a circle the sixth of twelve seats is at 60 degrees; on this oval it still faces right.
    const seats = seatPositions(band, rx, ry, 12)
    const flank = seats[2]!
    const fromRight = Math.min(flank.angle, 360 - flank.angle)
    expect(fromRight).toBeLessThan(45)
  })

  test('no seats is an empty ring', () => {
    expect(seatPositions(band, rx, ry, 0)).toEqual([])
  })
})
