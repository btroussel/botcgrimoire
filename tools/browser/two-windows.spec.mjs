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
// never writes its older copy over the newer one. Its edit, made on what it saw, is dropped, and it
// shows the stored copy with the other window's edit, so the Storyteller makes the edit again.
const renameFirstSeat = async (page) => {
  await seat(page, 0).click()
  await page.getByRole('button', { name: 'Rename player', exact: true }).click()
  await page.getByRole('textbox', { name: 'Player name', exact: true }).fill('Ana')
  await page.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter')
}

const deafWindow = async (context, url) => {
  const deaf = await context.newPage()
  await deaf.addInitScript(() => { delete window.BroadcastChannel })
  await open(deaf, url)
  await expect(deaf.locator('[data-seat-context-target]')).toHaveCount(7)
  return deaf
}

test('a second window that never heard of the first window\'s edit cannot write over it', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
  const deaf = await deafWindow(context, page.url())

  await seat(page, 2).click()
  await page.getByRole('button', { name: 'Mark dead', exact: true }).click()
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
  await expect(seat(deaf, 2)).not.toHaveAttribute('aria-label', /, dead, /)

  // The rename is made on a copy without the death, so it is dropped and the death shows.
  await renameFirstSeat(deaf)
  await expect(seat(deaf, 2)).toHaveAttribute('aria-label', /, dead, /)
  await expect(seat(deaf, 0)).not.toHaveAttribute('aria-label', /^Ana, /)
  await deaf.keyboard.press('Escape')
  await renameFirstSeat(deaf)
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await reload(deaf)
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await deaf.close()

  await reload(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)
  await expect(seat(page, 2)).toHaveAttribute('aria-label', /, dead, /)
})

// One gesture can be two changes, as the deal is: its tokens, then the bag put away. Made on an
// older copy, both are dropped together, so the bag is never put away without its deal.
test('a deal in a window that never heard of an edit is dropped whole, then made once', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Deal at random', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const deaf = await deafWindow(context, page.url())

  await renameFirstSeat(page)
  await expect(seat(page, 0)).toHaveAttribute('aria-label', /^Ana, /)

  await deaf.getByRole('button', { name: 'Setup', exact: true }).click()
  await deaf.getByRole('button', { name: 'Deal at random', exact: true }).click()
  // Dropped: the rename shows, the seats are still empty and the bag is still there to deal.
  await expect(seat(deaf, 0)).toHaveAttribute('aria-label', 'Ana, no character')
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

// A game deleted in one window is gone from the other at once, before its next tap could show an
// edit that has nowhere to land.
test('a game deleted in one window leaves the other window\'s board', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
  const other = await context.newPage()
  await open(other, page.url())
  await expect(other.locator('[data-seat-context-target]')).toHaveCount(7)

  await open(page, '/history')
  await page.getByRole('button', { name: /^Show details for / }).click()
  await page.getByRole('button', { name: /^Delete / }).click()
  await page.getByRole('button', { name: 'Delete this game', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(0)

  // Within moments of the delete: the play-time checkpoint every 30 seconds would find the game
  // gone too, so a longer wait could pass without the message.
  await expect(other.getByText('This game is not on this device. It may have been deleted.', { exact: true })).toBeVisible({ timeout: 3_000 })
  await expect(other.locator('[data-seat-context-target]')).toHaveCount(0)
})
