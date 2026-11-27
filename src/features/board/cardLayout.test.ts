import { describe, expect, it, vi } from 'vitest'

import { cardTokens } from './cardLayout'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

// One line of the card's words at 40, two lines at 40, and one line at 56.
const oneLine = 44
const twoLines = 88
const largeLine = 60

describe('the card block', () => {
  it('draws one token well above the old 200 on an upright phone', () => {
    expect(cardTokens({ width: 390, height: 844, words: oneLine, below: 0, count: 1, roomy: false }))
      .toEqual({ size: 280, columns: 1, gap: 16, captioned: false })
  })

  it('stands three tokens in a column on an upright phone', () => {
    expect(cardTokens({ width: 390, height: 844, words: twoLines, below: 0, count: 3, roomy: false }))
      .toEqual({ size: 192, columns: 1, gap: 16, captioned: false })
  })

  it('lets the height decide on a phone on its side, and stands three in a row', () => {
    expect(cardTokens({ width: 844, height: 390, words: oneLine, below: 0, count: 1, roomy: true }).size).toBe(208)
    expect(cardTokens({ width: 844, height: 390, words: oneLine, below: 0, count: 3, roomy: true }))
      .toEqual({ size: 208, columns: 3, gap: 24, captioned: false })
  })

  it('caps one token at 360 on a tablet and puts three in a row', () => {
    expect(cardTokens({ width: 1024, height: 768, words: largeLine, below: 0, count: 1, roomy: true }).size).toBe(360)
    expect(cardTokens({ width: 1024, height: 768, words: largeLine, below: 0, count: 3, roomy: true }))
      .toEqual({ size: 304, columns: 3, gap: 24, captioned: false })
  })

  it('makes room for the seat name under the token', () => {
    const bare = cardTokens({ width: 844, height: 390, words: oneLine, below: 0, count: 1, roomy: true }).size
    const named = cardTokens({ width: 844, height: 390, words: oneLine, below: 28, count: 1, roomy: true }).size
    expect(named).toBe(160)
    expect(named).toBeLessThan(bare)
  })

  it('moves the names to captions when the arc would be too small to read', () => {
    const small = cardTokens({ width: 320, height: 568, words: 3 * oneLine, below: 0, count: 3, roomy: false })
    expect(small.captioned).toBe(true)
    expect(small.size).toBeLessThan(144)
    expect(small.size % 8).toBe(0)
  })

  it('wraps more than three to two columns when that draws them larger', () => {
    expect(cardTokens({ width: 390, height: 844, words: 0, below: 0, count: 4, roomy: false }).columns).toBe(2)
  })

  it('gives an editing card the foot a shown card keeps for its hint', () => {
    // The box above the keys on an upright phone: 844 less a keyboard of 380 and its bar.
    const room = { width: 390, height: 404, words: twoLines, below: 0, count: 1, roomy: false }
    expect(cardTokens(room).size).toBe(176)
    expect(cardTokens({ ...room, foot: 12 }).size).toBe(224)
  })

  it('never draws a token below the floor, so a block that cannot fit scrolls', () => {
    expect(cardTokens({ width: 320, height: 200, words: 300, below: 0, count: 6, roomy: false }).size).toBe(48)
  })

  it('never draws a block wider than the card, even at the floor', () => {
    const cases = [
      { width: 320, height: 568, words: oneLine, count: 8, roomy: false },
      { width: 844, height: 390, words: oneLine, count: 12, roomy: true },
      { width: 320, height: 300, words: twoLines, count: 5, roomy: false, foot: 12 },
    ]
    for (const { roomy, ...room } of cases) {
      const { size, columns, gap, captioned } = cardTokens({ ...room, below: 0, roomy })
      const wide = room.width - 2 * (roomy ? 24 : 16)
      expect(columns * (size + (captioned ? 8 : 0)) + (columns - 1) * gap).toBeLessThanOrEqual(wide)
    }
  })
})
