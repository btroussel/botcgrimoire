import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

const ability = (page, text) => page.locator('[id^="script-sheet-ability-"]').filter({ hasText: text })

// The ability in the character draft the editor has kept on the device. A reload is only a fair
// test once that write has landed, and nothing on screen says when it has.
const keptAbility = (page) => page.evaluate(async () => {
  const [{ name }] = await indexedDB.databases()
  const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const db = await request(indexedDB.open(name))
  try {
    return (await request(db.transaction('settings').objectStore('settings').get('draft.character')))?.draft?.ability
  } finally {
    db.close()
  }
})

test('a homebrew character opens from the script being composed, and its new words reach the sheet', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Compose a script', exact: true }).click()
  await page.getByRole('textbox', { name: 'Script name', exact: true }).fill('Midnight Bakery')
  await page.getByRole('button', { name: 'Add characters', exact: true }).click()
  await page.getByRole('button', { name: 'Create a character', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Lamplighter')
  await page.getByRole('textbox', { name: 'Ability', exact: true }).fill('Each night, learn which player is lit.')
  await page.getByRole('button', { name: 'Save character', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  await expect(ability(page, 'Each night, learn which player is lit.')).toBeVisible()
  // Official characters have no record to open.
  await expect(page.getByRole('button', { name: 'Edit Bootlegger', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit Lamplighter', exact: true }).click()
  const field = page.getByRole('textbox', { name: 'Ability', exact: true })
  await expect(field).toHaveValue('Each night, learn which player is lit.')
  await field.fill('Each night, learn which player is dark.')

  // A reload brings the editor back on the same character, with the unsaved words.
  await expect.poll(() => keptAbility(page)).toBe('Each night, learn which player is dark.')
  await reload(page)
  await expect(page.getByRole('textbox', { name: 'Ability', exact: true })).toHaveValue('Each night, learn which player is dark.')
  await page.getByRole('button', { name: 'Save character', exact: true }).click()

  await expect(ability(page, 'Each night, learn which player is dark.')).toBeVisible()
  await expect(ability(page, 'Each night, learn which player is lit.')).toHaveCount(0)
  // Edited, not copied: the draft still lists it once.
  await expect(page.getByRole('button', { name: 'Edit Lamplighter', exact: true })).toHaveCount(1)
})
