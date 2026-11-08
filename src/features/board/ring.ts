// The ring's placement, pure: where n seats sit on the ellipse the theme fits into the board's
// middle band (ringLayout fits the radii and token size). The seats are spaced by arc length rather
// than by angle, because on a phone's tall oval equal angles bunch the seats at the top and the
// bottom. Seat 0 sits at the top and the rest run clockwise, the way the players are seated
// from the Storyteller.
import type { Size } from '../../ui/theme'

export interface SeatPosition {
  readonly x: number // the token's centre, from the band's top left
  readonly y: number
  readonly angle: number // degrees of the outward normal, 0 to the right and 90 down, for the piece's outer side
}

// A direction turned part of the way toward another, in degrees, the short way round.
export const lean = (from: number, toward: number, weight: number): number =>
  from + weight * (((toward - from + 540) % 360) - 180)

// The outward direction a seat's reminders stack against, in degrees: they run the other way,
// into the ring. On a wide oval the lower stacks fan apart along the seat's normal, leaving room
// for the top seat's reminder below its name, and the rest face the centre to clear the names
// above them. On a tall oval the line to the centre runs steeply down the ring from a shoulder
// seat and would set its reminder as near the next seat as its own, while the oval's normal runs
// level; the stack leans halfway to the normal on the flanks, less toward the top and bottom,
// and not at all at the ends, where the normal swings sideways into a neighbour's reminders.
// It leans only as far as keeps the first reminder on its own side of the ring: a narrow ring
// of few large seats would otherwise meet the facing seat's stack in the middle.
export const stackAngle = (at: SeatPosition, centre: { readonly x: number; readonly y: number }, rx: number, ry: number,
  token: { readonly size: number; readonly chip: number }): number => {
  const radial = Math.atan2(at.y - centre.y, at.x - centre.x) * 180 / Math.PI
  if (rx > ry) return at.y - centre.y > ry / 2 ? at.angle : radial
  const dx = at.x - centre.x
  const reach = token.size / 2 + token.chip / 2 + 2
  const ownSide = (angle: number) => {
    const x = dx - Math.cos(angle * Math.PI / 180) * reach
    return Math.sign(x) === Math.sign(dx) && Math.abs(x) >= token.chip / 2 + 2
  }
  for (let weight = 0.5 * Math.sqrt(Math.max(0, 1 - Math.abs(at.y - centre.y) / Math.max(1, ry))); weight > 0; weight -= 0.05) {
    const angle = lean(radial, at.angle, weight)
    if (ownSide(angle)) return angle
  }
  return radial
}

// Enough samples that the arc between two is under a pixel on any screen we lay out for.
const samples = 720

// Parameters t on the ellipse at equal arc lengths, from the top (-90 degrees) clockwise. The
// cumulative chord length between samples stands in for the arc.
const alongTheArc = (rx: number, ry: number, n: number): readonly number[] => {
  if (n === 0) return []
  const start = -Math.PI / 2
  const lengths: number[] = [0]
  let prev = { x: rx * Math.cos(start), y: ry * Math.sin(start) }
  for (let i = 1; i <= samples; i++) {
    const t = start + (2 * Math.PI * i) / samples
    const next = { x: rx * Math.cos(t), y: ry * Math.sin(t) }
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(next.x - prev.x, next.y - prev.y))
    prev = next
  }
  const total = lengths[samples] ?? 0
  const out: number[] = []
  let cursor = 0
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n
    while (cursor < samples && (lengths[cursor + 1] ?? total) < target) cursor++
    // Interpolate inside the sample that holds the target so the seat lands on the arc itself.
    const a = lengths[cursor] ?? 0
    const b = lengths[cursor + 1] ?? total
    const frac = b > a ? (target - a) / (b - a) : 0
    out.push(start + (2 * Math.PI * (cursor + frac)) / samples)
  }
  return out
}

// The centres of n seats on the ellipse of radii rx, ry centred in the band.
export const seatPositions = (band: Size, rx: number, ry: number, seatCount: number): readonly SeatPosition[] => {
  const cx = band.width / 2
  const cy = band.height / 2
  return alongTheArc(rx, ry, seatCount).map((t) => {
    const x = cx + rx * Math.cos(t)
    const y = cy + ry * Math.sin(t)
    // The outer side is where the seat faces away from the centre: the normal, not the
    // parameter angle, so a seat on the flank of a tall oval still reads as left or right.
    const nx = rx === 0 ? Math.cos(t) : Math.cos(t) / rx
    const ny = ry === 0 ? Math.sin(t) : Math.sin(t) / ry
    const angle = ((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360
    return { x, y, angle }
  })
}

// The share of the seats' radii the vote arc runs on: inside the tokens and their reminders,
// outside the centred vote controls. On a narrow board it keeps at least three quarters of a
// token clear of the seat centres instead, so it never runs along a token's inner edge.
export const voteArcScale = 0.6
const voteArcClearance = 0.75

// The route of a count on an inner ellipse: it leaves the nominee, runs clockwise past every
// other seat and ends in an arrowhead back at the nominee, where the count closes. `reached` is
// the furthest seat with a recorded hand; `lit` is the share of the route up to it, by length,
// because on a tall oval the angle does not advance evenly with distance.
export const voteArc = (band: Size, rx: number, ry: number, tokenSize: number, seatCount: number, nominee: SeatPosition, reached?: SeatPosition) => {
  if (rx <= 0 || ry <= 0 || seatCount <= 0) return undefined
  const cx = band.width / 2
  const cy = band.height / 2
  const angle = (p: SeatPosition) => Math.atan2((p.y - cy) / ry, (p.x - cx) / rx)
  // A third of a seat's spacing on each side of the nominee, so the first voter is always past the start.
  const gap = (2 * Math.PI / Math.max(seatCount, 3)) / 3
  const from = angle(nominee) + gap
  const sweep = 2 * Math.PI - 2 * gap
  const inset = (r: number) => Math.max(r * 0.2, Math.min(r * voteArcScale, r - tokenSize * voteArcClearance))
  const xRadius = inset(rx)
  const yRadius = inset(ry)
  const point = (t: number) => ({ x: cx + xRadius * Math.cos(t), y: cy + yRadius * Math.sin(t) })
  const length = (to: number) => {
    let total = 0
    let prev = point(from)
    for (let i = 1; i <= 96; i++) {
      const next = point(from + (to - from) * i / 96)
      total += Math.hypot(next.x - prev.x, next.y - prev.y)
      prev = next
    }
    return total
  }
  const start = point(from)
  const end = point(from + sweep)
  const arrow = { ...end, angle: Math.atan2(yRadius * Math.cos(from + sweep), -xRadius * Math.sin(from + sweep)) * 180 / Math.PI }
  const path = `M ${start.x} ${start.y} A ${xRadius} ${yRadius} 0 1 1 ${end.x} ${end.y}`
  if (!reached) return { path, start, end, arrow, lit: 0 }
  // The nominee closes the count, so their own hand lights the whole route.
  const upTo = Math.min(sweep, ((angle(reached) - from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI))
  return { path, start, end, arrow, lit: length(from + upTo) / length(from + sweep) }
}
