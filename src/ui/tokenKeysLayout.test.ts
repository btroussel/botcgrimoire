import { describe, expect, it, vi } from 'vitest'

import { tokenKeysLayout, tokenKeysWidth } from './tokenKeysLayout'

// The theme's easing curves are the only part of react-native it reads.
vi.mock('react-native', () => ({ Easing: { bezier: () => (t: number) => t } }))

// A drawer's keys have the window less its border and side margins; it is 640 wide at most.
const inDrawer = (window: number) => Math.min(640, window) - 34

describe('the token keys in a row', () => {
  it('stand four or five across on a phone and seven on a tablet, each large enough to read', () => {
    expect(tokenKeysLayout(inDrawer(320))).toMatchObject({ columns: 4, size: 67 })
    expect(tokenKeysLayout(inDrawer(375))).toMatchObject({ columns: 4, size: 80 })
    expect(tokenKeysLayout(inDrawer(390))).toMatchObject({ columns: 5, size: 66 })
    expect(tokenKeysLayout(inDrawer(430))).toMatchObject({ columns: 5, size: 74 })
    expect(tokenKeysLayout(inDrawer(768))).toMatchObject({ columns: 7, size: 80 })
  })

  it('fill the row at every width, so the dock under them lines up with their columns', () => {
    for (let window = 320; window <= 1400; window++) {
      const room = inDrawer(window)
      const { columns, size, width } = tokenKeysLayout(room)
      const dock = Math.min(room, tokenKeysWidth)
      expect(size, String(window)).toBeGreaterThanOrEqual(64)
      expect(width, String(window)).toBeLessThanOrEqual(dock)
      // Less than a point a key is lost to whole sizes.
      expect(dock - width, String(window)).toBeLessThan(columns)
    }
  })

  it('never run wider than seven of the largest key', () => {
    expect(tokenKeysLayout(2000)).toEqual({ columns: 7, size: 80, width: tokenKeysWidth })
  })

  it('keep one key in a width too narrow for a comfortable one', () => {
    expect(tokenKeysLayout(50)).toMatchObject({ columns: 1, size: 50 })
  })
})
