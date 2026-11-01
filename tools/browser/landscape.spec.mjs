import { expect, test } from '@playwright/test'

import { open } from './app.mjs'
import { editionName, longestIn, stringsIn } from './locales.mjs'

const labelsIn = locale => {
  const { board, common, setup } = stringsIn(locale)
  return { script: editionName(locale, 'tb', 'Trouble Brewing'), setup: board.setup, open: setup.manualOpen, shuffle: setup.shuffleBag, deal: setup.dealRandom,
    close: common.close, more: common.more, rename: board.renamePlayer, reminder: board.addReminder, bluffs: board.bluffsTitle,
    alive: board.aliveCount.replace('{alive}', 7).replace('{total}', 7),
    tabs: [board.referenceCharacters, board.sheetFirstNight, board.sheetOtherNights] }
}

// Run in the language whose reference tabs run longest; shorter labels fit where these do.
const locale = longestIn(code => labelsIn(code).tabs)

test.describe(`${locale} landscape board`, () => {
  test.use({ locale, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

  test('keeps references and toolbar reachable through rotation on short screens', async ({ page }) => {
    const text = labelsIn(locale)
    await open(page, '/new')
    await page.getByRole('button', { name: text.script, exact: true }).click()
    await page.getByRole('button', { name: text.shuffle, exact: true }).click()
    await page.getByRole('button', { name: text.open, exact: true }).click()
    await page.getByRole('button', { name: text.deal, exact: true }).click()
    await expect(page.getByRole('button', { name: text.setup, exact: true })).toBeVisible()
    await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)

    const expectInBounds = async locator => {
      const { width, height } = page.viewportSize()
      await expect(locator).toBeInViewport({ ratio: 1 })
      const box = await locator.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }

    for (const viewport of [{ width: 844, height: 390 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport)
      for (const label of [text.setup, text.more, ...text.tabs]) {
        await expectInBounds(page.getByRole('button', { name: label, exact: true }))
      }
      for (const label of text.tabs) {
        expect((await page.getByRole('button', { name: label, exact: true }).boundingBox()).width).toBeGreaterThanOrEqual(44)
      }
      const tokens = page.locator('[data-seat-context-target]')
      for (const token of await tokens.all()) await expectInBounds(token)
      const boxes = await tokens.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()))
      const ringWidth = Math.max(...boxes.map(box => box.right)) - Math.min(...boxes.map(box => box.left))
      const ringHeight = Math.max(...boxes.map(box => box.bottom)) - Math.min(...boxes.map(box => box.top))
      expect(ringWidth).toBeGreaterThan(viewport.width * 0.75)
      expect(ringHeight).toBeGreaterThan(viewport.height * 0.5)
      for (const control of [page.getByRole('button', { name: text.setup, exact: true }),
        page.getByRole('button', { name: text.more, exact: true }), page.getByRole('region', { name: text.bluffs })]) {
        const corner = await control.boundingBox()
        for (const box of boxes) {
          // Player names extend sixteen pixels below their token.
          expect(box.right <= corner.x || box.left >= corner.x + corner.width ||
            box.bottom + 16 <= corner.y || box.top >= corner.y + corner.height).toBe(true)
        }
      }
      // The lower seats must stay below the upper token and its player name.
      expect(Math.min(boxes[3].top, boxes[4].top) - boxes[0].bottom).toBeGreaterThan(16)
      await expect.poll(() => page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(viewport)

      // Fitting the tokens visually must also leave their actual touch targets reachable.
      for (const token of await tokens.all()) {
        await token.getByRole('button').first().tap()
        await expect(page.getByRole('button', { name: text.rename, exact: true })).toBeVisible()
        // Touch has no plus on the rim; the seat menu leads to the reminder picker.
        await page.getByRole('button', { name: text.reminder, exact: true }).tap()
        const close = page.getByRole('button', { name: text.close, exact: true })
        await expectInBounds(close)
        await close.tap()
      }

      for (const label of text.tabs) {
        const tab = page.getByRole('button', { name: label, exact: true })
        await tab.click()
        await expect(tab).toHaveAttribute('aria-expanded', 'true')
        await expectInBounds(tab)
        await tab.click()
        await expect(tab).toHaveAttribute('aria-expanded', 'false')
      }

      await page.getByRole('button', { name: text.more, exact: true }).click()
      for (const item of await page.locator(':popover-open').getByRole('button').all()) await expectInBounds(item)
      await page.keyboard.press('Escape')
    }

    await page.setViewportSize({ width: 390, height: 844 })
    for (const label of text.tabs) {
      const tab = page.getByRole('button', { name: label, exact: true })
      await expectInBounds(tab)
      await expect(tab).toHaveText(label)
    }
    // The tabs sit above the plaque, so they take no width from its players row.
    expect((await page.getByText(text.alive, { exact: true }).boundingBox()).height).toBeLessThan(24)

    // On the smallest phone the labelled tabs still end above the plaque rather than under it.
    await page.setViewportSize({ width: 320, height: 568 })
    const last = page.getByRole('button', { name: text.tabs[2], exact: true })
    await expect(last).toHaveText(text.tabs[2])
    const plaque = await page.getByRole('button', { name: text.setup, exact: true }).boundingBox()
    const tabBox = await last.boundingBox()
    expect(tabBox.y + tabBox.height).toBeLessThanOrEqual(plaque.y)
  })
})
