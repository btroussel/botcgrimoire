import { centreBoxes, fitRing, fitRingAroundControls, nameHeightAt } from './ringLayout'

const metrics = { maximum: 104, minimum: 44, nameOverhang: 8, nameGap: 2, nameHeight: 14, padding: 12, gap: 4 }

describe('fitted seating ring', () => {
  test('tokens and names fit across crowded and short boards', () => {
    for (const [width, height] of [[395, 566], [320, 344], [667, 211], [1000, 650], [0, 0]]) {
      for (let count = 5; count <= 20; count++) {
        const { size, positions, band } = fitRing({ width: width!, height: height! }, count, metrics)
        expect(size).toBeGreaterThanOrEqual(44)
        expect(size).toBeLessThanOrEqual(104)
        expect(size % 4).toBe(0)
        for (const [i, p] of positions.entries()) {
          expect(p.x - size / 2 - 8).toBeGreaterThanOrEqual(11.99)
          expect(p.x + size / 2 + 8).toBeLessThanOrEqual(band.width - 11.99)
          expect(p.y - size / 2).toBeGreaterThanOrEqual(11.99)
          expect(p.y + size / 2 + 16).toBeLessThanOrEqual(band.height - 11.99)
          for (const q of positions.slice(i + 1)) {
            expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(size + 4)
            expect(Math.abs(p.x - q.x) >= size + 20 || Math.abs(p.y - q.y) >= 18).toBe(true)
            for (const [disc, label] of [[p, q], [q, p]] as const) {
              const left = label.x - size / 2 - 8
              const right = label.x + size / 2 + 8
              const top = label.y + size / 2 + 2
              const nearestX = Math.max(left, Math.min(right, disc.x))
              const nearestY = Math.max(top, Math.min(top + 14, disc.y))
              expect(Math.hypot(disc.x - nearestX, disc.y - nearestY)).toBeGreaterThanOrEqual(size / 2 + 4)
            }
          }
        }
      }
    }
  })

  test('measures a large token\'s taller name and a small token\'s label line', () => {
    const scaled = { ...metrics, largeName: { from: 64, height: 16 } }
    expect(nameHeightAt(scaled, 60)).toBe(14)
    expect(nameHeightAt(scaled, 64)).toBe(16)
    expect(nameHeightAt(metrics, 100)).toBe(14)
    for (const [width, height] of [[395, 566], [1000, 650]]) {
      for (let count = 5; count <= 20; count++) {
        const { size, positions } = fitRing({ width: width!, height: height! }, count, scaled)
        const nameHeight = nameHeightAt(scaled, size)
        for (const label of positions) {
          for (const disc of positions) {
            if (disc === label) continue
            const top = label.y + size / 2 + 2
            const nearestX = Math.max(label.x - size / 2 - 8, Math.min(label.x + size / 2 + 8, disc.x))
            const nearestY = Math.max(top, Math.min(top + nameHeight, disc.y))
            expect(Math.hypot(disc.x - nearestX, disc.y - nearestY)).toBeGreaterThanOrEqual(size / 2 + 4)
          }
        }
      }
    }
  })

  test('uses spare space on a thirteen-player phone board without scrolling', () => {
    const result = fitRing({ width: 395, height: 566 }, 13, metrics)
    expect(result.size).toBeGreaterThan(44)
    expect(result.band).toEqual({ width: 395, height: 566 })
  })

  test('expands the seating area instead of overlapping at the minimum size', () => {
    const result = fitRing({ width: 320, height: 344 }, 20, metrics)
    expect(result.size).toBe(44)
    expect(result.band.width).toBe(320)
    expect(result.band.height).toBeGreaterThan(344)
  })

  test('keeps the two sides of a landscape oval distinct with an odd seat count', () => {
    const result = fitRing({ width: 804, height: 234 }, 7, metrics)
    const upperSeat = result.positions[0]!
    const lowerSeats = result.positions.slice(3, 5)
    const nameBottom = upperSeat.y + result.size / 2 + metrics.nameGap + metrics.nameHeight
    expect(Math.min(...lowerSeats.map(seat => seat.y - result.size / 2)) - nameBottom).toBeGreaterThan(44)
    expect(result.band).toEqual({ width: 804, height: 234 })
    expect(result.size).toBeGreaterThanOrEqual(44)
  })

  test('keeps a short landscape board fitted when it uses the space beside the toolbar', () => {
    const result = fitRing({ width: 528, height: 220 }, 7, metrics)
    expect(result.size).toBeGreaterThanOrEqual(44)
    expect(result.band).toEqual({ width: 528, height: 220 })
  })

  test('preserves an open centre even when minimum-size seats need scrolling', () => {
    const result = fitRing({ width: 856, height: 164 }, 7, metrics)
    expect(result.size).toBe(44)
    expect(result.band.height).toBeGreaterThan(164)
    expect(2 * result.ry - result.size - metrics.nameGap - metrics.nameHeight).toBeGreaterThanOrEqual(44)
  })

  test('uses the phone width and height without covering its corner controls', () => {
    for (const [width, height] of [[896, 340], [844, 390], [667, 375], [568, 320]] as const) {
      for (const toolbarWidth of [178, 226]) {
        const controls = {
          top: [{ left: width - 12 - toolbarWidth, top: 8, width: toolbarWidth, height: 50 }],
          bottom: [
            { left: 12, top: height - 74, width: 190, height: 62 },
            { left: width - 160, top: height - 80, width: 148, height: 68 },
          ],
        }
        const result = fitRingAroundControls({ width: width - 40, height }, 7, metrics, controls)
        expect(result).toBeDefined()
        const { top, geometry } = result!
        const { size, positions } = geometry
        const left = Math.min(...positions.map(at => at.x - size / 2))
        const right = Math.max(...positions.map(at => at.x + size / 2))
        const first = Math.min(...positions.map(at => at.y - size / 2))
        const last = Math.max(...positions.map(at => at.y + size / 2))
        expect(right - left).toBeGreaterThan(width * 0.75)
        expect(last - first).toBeGreaterThan(height * 0.5)
        expect(top + first).toBeGreaterThanOrEqual(12)
        expect(top + last + 16).toBeLessThanOrEqual(height - 12)
        for (const at of positions) {
          for (const control of [...controls.top, ...controls.bottom]) {
            const seat = { left: at.x - size / 2 - 8, right: at.x + size / 2 + 8,
              top: top + at.y - size / 2, bottom: top + at.y + size / 2 + 16 }
            expect(seat.right + 4 <= control.left || seat.left - 4 >= control.left + control.width ||
              seat.bottom + 4 <= control.top || seat.top - 4 >= control.top + control.height).toBe(true)
          }
        }
      }
    }
  })

  test('leaves crowded boards to the scrolling layout', () => {
    expect(fitRingAroundControls({ width: 280, height: 200 }, 20, metrics, { top: [], bottom: [] })).toBeUndefined()
  })
})

