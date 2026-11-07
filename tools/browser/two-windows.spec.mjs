import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' })

const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()

// Two windows on one game share the database and each saves the game whole, so the window that
// saw the other's edit last must not put its older copy back.
test('an edit in a second window of the same game keeps the first window\'s edits', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)

  const other = await context.newPage()
  await open(other, page.url())
  await expect(other.locator('[data-seat-context-target]')).toHaveCount(7)

  await seat(page, 2).click()
  await page.getByRole('button', { name: 'Mark dead', exact: true }).click()
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
  // The second window takes the saved copy without a reload.
  await expect(seat(other, 2)).toHaveAttribute('aria-label', /, dead, /)

  await seat(other, 0).click()
  await other.getByRole('button', { name: 'Rename player', exact: true }).click()
  await other.getByRole('textbox', { name: 'Player name', exact: true }).fill('Ana')
  await other.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter')
  await expect(seat(other, 0)).toHaveAttribute('aria-label', /^Ana, /)

  await reload(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
})
