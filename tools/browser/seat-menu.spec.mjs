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
