import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

const openBoard = async page => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
}

const chooseCard = async (page, words) => {
  await page.getByRole('button', { name: 'Show a card', exact: true }).click()
  await page.getByRole('button', { name: words, exact: true }).click()
}

test('a card about a player starts from their character and shows the one picked instead', async ({ page }) => {
  await openBoard(page)
  // The Imp's seat: the deal may seat the Drunk anywhere, and a disguised seat starts empty.
  const seat = page.locator('[data-seat-context-target]').getByRole('button', { name: /, Imp$/ }).first()
  const [player] = (await seat.getAttribute('aria-label')).split(', ')

  await chooseCard(page, 'This player is')
  await seat.click()
  const picker = page.getByRole('dialog', { name: 'Which character' })
  await expect(picker.getByRole('button', { name: 'Imp', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('button', { name: 'Imp', exact: true }).click()
  await picker.getByRole('button', { name: 'Chef', exact: true }).click()
  await picker.getByRole('button', { name: 'Show 1 character', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'This player is' })
  await expect(card.getByText('CHEF', { exact: true })).toBeVisible()
  await expect(card.getByText(player, { exact: true })).toBeVisible()
})

test('several characters on a card share one row on a phone', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const picker = page.getByRole('dialog', { name: 'Which character' })
  await picker.getByRole('button', { name: 'Chef', exact: true }).click()
  await picker.getByRole('button', { name: 'Imp', exact: true }).click()
  await picker.getByRole('button', { name: 'Show 2 characters', exact: true }).click()

  // The tokens alone: the card has no words, so the characters name it.
  const card = page.getByRole('dialog', { name: 'Chef, Imp' })
  await expect(card.getByRole('heading')).toHaveCount(0)
  const names = [card.getByText('Chef', { exact: true }), card.getByText('Imp', { exact: true })]
  for (const name of names) await expect(name).toBeVisible()
  const [chef, imp] = await Promise.all(names.map(name => name.boundingBox()))
  expect(chef.y).toBe(imp.y)
})

test('a long name under a token keeps its word whole on the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const picker = page.getByRole('dialog', { name: 'Which character' })
  const long = ['Washerwoman', 'Undertaker', 'Ravenkeeper']
  for (const name of long) await picker.getByRole('button', { name, exact: true }).click()
  await picker.getByRole('button', { name: 'Show 3 characters', exact: true }).click()

  const card = page.getByRole('dialog', { name: long.join(', ') })
  // A word broken across two lines leaves its characters on two line tops.
  for (const name of long) {
    const lines = await card.getByText(name, { exact: true }).evaluate(caption => {
      const range = document.createRange()
      range.selectNodeContents(caption)
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size
    })
    expect(lines, name).toBe(1)
  }
})
