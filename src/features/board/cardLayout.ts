// How large a card's tokens draw and how they stand. The words, the tokens and the seat's name are
// one block centred in the card's box, so the tokens take whatever the measured words leave.
import { card, gutter, space, type } from '../../ui/theme'

export interface CardRoom {
  readonly width: number // the card's box
  readonly height: number
  readonly words: number // the words' measured height, 0 for a card without them
  readonly below: number // the seat's name under the tokens, measured, 0 without one
  readonly count: number
  readonly roomy: boolean // tablet width and up: the wider gutter and gap
}

export interface CardTokens {
  readonly size: number
  readonly columns: number // tokens per row: 1 is a column, `count` a row
  readonly gap: number
  readonly captioned: boolean // too small for the name on the arc, so it is printed underneath
}

const eighth = (value: number) => Math.floor(value / 8) * 8

// A caption is the title face on at most two lines, and a captioned cell is a little wider than
// its token so a name has room.
const captionBand = card.captionLines * (type.display.title.lineHeight ?? 28) + space.md
export const captionExtra = space.sm

export const cardTokens = ({ width, height, words, below, count, roomy }: CardRoom): CardTokens => {
  const gap = roomy ? space.xl : space.lg
  if (count <= 0) return { size: 0, columns: 0, gap, captioned: false }
  const wide = width - 2 * (roomy ? gutter.tablet : gutter.phone)
  const tall = height - card.margin - card.foot - (words > 0 ? words + card.wordsGap : 0) - (below > 0 ? below + card.captionGap : 0)

  const fit = (columns: number, captioned: boolean): number => {
    const rows = Math.ceil(count / columns)
    const across = columns === 1
      ? Math.min(width * card.tokenShare, wide)
      : (wide - (columns - 1) * gap) / columns
    const down = (tall - (rows - 1) * gap - (captioned ? rows * captionBand : 0)) / rows
    const extra = captioned ? captionExtra : 0
    return Math.max(card.tokenMinimum, eighth(Math.min(across - extra, down, card.tokenMaximum)))
  }

  // A row or a column, whichever draws larger, and two columns once there are more than two:
  // under long words three have no height for a column and no width for a row. At the floor a
  // row may not fit across, so the most columns that do fit is also tried, and the block scrolls
  // down rather than run off the side. A tie goes to a layout whose last row is full, then to
  // the wider, which reads left to right.
  const atFloor = Math.floor((wide + gap) / (card.tokenMinimum + captionExtra + gap))
  const ragged = (columns: number) => (count % columns === 0 ? 0 : 1)
  const options = [...new Set([count, Math.max(1, Math.min(count, atFloor)), ...(count > 2 ? [2] : []), 1])]
    .sort((a, b) => ragged(a) - ragged(b) || b - a)
  let best: CardTokens | undefined
  for (const columns of options) {
    const named = fit(columns, false)
    const captioned = named < card.arcFrom
    const size = captioned ? fit(columns, true) : named
    const across = columns * (size + (captioned ? captionExtra : 0)) + (columns - 1) * gap
    if (columns > 1 && across > wide) continue
    if (!best || size > best.size) best = { size, columns, gap, captioned }
  }
  return best as CardTokens
}