describe('the ring\'s free centre', () => {
  const touches = (box: { left: number; top: number; width: number; height: number }, ring: ReturnType<typeof fitRing>) =>
    ring.positions.some(p => {
      const left = p.x - ring.size / 2 - metrics.nameOverhang
      const right = p.x + ring.size / 2 + metrics.nameOverhang
      const top = p.y - ring.size / 2
      const bottom = p.y + ring.size / 2 + metrics.nameGap + metrics.nameHeight
      return box.left < right && left < box.left + box.width && box.top < bottom && top < box.top + box.height
    })

  test('every box is centred across, clear of every token and name, and taller the narrower it gets', () => {
    for (const [width, height] of [[390, 566], [320, 480], [844, 300], [1000, 650]]) {
      for (const count of [5, 8, 10, 15, 20]) {
        const ring = fitRing({ width: width!, height: height! }, count, metrics)
        const boxes = centreBoxes(ring, metrics, 560)
        expect(boxes.length).toBeGreaterThan(0)
        for (const [i, box] of boxes.entries()) {
          expect(box.left + box.width / 2).toBeCloseTo(ring.band.width / 2)
          expect(box.width).toBeLessThanOrEqual(560)
          expect(touches(box, ring)).toBe(false)
          if (i > 0) {
            expect(box.width).toBeLessThan(boxes[i - 1]!.width)
            expect(box.height).toBeGreaterThan(boxes[i - 1]!.height)
          }
        }
      }
    }
  })

  test('a portrait phone gives a tall box between the two sides', () => {
    const ring = fitRing({ width: 390, height: 566 }, 10, metrics)
    const tallest = centreBoxes(ring, metrics, 560).at(-1)!
    expect(tallest.height).toBeGreaterThan(tallest.width)
    expect(tallest.width).toBeGreaterThan(ring.size)
  })

  test('a row of seats across the centre moves the box above or below it', () => {
    const ring = fitRing({ width: 360, height: 560 }, 5, metrics)
    expect(centreBoxes(ring, metrics, 560).some(box => box.width > 2 * ring.size && box.height > 40)).toBe(true)
  })

  test('an empty ring leaves the whole band up to the widest box', () => {
    const ring = fitRing({ width: 1000, height: 650 }, 0, metrics)
    expect(centreBoxes(ring, metrics, 560)).toEqual([{ left: 220, top: 0, width: 560, height: 650 }])
  })
})
