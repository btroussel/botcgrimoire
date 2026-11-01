import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

test('a finished game offers Replay and goes Home without asking', async ({ page }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  const more = page.getByRole('button', { name: 'More', exact: true })
  await more.click()
  await expect(page.getByRole('button', { name: 'Replay', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'End game', exact: true }).click()
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Good wins', exact: true }).click()

  await more.click()
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  const exit = page.getByRole('button', { name: 'Exit replay', exact: true })
  await expect(exit).toBeVisible()
  await exit.click()
  await expect(exit).toHaveCount(0)

  await more.click()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  // A device that has played no longer offers what the app is.
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'About this app', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New here? See what the app does', exact: true })).toHaveCount(0)
})
