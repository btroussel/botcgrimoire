import { describe, expect, it, vi } from 'vitest'

import { cardTokens } from './cardLayout'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

// The card's box is the window less its bar of 60 at the foot.
const box = (width: number, height: number) => ({ width, height: height - 60, roomy: width >= 600 })
// One line of the card's words at 40, two lines at 40, and one line at 56.
const oneLine = 44
const twoLines = 88
const largeLine = 60

describe('the card block', () => {
  it('draws one token at 280 on an upright phone, with or without words', () => {
    expect(cardTokens({ ...box(390, 844), words: oneLine, below: 0, count: 1 })).toEqual({ size: 280, columns: 1, gap: 16, captioned: false })
    expect(cardTokens({ ...box(390, 844), words: 0, below: 0, count: 1 }).size).toBe(280)
  })

  it('stands three tokens in a column on an upright phone', () => {
    expect(cardTokens({ ...box(390, 844), words: 0, below: 0, count: 3 })).toEqual({ size: 224, columns: 1, gap: 16, captioned: false })
    expect(cardTokens({ ...box(390, 844), words: twoLines, below: 0, count: 3 })).toEqual({ size: 184, columns: 1, gap: 16, captioned: false })
  })

  it('lets the height decide on a phone on its side, and stands three in a row', () => {
    expect(cardTokens({ ...box(844, 390), words: oneLine, below: 0, count: 1 }).size).toBe(192)
    expect(cardTokens({ ...box(844, 390), words: oneLine, below: 0, count: 3 })).toEqual({ size: 192, columns: 3, gap: 24, captioned: false })
  })

  it('caps one token at 448 on a tablet and puts three in a row', () => {
    expect(cardTokens({ ...box(1024, 768), words: largeLine, below: 0, count: 1 }).size).toBe(448)
    expect(cardTokens({ ...box(1024, 768), words: largeLine, below: 0, count: 3 })).toEqual({ size: 304, columns: 3, gap: 24, captioned: false })
  })

  it('makes room for the seat name under the token', () => {
    const bare = cardTokens({ ...box(844, 390), words: oneLine, below: 0, count: 1 }).size
    const named = cardTokens({ ...box(844, 390), words: oneLine, below: oneLine, count: 1 }).size
    expect(named).toBe(128)
    expect(named).toBeLessThan(bare)
  })

  it('keeps three tokens in a column with their names on the arc on the smallest phone', () => {
    // Two columns draw them as large, but a column leaves no token alone on a last row. Captions
    // would cost each row its height and leave a row of three at half this size.
    expect(cardTokens({ ...box(320, 568), words: 0, below: 0, count: 3 })).toEqual({ size: 136, columns: 1, gap: 16, captioned: false })
  })

  it('stands three in two columns under long words, where neither a column nor a row has the room', () => {
    expect(cardTokens({ ...box(320, 568), words: 3 * oneLine, below: 0, count: 3 })).toEqual({ size: 128, columns: 2, gap: 16, captioned: false })
    expect(cardTokens({ ...box(375, 667), words: 96, below: 0, count: 3 })).toEqual({ size: 160, columns: 2, gap: 16, captioned: false })
  })

  it('moves the names to captions when the arc would be too small to read', () => {
    const small = cardTokens({ ...box(320, 568), words: 3 * oneLine, below: 0, count: 6 })
    expect(small.captioned).toBe(true)
    expect(small.size).toBeLessThan(112)
    expect(small.size % 8).toBe(0)
  })

  it('wraps more than three to two columns when that draws them larger', () => {
    expect(cardTokens({ ...box(390, 844), words: 0, below: 0, count: 4 })).toEqual({ size: 168, columns: 2, gap: 16, captioned: false })
    expect(cardTokens({ ...box(390, 844), words: 0, below: 0, count: 5 }).columns).toBe(2)
  })

  it('never draws a token below the floor, so a block that cannot fit scrolls', () => {
    expect(cardTokens({ width: 320, height: 200, words: 300, below: 0, count: 6, roomy: false }).size).toBe(48)
  })

  it('never draws a block wider than the card, even at the floor', () => {
    const cases = [
      { width: 320, height: 568, words: oneLine, count: 8, roomy: false },
      { width: 844, height: 390, words: oneLine, count: 12, roomy: true },
      { width: 320, height: 300, words: twoLines, count: 5, roomy: false },
    ]
    for (const { roomy, ...room } of cases) {
      const { size, columns, gap, captioned } = cardTokens({ ...room, below: 0, roomy })
      const wide = room.width - 2 * (roomy ? 24 : 16)
      expect(columns * (size + (captioned ? 8 : 0)) + (columns - 1) * gap).toBeLessThanOrEqual(wide)
    }
  })
})
