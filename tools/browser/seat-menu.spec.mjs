import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

const openBoard = async (page, players) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  const count = page.getByText(/^\d+ players?$/).first()
  await expect(async () => {
    const current = Number((await count.textContent()).match(/\d+/)[0])
    if (current !== players) {
      await page.getByRole('button', { name: current < players ? 'More players' : 'Fewer players', exact: true }).click()
    }
    expect(Number((await count.textContent()).match(/\d+/)[0])).toBe(players)
  }).toPass()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(players)
}

const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

test.describe('seat menu on touch screens', () => {
  test.use({ isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

  for (const [viewport, players] of [[{ width: 320, height: 568 }, 8], [{ width: 390, height: 844 }, 20]]) {
    test(`never covers its seat and keeps touch-sized rows, ${players} seats at ${viewport.width} points`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await openBoard(page, players)
      const seats = page.locator('[data-seat-context-target]')
      for (let index = 0; index < players; index++) {
        const token = seats.nth(index).getByRole('button').first()
        await token.tap()
        const menu = page.getByRole('group', { name: `Seat ${index + 1}`, exact: true })
        await expect(menu).toBeVisible()
        expect(overlap(await menu.boundingBox(), await token.boundingBox()), `seat ${index + 1}`).toBe(false)
        // A row takes a tap across the whole menu, not only on its words.
        const inner = await menu.evaluate(element => element.clientWidth - 2 * parseFloat(getComputedStyle(element).paddingLeft))
        for (const { height, width } of await menu.getByRole('button').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().toJSON()))) {
          expect(height).toBeGreaterThanOrEqual(44)
          expect(width).toBeCloseTo(inner, 0)
        }
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
      }
    })
  }
})

test('arranging the seats adds a seat and turns the ring in one pass, and survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openBoard(page, 5)
  const seats = page.locator('[data-seat-context-target]')
  // Seats render in ring order, seat 0 at the top, and each token's label starts with its player.
  const names = () => seats.evaluateAll(all => all.map(seat => seat.querySelector('[role="button"]').getAttribute('aria-label').split(',')[0]))
  const before = await names()

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Arrange the seats', exact: true }).click()
  await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
  await expect.poll(names).toEqual([...before.slice(-1), ...before.slice(0, -1)])
  await page.getByRole('button', { name: 'Rotate counterclockwise', exact: true }).click()
  await page.getByRole('button', { name: 'Rotate counterclockwise', exact: true }).click()
  await expect.poll(names).toEqual([...before.slice(1), before[0]])

  // A new seat leaves the mode open, so the ring still turns afterwards.
  await page.getByRole('button', { name: 'Add a seat at position 6', exact: true }).click()
  await expect(seats).toHaveCount(6)
  await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
  const added = ['Seat 6', ...before.slice(1), before[0]]
  await expect.poll(names).toEqual(added)

  // Escape ends the mode, and the order is saved with the game.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toHaveCount(0)
  await expect(page.locator('[id^="seat-insertion-"]')).toHaveCount(0)
  await reload(page)
  await expect(seats).toHaveCount(6)
  await expect.poll(names).toEqual(added)
})

test('arranging, a seat tapped and then another takes that seat\'s place, and Escape puts a picked seat down first', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openBoard(page, 6)
  const seats = page.locator('[data-seat-context-target]')
  const discs = seats.locator('[data-seat-disc] [role="button"]')
  const names = () => seats.evaluateAll(all => all.map(seat => seat.querySelector('[role="button"]').getAttribute('aria-label').split(',')[0]))
  const [a, b, c, d, ...rest] = await names()

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Arrange the seats', exact: true }).click()
  await discs.nth(0).click()
  await expect(discs.nth(0)).toHaveAttribute('aria-pressed', 'true')
  // While a seat is picked, the insertion markers give way to the seats.
  await expect(page.locator('[id^="seat-insertion-"]')).toHaveCount(0)
  await page.getByRole('button', { name: new RegExp(`^${c}.*Move ${a} here$`) }).click()
  await expect.poll(names).toEqual([b, c, a, d, ...rest])
  await expect(page.locator('[id^="seat-insertion-"]')).not.toHaveCount(0)

  // Reset order puts back the ring the mode opened with, in one undoable step, and undo keeps the
  // mode open.
  const reset = page.getByRole('button', { name: 'Reset order', exact: true })
  await reset.click()
  await expect.poll(names).toEqual([a, b, c, d, ...rest])
  await expect(reset).toBeDisabled()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(names).toEqual([b, c, a, d, ...rest])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(names).toEqual([a, b, c, d, ...rest])
  await expect(reset).toBeDisabled()

  // Escape puts the picked seat down and keeps the mode; a second Escape ends it.
  await discs.nth(1).click()
  await page.keyboard.press('Escape')
  await expect(discs.nth(1)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toHaveCount(0)
})

test('arranging, a mouse drags a seat onto another place and the mode stays open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openBoard(page, 7)
  const seats = page.locator('[data-seat-context-target]')
  const discs = seats.locator('[data-seat-disc] [role="button"]')
  const names = () => seats.evaluateAll(all => all.map(seat => seat.querySelector('[role="button"]').getAttribute('aria-label').split(',')[0]))
  const [a, b, c, d, ...rest] = await names()
  const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Arrange the seats', exact: true }).click()
  const from = centre(await discs.nth(0).boundingBox())
  const to = centre(await discs.nth(3).boundingBox())
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(names).toEqual([b, c, d, a, ...rest])
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toHaveCount(1)

  // Let go far from the ring, the seat goes back.
  const back = centre(await discs.nth(3).boundingBox())
  const ring = centre(await page.locator('#ring-turn').boundingBox())
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await page.mouse.move(ring.x, ring.y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(names).toEqual([b, c, d, a, ...rest])
})
