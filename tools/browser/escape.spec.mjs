import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

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
const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

// Escape closes only the topmost layer, and never removes a recorded vote.
test('Escape closes the reference and a menu before it ends a vote, and keeps its hands', async ({ page }) => {
  await openBoard(page, 7)
  const characters = page.getByRole('button', { name: 'Characters', exact: true })
  await characters.click()
  await expect(characters).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(characters).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Setup', exact: true }).click()
  await page.getByRole('button', { name: 'Start the first night', exact: true }).click()
  await page.getByRole('button', { name: 'Night 1', exact: true }).click()
  await page.getByRole('button', { name: 'Start the day', exact: true }).click()
  await seat(page, 0).click()
  await seat(page, 2).click()
  const controls = page.getByRole('region', { name: 'Seat 1 nominates Seat 3' })
  await seat(page, 3).click()
  await seat(page, 4).click()
  await expect(controls).toContainText('2 votes')

  await characters.click()
  await expect(characters).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(characters).toHaveAttribute('aria-expanded', 'false')
  await expect(controls).toContainText('2 votes')

  const more = page.getByRole('button', { name: 'More', exact: true })
  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(controls).toContainText('2 votes')

  // The last Escape ends the vote as Done does: recorded, with nobody on the block.
  await page.keyboard.press('Escape')
  await expect(controls).toHaveCount(0)
  await page.getByRole('button', { name: 'Day 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Seat 1 → Seat 3: 2 votes. Most votes', exact: true })).toBeVisible()
})
