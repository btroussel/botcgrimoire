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
  // The first window takes the rename too, so its own write on leaving keeps it.
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)

  await reload(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
})

// A window that misses the other's message, frozen in the background or without the channel,
// still cannot write its older copy over the newer one: its write is refused, and it makes its
// own edit again on top of the stored copy.
test('a second window that never heard of the first window\'s edit keeps both when it edits', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)

  const deaf = await context.newPage()
  await deaf.addInitScript(() => { delete window.BroadcastChannel })
  await open(deaf, page.url())
  await expect(deaf.locator('[data-seat-context-target]')).toHaveCount(7)

  await seat(page, 2).click()
  await page.getByRole('button', { name: 'Mark dead', exact: true }).click()
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
  await expect(seat(deaf, 2)).not.toHaveAttribute('aria-label', /, dead, /)

  await seat(deaf, 0).click()
  await deaf.getByRole('button', { name: 'Rename player', exact: true }).click()
  await deaf.getByRole('textbox', { name: 'Player name', exact: true }).fill('Ana')
  await deaf.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter')
  // Refused, it takes the stored copy, so the first window's death appears here too.
  await expect(seat(deaf, 2)).toHaveAttribute('aria-label', /, dead, /)
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', /^Ana, /)

  await deaf.close()
  await reload(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
})

// One gesture can be two changes, as the deal is: its tokens, then the bag put away. A window
// that never heard of an edit makes both on the stored copy, in order, keeping the edit.
test('a deal in a window that never heard of an edit keeps the edit and puts the bag away once', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deal at random', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  const deaf = await context.newPage()
  await deaf.addInitScript(() => { delete window.BroadcastChannel })
  await open(deaf, page.url())
  await expect(deaf.locator('[data-seat-context-target]')).toHaveCount(7)

  await seat(page, 0).click()
  await page.getByRole('button', { name: 'Rename player', exact: true }).click()
  await page.getByRole('textbox', { name: 'Player name', exact: true }).fill('Ana')
  await page.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter')
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)

  await deaf.getByRole('button', { name: 'Setup', exact: true }).click()
  await deaf.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', /^Ana, (?!no character)/)
  await reload(deaf)
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', /^Ana, (?!no character)/)
  await deaf.close()

  await reload(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, (?!no character)/)
  await expect(page.locator('[data-seat-context-target]').getByRole('button', { name: /, no character$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Setup', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start the first night', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deal at random', exact: true })).toHaveCount(0)
})
