import { expect, test } from '@playwright/test'

import { open } from './app.mjs'
import { editionName, longestIn, stringsIn } from './locales.mjs'

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

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a tap on a compact night row opens the reference full, once, its filter keeps its own taps, and a seat answers at once', async ({ page }) => {
    await open(page, '/new')
    await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
    await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
    await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
    await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
    await page.getByRole('button', { name: 'Setup', exact: true }).tap()
    await page.getByRole('button', { name: 'Start the first night', exact: true }).tap()
    const tab = page.getByRole('button', { name: 'First night', exact: true })
    const paper = page.getByRole('region', { name: 'First night', exact: true })
    const width = async () => Math.round((await paper.boundingBox())?.width ?? 0)
    await expect.poll(width).toBe(168)

    // The filter's word is what a finger lands on, not its hidden radio.
    await paper.getByText('All', { exact: true }).tap()
    await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked()
    expect(await width()).toBe(168)

    await paper.getByText('Dusk', { exact: true }).tap()
    await expect.poll(width).toBe(382)

    // The widened drawer was for that read: it opens compact again.
    await tab.tap()
    await expect(tab).toHaveAttribute('aria-expanded', 'false')
    await tab.tap()
    await expect(tab).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(width).toBe(168)

    // A seat beside the paper answers the first tap, and the drawer steps aside for its menu.
    const seat = page.locator('[data-seat-context-target]').nth(6)
    await seat.getByRole('button').first().tap()
    await expect(page.getByRole('group', { name: 'Seat 7', exact: true })).toBeVisible()
    await expect(tab).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('group', { name: 'Seat 7', exact: true })).toBeVisible()

    // A tap on a reminder takes it off, so with the paper out it only puts the paper away.
    await page.getByRole('button', { name: 'Add a reminder', exact: true }).tap()
    await page.getByRole('dialog').getByRole('button', { name: /, / }).first().tap()
    const chip = seat.locator('[data-chip] [role="button"]')
    await expect(chip).toHaveCount(1)
    await tab.tap()
    await expect(tab).toHaveAttribute('aria-expanded', 'true')
    await chip.tap()
    await expect(tab).toHaveAttribute('aria-expanded', 'false')
    await expect(chip).toHaveCount(1)
  })
})

// Run in the language whose Home labels run longest; shorter labels fit where these do.
const homeLabels = locale => {
  const { common } = stringsIn(locale)
  return [common.resumeGame, common.newGame, common.scripts, common.history, common.settings]
}
const homeLocale = longestIn(homeLabels)

test.describe(`${homeLocale} Home`, () => {
  test.use({ locale: homeLocale })

  test('keeps every action on the shortest windows without scrolling, with a game to resume', async ({ page }) => {
    const { setup } = stringsIn(homeLocale)
    const [resume, ...others] = homeLabels(homeLocale)
    await open(page, '/new')
    for (const name of [editionName(homeLocale, 'tb', 'Trouble Brewing'), setup.shuffleBag, setup.manualOpen, setup.dealRandom]) {
      await page.getByRole('button', { name, exact: true }).click()
    }
    await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
    // A phone on its side, and a small phone in portrait under its browser bars.
    for (const viewport of [{ width: 568, height: 320 }, { width: 320, height: 460 }]) {
      await page.setViewportSize(viewport)
      await open(page, '/')
      // Each action sits wholly inside the window, so none needs a scroll. Resume's name carries
      // the game after its label.
      for (const action of [page.getByRole('button', { name: new RegExp(`^${resume}, `) }),
        ...others.map(name => page.getByRole('button', { name, exact: true }))]) {
        await expect(action).toBeInViewport({ ratio: 1 })
        expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
