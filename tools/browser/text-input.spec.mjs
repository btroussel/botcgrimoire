import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

// Desktop automation has no software keyboard. Change only the visual viewport,
// as mobile browsers do, leaving the layout viewport and board dimensions intact.
const keyboard = (page, height, top = 0) => page.evaluate(({ height, top }) => {
  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: height },
    offsetTop: { configurable: true, value: top },
  })
  visualViewport.dispatchEvent(new Event('resize'))
  visualViewport.dispatchEvent(new Event('scroll'))
}, { height, top })

const closeKeyboard = page => page.evaluate(() => {
  delete visualViewport.height
  delete visualViewport.offsetTop
  visualViewport.dispatchEvent(new Event('resize'))
  visualViewport.dispatchEvent(new Event('scroll'))
})

const expectReachable = async locator => {
  await expect(locator).toBeVisible()
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= visualViewport.offsetTop - 1
      && rect.bottom <= visualViewport.offsetTop + visualViewport.height + 1
      && rect.left >= -1 && rect.right <= innerWidth + 1
  })).toBe(true)
}

const expectFitted = async page => {
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, x: scrollX, y: scrollY })))
    .toEqual({ width: page.viewportSize().width, x: 0, y: 0 })
}

const createGame = async page => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Setup', exact: true })).toBeVisible()
}

test('renaming a low seat moves the menu above the keyboard without moving seats', async ({ page }) => {
  await createGame(page)
  const seats = page.locator('[data-seat-context-target]')
  const positions = () => seats.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }))
  const initial = await positions()
  const lowest = initial.reduce((best, seat, index) => seat.y > initial[best].y ? index : best, 0)
  await seats.nth(lowest).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Rename player', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Player name', exact: true })
  expect(await name.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
  await name.fill('Élodie with a long player name')
  await keyboard(page, 350, 80)
  await expectReachable(name)
  await expectReachable(page.getByRole('button', { name: 'Empty seat', exact: true }))
  await expect(name).toBeFocused()
  expect(await positions()).toEqual(initial)
  await expectFitted(page)
  await name.press('Enter')
  await closeKeyboard(page)
  await page.getByRole('button', { name: 'Rename player', exact: true }).click()
  await expect(name).toHaveValue('Élodie with a long player name')
  await name.fill('Cancelled name')
  await name.press('Escape')
  await page.getByRole('button', { name: 'Rename player', exact: true }).click()
  await expect(name).toHaveValue('Élodie with a long player name')
  await expectFitted(page)
})
