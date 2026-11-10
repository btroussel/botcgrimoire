import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

const button = (page, name) => page.getByRole('button', { name, exact: true })
const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()
const fromMore = async (page, name) => {
  await button(page, 'More').tap()
  await button(page, name).tap()
}
const onTheBlock = page => page.locator('[data-seat-context-target]').evaluateAll(seats => seats
  .map((seat, index) => seat.querySelector('[aria-label]')?.getAttribute('aria-label')?.includes('On the block') ? index + 1 : undefined)
  .filter(Boolean))

// A new device opens on seven seats, with the setup window up over the toolbar.
const openTable = async page => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').tap()
  await button(page, 'Shuffle characters').tap()
  await button(page, 'Open grimoire').tap()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
}

test('undoing the deal puts the bag back, Redo deals it again, and the opening table stays', async ({ page }) => {
  await openTable(page)
  await button(page, 'Close').tap()
  await button(page, 'More').tap()
  await expect(button(page, 'Undo')).toBeDisabled()
  await expect(button(page, 'Redo')).toHaveCount(0)
  await page.keyboard.press('Escape')

  await button(page, 'Setup').tap()
  await button(page, 'Deal at random').tap()
  await fromMore(page, 'Undo')
  await button(page, 'Setup').tap()
  await expect(page.getByText('0 of 7 characters assigned', { exact: true })).toBeVisible()
  await expect(button(page, 'Deal at random')).toBeVisible()
  await button(page, 'Close').tap()

  await fromMore(page, 'Redo')
  await button(page, 'More').tap()
  await expect(button(page, 'Redo')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await button(page, 'Setup').tap()
  await expect(page.getByText('7 of 7 characters assigned', { exact: true })).toBeVisible()
  await expect(button(page, 'Deal at random')).toHaveCount(0)
})

test('undoing Mark reopens the vote, and undoing the ending resumes the game', async ({ page }) => {
  await openTable(page)
  await button(page, 'Deal at random').tap()
  await button(page, 'Setup').tap()
  await button(page, 'Start the first night').tap()
  await button(page, 'Night 1').tap()
  await button(page, 'Start the day').tap()

  await seat(page, 0).tap()
  await seat(page, 2).tap()
  const vote = page.getByRole('region', { name: 'Seat 1 nominates Seat 3' })
  for (const hand of [3, 4, 5, 6]) await seat(page, hand).tap()
  await button(page, 'Mark').tap()
  await expect(vote).toHaveCount(0)
  expect(await onTheBlock(page)).toEqual([3])

  await fromMore(page, 'Undo')
  await expect(vote).toContainText('4 votes')
  expect(await onTheBlock(page)).toEqual([])
  // One more takes back the last hand, as it would have before Mark.
  await fromMore(page, 'Undo')
  await expect(vote).toContainText('3 votes')
  await button(page, 'Done').tap()

  await fromMore(page, 'End game')
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Evil wins', exact: true }).tap()
  await expect(page.getByText('Evil wins', { exact: true }).first()).toBeVisible()
  await fromMore(page, 'Undo')
  await expect(page.getByText('Evil wins', { exact: true })).toHaveCount(0)
  await expect(button(page, 'Day 1')).toBeVisible()
  await button(page, 'More').tap()
  await expect(button(page, 'End game')).toBeEnabled()
})
