// Seats laid where the players sit in the room rather than on the circle, pure. A placed seat keeps
// its share of the band, so a layout made upright still reads on a turned phone, and the seats
// left alone keep their slot on the circle. Tokens keep the size the circle fitted, so placing one
// never shrinks the others. Placing a seat never changes the order: who sits next to whom is the
// Storyteller's to set by swapping seats or moving one into a gap, since a token dropped across a
// half-arranged room would otherwise pick its neighbours from where the others happen to be.
import type { Place } from '../../engine'
import type { Size } from '../../ui/theme'
import type { SeatPosition } from './ring'
import { voteArcScale } from './ring'
import { nameHeightAt, seatsClear } from './ringLayout'
import type { BoardControlBounds, CentreBox, RingGeometry, SeatMetrics } from './ringLayout'

export interface Point {
  readonly x: number
  readonly y: number
}

// How far a drop may be nudged to clear a token or a control, in token sizes. Further than this
// the jump would surprise more than the overlap, so the token stays where it was let go.
const nudgeReach = 1.5
// The search's step, in points.
const nudgeStep = 4

export const isFree = (places: readonly (Place | undefined)[]): boolean => places.some(place => place !== undefined)

// The token, its name and the gap around them.
const footprint = (at: Point, size: number, metrics: SeatMetrics) => ({
  left: at.x - size / 2 - metrics.nameOverhang,
  right: at.x + size / 2 + metrics.nameOverhang,
  top: at.y - size / 2,
  bottom: at.y + size / 2 + metrics.nameGap + nameHeightAt(metrics, size),
})

