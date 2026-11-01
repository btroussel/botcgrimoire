// Where a seat's menu opens. The places tried, in order: beside the token, right then left, as
// a reader expects; then above or below it, toward the ring's centre first, centred on the
// token, reaching from its centre toward the ring's middle, or across the middle itself, where
// a narrow ring only grazes the flank seats' inner rims. The menu covers as little of the
// chosen token as it can, nothing unless the board is cramped, so the Storyteller always sees
// the seat being edited. Among those places the first covering the fewest other seats' centres
// wins: a side that covers none keeps the menu beside its token, and a neighbour's centre
// stays tappable to nominate.
import { seatMetrics, space } from '../../ui/theme'
import type { Size } from '../../ui/theme'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface SeatMenuPlace {
  readonly left: number
  readonly top: number
}

// The part of the band the menu may use: the band itself, cut to what the screen shows once
// the ring scrolls or a software keyboard covers its foot.
export interface SeatMenuRoom {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export const placeSeatMenu = ({ at, size, centre, room, others, menu }: {
  readonly at: Point // the chosen token's centre on the band
  readonly size: number // the tokens' diameter
  readonly centre: Point // the ring's centre on the band
  readonly room: SeatMenuRoom
  readonly others: readonly Point[] // every other token's centre
  readonly menu: Size // as measured, since translated rows wrap
}): SeatMenuPlace => {
  const gap = space.sm
  const x = (left: number) => Math.max(room.left + gap, Math.min(room.right - menu.width - gap, left))
  const y = (top: number) => Math.max(room.top + gap, Math.min(room.bottom - menu.height - gap, top))
  const beside = y(at.y - menu.height / 2)
  // Below clears the player's name as well as the token.
  const below = y(at.y + size / 2 + seatMetrics.nameGap + seatMetrics.nameHeight + gap)
  const above = y(at.y - size / 2 - gap - menu.height)
  const inward = at.y <= centre.y ? [below, above] : [above, below]
  const places: readonly SeatMenuPlace[] = [
    { left: x(at.x + size / 2 + gap), top: beside },
    { left: x(at.x - size / 2 - gap - menu.width), top: beside },
    ...inward.flatMap(top => [at.x - menu.width / 2, at.x < centre.x ? at.x : at.x - menu.width, centre.x - menu.width / 2]
      .map(left => ({ left: x(left), top }))),
  ]
  const hidden = (place: SeatMenuPlace, point: Point, half: number) =>
    Math.max(0, Math.min(place.left + menu.width, point.x + half) - Math.max(place.left, point.x - half))
    * Math.max(0, Math.min(place.top + menu.height, point.y + half) - Math.max(place.top, point.y - half))
  const own = (place: SeatMenuPlace) => hidden(place, at, size / 2 + space.xs) // with its brass ring
  const centres = (place: SeatMenuPlace) => others.filter(point => hidden(place, point, 1) > 0).length
  return places.reduce((best, place) => {
    const cover = own(place) - own(best)
    return cover < 0 || (cover === 0 && centres(place) < centres(best)) ? place : best
  })
}
