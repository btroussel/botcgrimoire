import type { Size } from '../../ui/theme'
import { seatPositions } from './ring'

export interface SeatMetrics {
  readonly maximum: number
  readonly minimum: number
  readonly nameOverhang: number
  readonly nameGap: number
  readonly nameHeight: number
  readonly padding: number
  readonly gap: number
}

// Check circular tokens and rectangular labels separately so diagonal neighbours can
// use the space beside a disc without covering its name.
export const fitRing = (viewport: Size, count: number, metrics: SeatMetrics) => {
  const { maximum, minimum, nameOverhang, nameGap, nameHeight, padding, gap } = metrics
  const candidate = (band: Size, size: number) => {
    const halfWidth = size / 2 + nameOverhang
    const below = size / 2 + nameGap + nameHeight
    const ry = Math.max(0, band.height / 2 - below - padding)
    const rx = Math.max(0, band.width / 2 - halfWidth - padding)
    const positions = seatPositions(band, rx, ry, count)
    const discClearsName = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      const top = q.y + size / 2 + nameGap
      const dx = Math.max(0, Math.abs(p.x - q.x) - halfWidth)
      const dy = Math.max(top - p.y, 0, p.y - top - nameHeight)
      return Math.hypot(dx, dy) >= size / 2 + gap
    }
    // Large discs can fit a shallow oval by alternating between its two sides. Leave
    // a touch target between the upper names and lower discs before accepting that size.
    const openCentre = count < 3 || band.width <= band.height ||
      2 * ry - size - nameGap - nameHeight >= minimum
    const clear = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y) >= size + gap &&
      (Math.abs(p.x - q.x) >= size + 2 * nameOverhang + gap || Math.abs(p.y - q.y) >= nameHeight + gap) &&
      discClearsName(p, q) && discClearsName(q, p)
    // Every pair once, by index: this runs for each size and margin step the board tries.
    const fits = openCentre && positions.every((p, i) => {
      if (!(p.x - halfWidth >= padding - 0.01 && p.x + halfWidth <= band.width - padding + 0.01 &&
        p.y - size / 2 >= padding - 0.01 && p.y + below <= band.height - padding + 0.01)) return false
      for (let j = i + 1; j < positions.length; j++) if (!clear(p, positions[j]!)) return false
      return true
    })
    return { band, size, rx, ry, positions, fits }
  }
  for (let size = maximum; size >= minimum; size -= 4) {
    const result = candidate(viewport, size)
    if (result.fits) return result
  }
  // On short screens keep seats readable and let the seating area scroll vertically.
  // Keep the opposite sides far enough apart even in a very narrow viewport.
  let width = Math.max(viewport.width, 2 * (minimum + 2 * nameOverhang) + gap + 2 * padding)
  let height = Math.max(viewport.height, minimum + nameGap + nameHeight + 2 * padding)
  for (;;) {
    const result = candidate({ width, height }, minimum)
    if (result.fits) return result
    height += 32
    // A near-zero width cannot fit both sides of an oval, however tall it gets.
    if (height > width * 4) width += 32
  }
}

export type RingGeometry = ReturnType<typeof fitRing>

export interface BoardControlBounds extends Size {
  readonly left: number
  readonly top: number
}

// Corner controls need clearance only where a seat actually reaches them. Grow the
// affected margin until the whole ring fits, instead of reserving full-width strips.
export const fitRingAroundControls = (viewport: Size, count: number, metrics: SeatMetrics,
  controls: { readonly top: readonly BoardControlBounds[]; readonly bottom: readonly BoardControlBounds[] }) => {
  const topLimit = Math.max(0, ...controls.top.map(control => control.top + control.height + metrics.gap))
  const bottomLimit = Math.max(0, ...controls.bottom.map(control => viewport.height - control.top + metrics.gap))
  for (let top = 0, bottom = 0; top <= topLimit + 4 && bottom <= bottomLimit + 4;) {
    const band = { width: viewport.width, height: Math.max(0, viewport.height - top - bottom) }
    const geometry = fitRing(band, count, metrics)
    if (geometry.band.width > band.width || geometry.band.height > band.height) return undefined
    const halfWidth = geometry.size / 2 + metrics.nameOverhang
    const below = geometry.size / 2 + metrics.nameGap + metrics.nameHeight
    const overlaps = (bounds: readonly BoardControlBounds[]) => geometry.positions.some(at => bounds.some(control =>
      at.x + halfWidth + metrics.gap > control.left &&
      at.x - halfWidth - metrics.gap < control.left + control.width &&
      at.y + top + below + metrics.gap > control.top &&
      at.y + top - geometry.size / 2 - metrics.gap < control.top + control.height))
    const topOverlap = overlaps(controls.top)
    const bottomOverlap = overlaps(controls.bottom)
    if (!topOverlap && !bottomOverlap) return { top, band, geometry }
    if (topOverlap) top += 4
    if (bottomOverlap) bottom += 4
  }
  return undefined
}

export interface CentreBox {
  readonly left: number // in band coordinates
  readonly top: number
  readonly width: number
  readonly height: number
}

// The boxes centred across the ring that touch no token or name: for each width, the tallest
// free span between the seats that reach into it, the one nearer the centre on a tie. A span
// against the band's edge lies outside the ring, so it counts only when no seats bound one.
// Widest first, keeping a narrower box only when it gains height.
export const centreBoxes = (geometry: Pick<RingGeometry, 'band' | 'size' | 'positions'>, metrics: SeatMetrics, maxWidth: number): CentreBox[] => {
  const { band, size, positions } = geometry
  const cx = band.width / 2
  const cy = band.height / 2
  const seats = positions.map(p => ({
    reach: Math.abs(p.x - cx) - size / 2 - metrics.nameOverhang - metrics.gap, // the half-width that first touches it
    top: p.y - size / 2 - metrics.gap,
    bottom: p.y + size / 2 + metrics.nameGap + metrics.nameHeight + metrics.gap,
  })).sort((a, b) => a.top - b.top)
  const widest = Math.min(maxWidth, band.width) / 2
  const reaches = [...new Set([widest, ...seats.map(seat => seat.reach).filter(reach => reach > 0 && reach < widest)])]
    .sort((a, b) => b - a)
  const boxes: CentreBox[] = []
  for (const half of reaches) {
    const inside = { top: 0, bottom: 0 }
    const outside = { top: 0, bottom: 0 }
    // A point either way is the same height.
    const consider = (span: { top: number; bottom: number }, top: number, bottom: number) => {
      const gain = bottom - top - (span.bottom - span.top)
      if (gain > 1 || (gain >= -1 && Math.abs((top + bottom) / 2 - cy) < Math.abs((span.top + span.bottom) / 2 - cy))) {
        span.top = top
        span.bottom = bottom
      }
    }
    let edge: number | undefined
    for (const seat of seats) {
      if (seat.reach >= half) continue
      if (seat.top > (edge ?? 0)) consider(edge === undefined ? outside : inside, edge ?? 0, seat.top)
      edge = Math.max(edge ?? 0, seat.bottom)
    }
    if (band.height > (edge ?? 0)) consider(outside, edge ?? 0, band.height)
    const span = inside.bottom > inside.top ? inside : outside
    const last = boxes.at(-1)
    if (span.bottom - span.top <= (last?.height ?? 0) + 1) continue
    if (last && last.width - 2 * half <= 1) boxes.pop()
    boxes.push({ left: cx - half, top: span.top, width: 2 * half, height: span.bottom - span.top })
  }
  return boxes
}