// The nearest point that keeps the token and its name inside the band.
export const keepInside = (at: Point, band: Size, size: number, metrics: SeatMetrics): Point => {
  const box = footprint({ x: 0, y: 0 }, size, metrics)
  const clamp = (value: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.max(low, Math.min(high, value))
  return {
    x: clamp(at.x, metrics.padding - box.left, band.width - metrics.padding - box.right),
    y: clamp(at.y, metrics.padding - box.top, band.height - metrics.padding - box.bottom),
  }
}

// The middle of the room: the centre of the box around the seats, which a sofa along one wall
// pulls less than the seats' average would.
export const layoutCentre = (points: readonly Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

// Where each seat is drawn, its `angle` facing away from the middle of the room so its reminders
// stack toward it. With no seat placed it is the circle as fitted.
export const layoutPositions = (geometry: Pick<RingGeometry, 'band' | 'size' | 'positions'>,
  places: readonly (Place | undefined)[], metrics: SeatMetrics): readonly SeatPosition[] => {
  if (!isFree(places)) return geometry.positions
  const { band, size } = geometry
  const points = geometry.positions.map((at, i) => {
    const place = places[i]
    return place ? keepInside({ x: place.x * band.width, y: place.y * band.height }, band, size, metrics) : at
  })
  const centre = layoutCentre(points)
  return points.map(p => {
    const outward = Math.hypot(p.x - centre.x, p.y - centre.y) < 1 ? 90 : Math.atan2(p.y - centre.y, p.x - centre.x) * 180 / Math.PI
    return { x: p.x, y: p.y, angle: (outward + 360) % 360 }
  })
}

// A point on the band as the share a placeSeat records, to four places: a tenth of a point on
// the widest board.
export const toPlace = (at: Point, band: Size): Place => {
  const share = (value: number, of: number) => of > 0 ? Math.round(Math.max(0, Math.min(1, value / of)) * 1e4) / 1e4 : 0.5
  return { x: share(at.x, band.width), y: share(at.y, band.height) }
}

// The spot nearest a drop where the token and its name cover no other token or name and no
// control, inside the band. Rings of candidates widen from the drop, so the first clear one is
// the nearest. With none near enough it may cover a token, never a control, and failing that
// too the token stays where it was let go.
export const settle = (at: Point, others: readonly Point[], band: Size, size: number, metrics: SeatMetrics,
  obstacles: readonly BoardControlBounds[]): Point => {
  const clear = seatsClear(metrics, size)
  const clearOfControls = (p: Point) => {
    const box = footprint(p, size, metrics)
    return obstacles.every(control =>
      box.right + metrics.gap <= control.left || box.left - metrics.gap >= control.left + control.width ||
      box.bottom + metrics.gap <= control.top || box.top - metrics.gap >= control.top + control.height)
  }
  const dropped = keepInside(at, band, size, metrics)
  const nearest = (fits: (p: Point) => boolean) => {
    for (let r = 0; r <= size * nudgeReach; r += nudgeStep) {
      const steps = r === 0 ? 1 : Math.max(8, Math.ceil(2 * Math.PI * r / nudgeStep))
      for (let k = 0; k < steps; k++) {
        // From straight up round, so of two equal spots the one above the finger wins.
        const turn = -Math.PI / 2 + 2 * Math.PI * k / steps
        const p = keepInside({ x: dropped.x + r * Math.cos(turn), y: dropped.y + r * Math.sin(turn) }, band, size, metrics)
        if (fits(p)) return p
      }
    }
    return undefined
  }
  return nearest(p => clearOfControls(p) && others.every(other => clear(p, other))) ?? nearest(clearOfControls) ?? dropped
}

// Where a box of this width and at least this height sits across the room's middle, clear of
// every token: the tallest of the centre boxes that is wide enough. Undefined when none is.
export const centreSpot = (boxes: readonly CentreBox[], width: number, height: number): Point | undefined => {
  const roomy = boxes.filter(box => box.width >= width && box.height >= height)
  if (roomy.length === 0) return undefined
  const best = roomy.reduce((a, b) => b.height > a.height ? b : a)
  return { x: best.left + best.width / 2, y: best.top + best.height / 2 }
}

// The count's route on a placed board: from the nominee through every seat in the order a vote
// runs, back to the nominee, drawn inside the seats toward the middle of the room as the circle's
// arc is. A quadratic curve per seat, bent toward that seat and joining its neighbours halfway,
// so the route turns smoothly whatever shape the room is. `lit` is the share of its length up to
// the reached seat, the nominee's own hand lighting it all.
export const voteRoute = (points: readonly Point[], tokenSize: number, nominee: number, reached?: number) => {
  const n = points.length
  if (n < 2 || nominee < 0 || nominee >= n) return undefined
  const centre = layoutCentre(points)
  const inset = (p: Point) => {
    const d = Math.hypot(p.x - centre.x, p.y - centre.y)
    if (d === 0) return p
    const k = Math.max(d * 0.2, Math.min(d * voteArcScale, d - tokenSize * 0.75)) / d
    return { x: centre.x + (p.x - centre.x) * k, y: centre.y + (p.y - centre.y) * k }
  }
  const q = (i: number) => inset(points[(nominee + i) % n]!)
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const start = mid(q(0), q(1))
  const curves = Array.from({ length: n - 1 }, (_, k) => {
    const i = k + 1
    return { from: i === 1 ? start : mid(q(i - 1), q(i)), control: q(i), to: mid(q(i), q(i + 1)) }
  })
  const at = (c: (typeof curves)[number], t: number) => ({
    x: (1 - t) ** 2 * c.from.x + 2 * (1 - t) * t * c.control.x + t ** 2 * c.to.x,
    y: (1 - t) ** 2 * c.from.y + 2 * (1 - t) * t * c.control.y + t ** 2 * c.to.y,
  })
  const length = (c: (typeof curves)[number], upTo = 1) => {
    let total = 0
    let previous = c.from
    for (let s = 1; s <= 16; s++) {
      const next = at(c, upTo * s / 16)
      total += Math.hypot(next.x - previous.x, next.y - previous.y)
      previous = next
    }
    return total
  }
  const last = curves.at(-1)!
  const path = `M ${start.x} ${start.y} ` + curves.map(c => `Q ${c.control.x} ${c.control.y} ${c.to.x} ${c.to.y}`).join(' ')
  const end = last.to
  const arrow = { ...end, angle: Math.atan2(end.y - last.control.y, end.x - last.control.x) * 180 / Math.PI }
  if (reached === undefined || reached < 0 || reached >= n) return { path, start, end, arrow, lit: 0 }
  const steps = (reached - nominee + n) % n
  if (steps === 0) return { path, start, end, arrow, lit: 1 }
  const total = curves.reduce((sum, c) => sum + length(c), 0)
  // The route passes a seat halfway along its curve.
  const upTo = curves.slice(0, steps - 1).reduce((sum, c) => sum + length(c), 0) + length(curves[steps - 1]!, 0.5)
  return { path, start, end, arrow, lit: total > 0 ? upTo / total : 0 }
}
