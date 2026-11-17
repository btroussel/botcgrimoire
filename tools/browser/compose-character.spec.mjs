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

test('a homebrew character placed at the start of other nights stays there after a reload', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Create a character', exact: true }).first().click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Nightshade')
  await page.getByRole('textbox', { name: 'Ability', exact: true }).fill('Each night*, choose a player: they are poisoned tonight.')
  const nights = page.getByRole('radiogroup', { name: 'Other nights', exact: true })
  await nights.getByRole('radio', { name: 'Before the Demon', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Choose the exact place', exact: true }).click()
  await page.getByRole('list', { name: 'Other nights', exact: true }).getByRole('button', { name: 'Wake after Dusk', exact: true }).click()
  await expect(nights.getByRole('radio', { name: 'At the start of the night', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Save character', exact: true }).click()
  const row = page.getByRole('button', { name: 'Edit Nightshade', exact: true })
  await expect(row).toBeVisible()

  await reload(page)
  await row.click()
  await expect(page.getByRole('radiogroup', { name: 'Other nights', exact: true }).getByRole('radio', { name: 'At the start of the night', exact: true })).toBeChecked()
})

test('a homebrew character written for a script is placed among that script\'s steps', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Compose a script', exact: true }).click()
  await page.getByRole('textbox', { name: 'Script name', exact: true }).fill('Small Night')
  await page.getByRole('button', { name: 'Add characters', exact: true }).click()
  const search = page.getByRole('textbox', { name: 'Search characters', exact: true })
  for (const name of ['Monk', 'Imp', 'Empath']) {
    await search.fill(name)
    await page.getByRole('checkbox', { name: `Add ${name}`, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Create a character', exact: true }).click()
  const nights = page.getByRole('radiogroup', { name: 'Other nights', exact: true })
  const before = nights.getByRole('radio', { name: 'Before the Demon', exact: true })
  await expect(before).toHaveAccessibleDescription('After Monk, before Imp')
  await before.check({ force: true })
  await page.getByRole('button', { name: 'Choose the exact place', exact: true }).click()
  const steps = page.getByRole('list', { name: 'Other nights', exact: true }).locator(':scope > [role="listitem"] > [role="button"]')
  await expect(steps).toHaveText(['Dusk', 'Monk', 'Imp', 'Empath', 'Dawn'])
})

test('on a script of homebrew alone, an Outsider placed after a Minion wakes after it', async ({ page }) => {
  const create = async (name, team, wakes = true) => {
    await page.getByRole('button', { name: 'Add characters', exact: true }).click()
    await page.getByRole('button', { name: 'Create a character', exact: true }).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
    await page.getByRole('textbox', { name: 'Ability', exact: true }).fill('You start knowing something.')
    await page.getByRole('radio', { name: team, exact: true }).check({ force: true })
    if (wakes) await page.getByRole('radiogroup', { name: 'First night', exact: true }).getByRole('radio', { name: 'Before the evil team', exact: true }).check({ force: true })
    await page.getByRole('button', { name: 'Save character', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
  }
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Compose a script', exact: true }).click()
  await page.getByRole('textbox', { name: 'Script name', exact: true }).fill('Evil First')
  await create('Owl', 'Outsider')
  await create('Hex', 'Minion')
  // A script needs five characters; these never wake.
  for (const name of ['Baker', 'Cooper', 'Draper']) await create(name, 'Townsfolk', false)

  await page.getByRole('button', { name: 'Edit Owl', exact: true }).click()
  await page.getByRole('button', { name: 'Choose the exact place', exact: true }).click()
  const column = page.getByRole('list', { name: 'First night', exact: true })
  await expect(column.locator(':scope > [role="listitem"] > [role="button"]')).toHaveText(['Dusk', 'Hex', 'Minion info', 'Demon info', 'Dawn'])
  await column.getByRole('button', { name: 'Wake after Hex', exact: true }).click()
  await expect(page.getByRole('radiogroup', { name: 'First night', exact: true }).getByRole('radio', { name: 'Before the evil team', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Save character', exact: true }).click()

  await page.getByRole('button', { name: 'Save script', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Evil First', exact: true })).toBeVisible()
  const firstNight = await page.locator('#script-sheet-nights').innerText()
  expect(firstNight.indexOf('Hex')).toBeGreaterThan(-1)
  expect(firstNight.indexOf('Hex')).toBeLessThan(firstNight.indexOf('Owl'))
})
