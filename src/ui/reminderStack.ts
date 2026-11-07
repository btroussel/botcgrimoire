// Where a seat's reminders sit, as plain geometry the seat draws and the board's tests measure.
import { seatNameStyle, space, tokenSize } from './theme'

// A reminder is three fifths of its seat's token, never under the chip size, so a tablet's or a
// desktop's big tokens carry reminders whose words read, and never over the token itself, so on
// a crowded twenty-seat board the reminder never outgrows the seat it belongs to.
export const reminderSize = (token: number): number => Math.round(Math.min(token, Math.max(tokenSize.chip, token * 0.6)))

// The reminders' centres from their token's centre: along the inward axis the ring gives (the
// opposite of `angle`, 0 right and 90 down), clear of the token and, on a stack running
// downward, of the name under it. A folded stack overlaps each disc by half.
export const reminderStack = (size: number, angle: number, count: number, expanded: boolean) => {
  const chipSize = reminderSize(size)
  const radians = (angle * Math.PI) / 180
  const inward = { x: -Math.cos(radians), y: -Math.sin(radians) }
  // Only downward stacks need room for the name; diagonal stacks clear it to the side.
  const nameClearance = Math.max(0, inward.y - Math.abs(inward.x)) * ((seatNameStyle(size).lineHeight ?? 0) + space.xxs)
  const distance = size / 2 + chipSize / 2 + space.xxs + nameClearance
  const step = expanded ? chipSize + space.xxs : chipSize / 2
  const points = Array.from({ length: count }, (_, i) => ({
    x: inward.x * (distance + i * step),
    y: inward.y * (distance + i * step),
  }))
  return { chipSize, inward, points }
}
