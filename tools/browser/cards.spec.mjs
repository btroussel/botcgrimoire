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

// The card is held screen out toward a player, so a tap never closes it: a press held for half a
// second does.
const holdToClose = card => card.click({ delay: 700 })

test('several characters on a card stand in a column on an upright phone, as large as fits', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const picker = page.getByRole('dialog', { name: 'Which character' })
  for (const name of ['Chef', 'Imp', 'Monk']) await picker.getByRole('button', { name, exact: true }).click()
  await picker.getByRole('button', { name: 'Show 3 characters', exact: true }).click()

  // The tokens alone: the card has no words, so the characters name it. Each is large enough to
  // print its name on the arc.
  const card = page.getByRole('dialog', { name: 'Chef, Imp, Monk' })
  await expect(card.getByRole('heading')).toHaveCount(0)
  const names = ['CHEF', 'IMP', 'MONK'].map(name => card.getByText(name, { exact: true }))
  for (const name of names) await expect(name).toBeVisible()
  const [chef, imp, monk] = await Promise.all(names.map(name => name.boundingBox()))
  expect(chef.y).toBeLessThan(imp.y)
  expect(imp.y).toBeLessThan(monk.y)
  // The arc's print is not centred to the pixel, so one name over the other is enough.
  for (const box of [imp, monk]) expect(Math.abs(box.x + box.width / 2 - (chef.x + chef.width / 2))).toBeLessThan(chef.width / 2)
})

test('a tap leaves the card up and says how to close it, and a hold closes it', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This is the Demon')
  const card = page.getByRole('dialog', { name: 'This is the Demon' })
  await expect(card.getByRole('heading')).toBeVisible()

  await card.click()
  await expect(card.getByText('Hold to close', { exact: true })).toBeVisible()
  await expect(card).toBeVisible()

  await holdToClose(card)
  await expect(card).toBeHidden()
})

test('a keyboard closes the card with its one Close button', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'These are your Minions')
  const card = page.getByRole('dialog', { name: 'These are your Minions' })
  await expect(card.getByRole('heading')).toBeVisible()
  await page.keyboard.press('Tab')
  const close = card.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(card).toBeHidden()
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

test('the bluff picker shows the set on screen and saves it, so the tray holds what the Demon saw', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const picker = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await picker.getByRole('button', { name: 'Show', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await expect(card.getByRole('heading')).toBeVisible()
  await holdToClose(card)
  await expect(card).toBeHidden()
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(3)
})
