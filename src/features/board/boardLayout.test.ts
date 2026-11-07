import { describe, expect, it } from 'vitest'

import { boardLayoutFor, referenceCompactWidth, referenceMaximumWidth, referenceSettledWidth } from './boardLayout'

describe('room for the board', () => {
  it('limits an oversized drag and keeps a released drawer readable or fully closed', () => {
    expect(boardLayoutFor(1920, 2000).referenceWidth).toBe(540)
    expect(boardLayoutFor(320, 2000).referenceWidth).toBe(312)
    expect(referenceSettledWidth(95, 540, 192)).toBe(0)
    expect(referenceSettledWidth(150, 540, 192)).toBe(192)
    expect(referenceSettledWidth(365, 540, 192)).toBe(192)
    expect(referenceSettledWidth(366, 540, 192)).toBe(540)
    expect(referenceSettledWidth(2000, 540, 192)).toBe(540)
    expect(referenceSettledWidth(220, 160, 168)).toBe(160)
  })
  it('snaps every released width to closed, compact or full on phones and desktops', () => {
    for (const viewport of [320, 390, 480, 481, 900]) {
      const maximum = referenceMaximumWidth(viewport)
      const compact = referenceCompactWidth(viewport)
      expect(compact).toBe(viewport <= 480 ? 168 : 192)
      for (let width = 0; width <= maximum + 50; width++) {
        expect([0, Math.min(compact, maximum), maximum]).toContain(referenceSettledWidth(width, maximum, compact))
      }
    }
  })
  it('leaves board space beside the fully opened drawer outside phone widths', () => {
    expect(referenceMaximumWidth(662)).toBe(397)
    expect(referenceMaximumWidth(390)).toBe(382)
    for (const viewport of [481, 662, 768, 1024, 1920]) {
      const drawer = referenceMaximumWidth(viewport)
      expect(drawer).toBeLessThanOrEqual(viewport * 0.6)
      expect(drawer).toBeLessThanOrEqual(540)
    }
  })
  it('reserves only the tabs when references are closed', () => {
    for (const width of [320, 390, 768, 1024, 1920]) {
      expect(boardLayoutFor(width, 0).reservedWidth).toBe(40)
    }
  })

  it('overlays narrow screens without shrinking the seating area', () => {
    for (const width of [320, 390, 480, 559]) {
      for (const requested of [80, 236, 540, 920]) {
        const layout = boardLayoutFor(width, requested)
        expect(layout.reservedWidth).toBe(40)
        expect(layout.referenceWidth).toBeLessThan(width)
      }
    }
  })

  it('docks references only when the remaining board has room', () => {
    expect(boardLayoutFor(560, 236).reservedWidth).toBe(40)
    expect(boardLayoutFor(939, 540).reservedWidth).toBe(419)
    expect(boardLayoutFor(940, 540).reservedWidth).toBe(420)
    for (const width of [560, 768, 844, 1024, 1180, 1440, 1920]) {
      for (const requested of [80, 236, 540, 920]) {
        expect(width - boardLayoutFor(width, requested).reservedWidth).toBeGreaterThanOrEqual(520)
      }
    }
  })

  it('gives a tablet held upright and a phone on its side the whole compact drawer', () => {
    for (const width of [768, 844]) {
      const compact = referenceCompactWidth(width)
      expect(boardLayoutFor(width, compact).reservedWidth).toBe(40 + compact)
    }
  })

  it('keeps intermediate drawer widths continuous without a docking jump', () => {
    for (const viewport of [653, 800, 1180, 1920]) {
      for (let width = 1; width <= referenceMaximumWidth(viewport); width++) {
        const before = boardLayoutFor(viewport, width - 1)
        const after = boardLayoutFor(viewport, width)
        expect(after.referenceWidth - before.referenceWidth).toBe(1)
        expect(after.reservedWidth - before.reservedWidth).toBeGreaterThanOrEqual(0)
        expect(after.reservedWidth - before.reservedWidth).toBeLessThanOrEqual(1)
      }
    }
  })

})
