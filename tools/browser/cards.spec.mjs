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
  const seat = page.locator('[data-seat-context-target]').first().getByRole('button').first()
  const [player, believed] = (await seat.getAttribute('aria-label')).split(', ')
  const other = believed === 'Chef' ? 'Monk' : 'Chef'

  await chooseCard(page, 'This player is')
  await seat.click()
  const picker = page.getByRole('dialog', { name: 'Which character' })
  await expect(picker.getByRole('button', { name: believed, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('button', { name: believed, exact: true }).click()
  await picker.getByRole('button', { name: other, exact: true }).click()
  await picker.getByRole('button', { name: 'Show 1 character', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'This player is' })
  await expect(card.getByText(other.toUpperCase(), { exact: true })).toBeVisible()
  await expect(card.getByText(player, { exact: true })).toBeVisible()
})

test('several characters on a card share one row on a phone', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This character is')
  const picker = page.getByRole('dialog', { name: 'Which character' })
  await picker.getByRole('button', { name: 'Chef', exact: true }).click()
  await picker.getByRole('button', { name: 'Imp', exact: true }).click()
  await picker.getByRole('button', { name: 'Show 2 characters', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'This character is' })
  const names = [card.getByText('Chef', { exact: true }), card.getByText('Imp', { exact: true })]
  for (const name of names) await expect(name).toBeVisible()
  const [chef, imp] = await Promise.all(names.map(name => name.boundingBox()))
  expect(chef.y).toBe(imp.y)
})
