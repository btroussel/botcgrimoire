import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })

test('mobile edge controls do not enlarge the page or allow zooming below its fitted size', async ({ page, context }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Setup', exact: true })).toBeVisible()

  const expectFitted = async () => {
    const { width, height } = page.viewportSize()
    await expect.poll(() => page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }))).toEqual({ width, height, scrollWidth: width, scrollHeight: height })
  }

  // The closed drawer's hidden resize handle still sits past the right edge.
  await expectFitted()
  // It takes no taps while the drawer is closed, so the tab's own edge opens its reference.
  const firstNight = page.getByRole('button', { name: 'First night', exact: true })
  const edge = await firstNight.boundingBox()
  await page.touchscreen.tap(edge.x + edge.width - 3, edge.y + edge.height / 2)
  await expect(firstNight).toHaveAttribute('aria-expanded', 'true')
  await firstNight.tap()
  await expect(firstNight).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Characters', exact: true }).click()
  await expectFitted()
  await page.getByRole('button', { name: 'Characters', exact: true }).click()
  await expectFitted()
  await page.setViewportSize({ width: 844, height: 390 })
  await expectFitted()
  await page.setViewportSize({ width: 390, height: 844 })
  await expectFitted()

  const session = await context.newCDPSession(page)
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
  await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2)
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 0.5 })
  await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(1)
  await expectFitted()
})

test('the phase control on the status plaque stays reachable over the night reference', async ({ page }) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  await page.getByRole('button', { name: 'Setup', exact: true }).tap()
  await page.getByRole('button', { name: 'Start the first night', exact: true }).tap()
  // Entering the night opens its reference, which reaches the board's foot beneath the plaque.
  await expect(page.getByRole('button', { name: 'First night', exact: true })).toHaveAttribute('aria-expanded', 'true')

  for (const [night, viewport] of [[1, { width: 390, height: 844 }], [2, { width: 844, height: 390 }]]) {
    await page.setViewportSize(viewport)
    const phase = page.getByRole('button', { name: `Night ${night}`, exact: true })
    await expect(phase).toBeInViewport({ ratio: 1 })
    await phase.tap()
    await expect(phase).toHaveAttribute('aria-expanded', 'true')
    const startDay = page.getByRole('button', { name: 'Start the day', exact: true })
    await expect(startDay).toBeInViewport({ ratio: 1 })
    await startDay.tap()
    const day = page.getByRole('button', { name: `Day ${night}`, exact: true })
    await day.tap()
    await page.getByRole('button', { name: 'Start the next night', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Other nights', exact: true })).toHaveAttribute('aria-expanded', 'true')
  }
})
