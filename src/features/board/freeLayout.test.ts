import { centreSpot, keepInside, layoutCentre, layoutPositions, settle, toPlace } from './freeLayout'
import { fitRing, seatsClear } from './ringLayout'

const metrics = { maximum: 104, minimum: 44, nameOverhang: 8, nameGap: 2, nameHeight: 14, padding: 12, gap: 4 }
const band = { width: 400, height: 600 }

describe('a board laid out as the room', () => {
  test('placed seats sit at their share of the band and the rest keep their slot on the circle', () => {
    const geometry = fitRing(band, 4, metrics)
    expect(layoutPositions(geometry, [undefined, undefined, undefined, undefined], metrics)).toBe(geometry.positions)
    const laid = layoutPositions(geometry, [{ x: 0.5, y: 0.5 }, undefined, undefined, undefined], metrics)
    expect(laid[0]).toMatchObject({ x: 200, y: 300 })
    expect(laid.slice(1).map(p => [p.x, p.y])).toEqual(geometry.positions.slice(1).map(p => [p.x, p.y]))
  })

  test('a place keeps the token and its name on the board however the band changes', () => {
    const size = 80
    const at = keepInside({ x: 0, y: 600 }, band, size, metrics)
    expect(at.x - size / 2 - metrics.nameOverhang).toBeGreaterThanOrEqual(metrics.padding)
    expect(at.y + size / 2 + metrics.nameGap + metrics.nameHeight).toBeLessThanOrEqual(band.height - metrics.padding)
    const geometry = fitRing(band, 3, metrics)
    const laid = layoutPositions(geometry, [{ x: 1, y: 0 }, undefined, undefined], metrics)
    expect(laid[0]!.x + geometry.size / 2 + metrics.nameOverhang).toBeLessThanOrEqual(band.width - metrics.padding)
    expect(laid[0]!.y - geometry.size / 2).toBeGreaterThanOrEqual(metrics.padding)
  })

  test('reminders face the middle of the room', () => {
    const geometry = fitRing(band, 4, metrics)
    const laid = layoutPositions(geometry, [{ x: 0.5, y: 0.2 }, { x: 0.8, y: 0.5 }, { x: 0.5, y: 0.8 }, { x: 0.2, y: 0.5 }], metrics)
    // The angle is outward, so the stack runs the other way.
    expect(laid.map(p => Math.round(p.angle))).toEqual([270, 0, 90, 180])
    expect(layoutCentre(laid)).toEqual({ x: 200, y: 300 })
  })

  test('a place is a share of the band, to four places', () => {
    expect(toPlace({ x: 100, y: 450 }, band)).toEqual({ x: 0.25, y: 0.75 })
    expect(toPlace({ x: 1 / 3 * 400, y: 900 }, band)).toEqual({ x: 0.3333, y: 1 })
  })
})

describe('settling a dropped seat', () => {
  const size = 64
  const clear = seatsClear(metrics, size)

  test('a drop on open velvet stays where it was let go', () => {
    expect(settle({ x: 200, y: 300 }, [{ x: 60, y: 60 }], band, size, metrics, [])).toEqual({ x: 200, y: 300 })
  })

  test('a drop over another token moves to the nearest spot that clears it and its name', () => {
    const other = { x: 200, y: 300 }
    const at = settle({ x: 210, y: 305 }, [other], band, size, metrics, [])
    expect(clear(at, other)).toBe(true)
    expect(Math.hypot(at.x - 210, at.y - 305)).toBeLessThan(size * 1.5)
  })

  test('a drop under a corner control moves out from under it', () => {
    const toolbar = { left: 280, top: 12, width: 108, height: 54 }
    const at = settle({ x: 330, y: 40 }, [], band, size, metrics, [toolbar])
    const clearOfToolbar = at.y - size / 2 >= toolbar.top + toolbar.height || at.x + size / 2 + metrics.nameOverhang <= toolbar.left
    expect(clearOfToolbar).toBe(true)
  })

  test('with no clear spot near, the token covers a token rather than jump across the board, but never a control', () => {
    const crowd = Array.from({ length: 30 }, (_, i) => ({ x: 40 + (i % 6) * 64, y: 40 + Math.floor(i / 6) * 110 }))
    expect(settle({ x: 200, y: 260 }, crowd, band, size, metrics, [])).toEqual({ x: 200, y: 260 })
    const panel = { left: 150, top: 230, width: 100, height: 40 }
    const at = settle({ x: 200, y: 260 }, crowd, band, size, metrics, [panel])
    expect(at.y - size / 2 >= panel.top + panel.height || at.y + size / 2 + 16 <= panel.top ||
      at.x + size / 2 + 8 <= panel.left || at.x - size / 2 - 8 >= panel.left + panel.width).toBe(true)
  })
})

describe('the room around the vote and the result', () => {
  test('a panel goes in the tallest clear box wide enough, or nowhere', () => {
    const boxes = [{ left: 0, top: 0, width: 400, height: 60 }, { left: 100, top: 100, width: 200, height: 300 }]
    expect(centreSpot(boxes, 180, 120)).toEqual({ x: 200, y: 250 })
    expect(centreSpot(boxes, 260, 120)).toBeUndefined()
  })
})
