import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

const compose = async (page, name, characters) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Compose a script', exact: true }).click()
  await page.getByRole('textbox', { name: 'Script name', exact: true }).fill(name)
  await page.getByRole('button', { name: 'Add characters', exact: true }).click()
  const search = page.getByRole('textbox', { name: 'Search characters', exact: true })
  for (const character of characters) {
    await search.fill(character)
    await search.press('Enter')
  }
}

// What the composer shows: the name in its field and each character on the sheet.
const expectDraft = async (page, name, characters) => {
  await expect(page.getByRole('textbox', { name: 'Script name', exact: true })).toHaveValue(name)
  for (const character of characters) await expect(page.getByRole('button', { name: `Remove ${character}`, exact: true }).first()).toBeAttached()
}

test('the character search reads abilities after names, and Enter still adds a typed name', async ({ page }) => {
  await compose(page, 'Poison Garden', [])
  const search = page.getByRole('textbox', { name: 'Search characters', exact: true })
  const rows = page.locator('#script-character-picker').getByRole('checkbox')
  await search.fill('poison')
  await expect(rows.first()).toHaveAccessibleName('Add Poisoner')
  expect(await rows.count()).toBeGreaterThan(1)
  await search.fill('Chef')
  await search.press('Enter')
  await expect(search).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Remove Chef', exact: true }).first()).toBeAttached()
})

test('a script being composed comes back after a reload and goes once discarded', async ({ page }) => {
  await compose(page, 'Midnight Bakery', ['Chef', 'Empath'])
  // The schema's limit for a script name, so the saved file stays valid for other tools.
  await expect(page.getByRole('textbox', { name: 'Script name', exact: true })).toHaveAttribute('maxlength', '50')
  await reload(page)
  await expectDraft(page, 'Midnight Bakery', ['Chef', 'Empath'])

  // Back still asks, since the reopened draft differs from the empty one it started as.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Compose a script', exact: true })).toBeVisible()
  await reload(page)
  await expect(page.getByRole('button', { name: 'Compose a script', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Script name', exact: true })).toHaveCount(0)
})
