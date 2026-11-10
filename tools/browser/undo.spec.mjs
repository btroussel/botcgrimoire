import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

const button = (page, name) => page.getByRole('button', { name, exact: true })
const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()
const onTheBlock = page => page.locator('[data-seat-context-target]').evaluateAll(seats => seats
  .map((seat, index) => seat.querySelector('[aria-label]')?.getAttribute('aria-label')?.includes('On the block') ? index + 1 : undefined)
  .filter(Boolean))

// A new device opens on seven seats, with the setup window up.
const openTable = async page => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').tap()
  await button(page, 'Shuffle characters').tap()
  await button(page, 'Open grimoire').tap()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
}

test('undoing the deal puts the bag back, and the opening table stays', async ({ page }) => {
  await openTable(page)
  await button(page, 'Close').tap()
  await expect(button(page, 'Undo')).toBeDisabled()

  await button(page, 'Setup').tap()
  await button(page, 'Deal at random').tap()
  await button(page, 'Undo').tap()
  await expect(button(page, 'Undo')).toBeDisabled()
  await button(page, 'Setup').tap()
  await expect(page.getByText('0 of 7 characters assigned', { exact: true })).toBeVisible()
  await expect(button(page, 'Deal at random')).toBeVisible()
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

  await button(page, 'Undo').tap()
  await expect(vote).toContainText('4 votes')
  expect(await onTheBlock(page)).toEqual([])
  // One more takes back the last hand, as it would have before Mark.
  await button(page, 'Undo').tap()
  await expect(vote).toContainText('3 votes')
  await button(page, 'Done').tap()

  await button(page, 'More').tap()
  await button(page, 'End game').tap()
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Evil wins', exact: true }).tap()
  await expect(page.getByText('Evil wins', { exact: true }).first()).toBeVisible()
  await button(page, 'Undo').tap()
  await expect(page.getByText('Evil wins', { exact: true })).toHaveCount(0)
  await expect(button(page, 'Day 1')).toBeVisible()
})

test('a full table keeps every seat clear of Undo', async ({ page }) => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').tap()
  const count = page.getByText(/^\d+ players?$/).first()
  while (Number((await count.textContent()).match(/\d+/)[0]) !== 20) await button(page, 'More players').tap()
  // With no characters chosen there is no bag, so the board opens with no window over it.
  await button(page, 'Open grimoire').tap()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(20)
  const undo = await button(page, 'Undo').boundingBox()
  const seats = await page.locator('[data-seat-context-target]').evaluateAll(all => all.map(seat => {
    const { left, top, right, bottom } = seat.getBoundingClientRect()
    return { left, top, right, bottom }
  }))
  expect(seats).toHaveLength(20)
  for (const box of seats) {
    expect(box.right <= undo.x || box.left >= undo.x + undo.width || box.bottom <= undo.y || box.top >= undo.y + undo.height).toBe(true)
  }
})
