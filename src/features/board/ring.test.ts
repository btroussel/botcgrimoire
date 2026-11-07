import { halfway, seatPositions, voteArc, voteArcScale } from './ring'

// A worked example: a 390 x 527 middle band on a 390 x 844 phone, and a margin of 90, gives
// radii of 105 and 173.5.
const band = { width: 390, height: 527 }
const margin = 90
const rx = band.width / 2 - margin
const ry = band.height / 2 - margin

describe('seat positions on the ring', () => {
  test('halfway between two directions takes the short way round', () => {
    expect(halfway(0, 90)).toBeCloseTo(45)
    expect(halfway(-72, -18)).toBeCloseTo(-45)
    expect(Math.abs(halfway(170, -170))).toBeCloseTo(180)
    expect(halfway(100, 100)).toBeCloseTo(100)
  })

  test('the vote arc runs clockwise from the nominee round to an arrowhead back at them', () => {
    const inner = (p: { x: number; y: number }) => ({ x: band.width / 2 + (p.x - band.width / 2) * voteArcScale, y: band.height / 2 + (p.y - band.height / 2) * voteArcScale })
    for (const count of [5, 7, 20]) {
      const seats = seatPositions(band, rx, ry, count)
      for (let nominee = 0; nominee < count; nominee++) {
        const at = seats[nominee]!
        const arc = voteArc(band, rx, ry, 0, count, at)!
        expect(arc.lit).toBe(0)
        // Both ends sit near the nominee, either side of them, clear of each other.
        const home = inner(at)
        expect(Math.hypot(arc.start.x - home.x, arc.start.y - home.y)).toBeGreaterThan(1)
        expect(Math.hypot(arc.end.x - home.x, arc.end.y - home.y)).toBeGreaterThan(1)
        const tangentX = -rx * (at.y - band.height / 2) / ry
        const tangentY = ry * (at.x - band.width / 2) / rx
        const a = arc.arrow.angle * Math.PI / 180
        expect(Math.cos(a) * tangentX + Math.sin(a) * tangentY).toBeGreaterThan(0)
      }
    }
  })

  test('the arc lights up clockwise to the furthest hand, and fully at the nominee', () => {
    const count = 8
    const seats = seatPositions(band, rx, ry, count)
    const nominee = 6
    const lit = [1, 2, 3, 4, 5, 6, 7].map(step => voteArc(band, rx, ry, 0, count, seats[nominee]!, seats[(nominee + step) % count])!.lit)
    for (let i = 1; i < lit.length; i++) expect(lit[i]!).toBeGreaterThan(lit[i - 1]!)
    expect(lit[0]!).toBeGreaterThan(0)
    expect(voteArc(band, rx, ry, 0, count, seats[nominee]!, seats[nominee])!.lit).toBeCloseTo(1)
    expect(voteArc(band, 0, ry, 0, count, seats[0]!)).toBeUndefined()
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
