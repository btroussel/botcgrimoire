import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

// The seats stay empty, so no dealt disguise reminder is already on one; any seat takes a reminder.
const openBoard = async page => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  const seats = page.locator('[data-seat-context-target]')
  await expect(seats).toHaveCount(7)
  // The setup window sits in the ring's centre over the top seat's reminders.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Start the first night', exact: true })).toHaveCount(0)
  return seats
}

// The first reminder the picker offers, placed from the seat menu.
const placeReminder = async (page, seat) => {
  await seat.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Add a reminder', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /, / }).first().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const chip = seat.locator('[data-chip] [role="button"]')
  await expect(chip).toHaveCount(1)
  return chip
}

const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

test('a mouse drags a reminder to another seat, and one dragged back to its own seat stays', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const seats = await openBoard(page)
  const chip = await placeReminder(page, seats.nth(0))
  const label = await chip.getAttribute('aria-label')
  const from = centre(await chip.boundingBox())
  const to = centre(await seats.nth(2).getByRole('button').first().boundingBox())

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
  await expect(seats.nth(0).locator('[data-chip]')).toHaveCount(0)
  const moved = seats.nth(2).locator('[data-chip] [role="button"]')
  await expect(moved).toHaveAttribute('aria-label', label)

  // Released where it started, the click that follows the drag takes nothing off.
  const back = centre(await moved.boundingBox())
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await page.mouse.move(back.x + 80, back.y + 40, { steps: 5 })
  await page.mouse.move(back.x, back.y, { steps: 5 })
  await page.mouse.up()
  await expect(moved).toHaveAttribute('aria-label', label)

  // A plain click still takes it off.
  await moved.click()
  await expect(seats.locator('[data-chip]')).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

  test('a long press lifts a reminder onto another seat, while a quick swipe and a tap keep their meaning', async ({ page, context }) => {
    const session = await context.newCDPSession(page)
    const touch = (type, at) => session.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ x: at.x, y: at.y }] : [] })
    const swipe = async (from, to, steps = 8) => {
      for (let i = 1; i <= steps; i++) await touch('touchMove', { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps })
    }
    const seats = await openBoard(page)
    const chip = await placeReminder(page, seats.nth(0))
    const label = await chip.getAttribute('aria-label')
    const box = await chip.boundingBox()
    const from = centre(box)
    const seat = centre(await seats.nth(3).getByRole('button').first().boundingBox())
    // The lifted reminder rides one reminder's height above the finger, over the seat it lands on.
    const to = { x: seat.x, y: seat.y + box.height }

    await touch('touchStart', from)
    await swipe(from, to)
    await touch('touchEnd')
    await expect(seats.nth(0).locator('[data-chip] [role="button"]')).toHaveAttribute('aria-label', label)

    await touch('touchStart', from)
    await page.waitForTimeout(600)
    await swipe(from, to)
    await touch('touchEnd')
    await expect(seats.nth(0).locator('[data-chip]')).toHaveCount(0)
    const moved = seats.nth(3).locator('[data-chip] [role="button"]')
    await expect(moved).toHaveAttribute('aria-label', label)

    await moved.tap()
    await expect(seats.locator('[data-chip]')).toHaveCount(0)
  })
})
