import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

const art = (file) => new URL(`../../assets/art/characters/tb/${file}`, import.meta.url).pathname

const choose = async (page, label, file) => {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: label, exact: true }).click()
  await (await chooser).setFiles(art(file))
}

const sideImages = (page) => page.getByRole('radiogroup', { name: 'Side shown', exact: true }).locator('img').evaluateAll((images) => images.map((image) => image.src))

test('a homebrew character keeps its own image for the other side', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Create a character', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Lamplighter')
  await page.getByRole('textbox', { name: 'Ability', exact: true }).fill('Each night, learn which player is lit.')
  // The other side has nothing to differ from until the main image exists.
  await expect(page.getByRole('radiogroup', { name: 'Side shown', exact: true })).toHaveCount(0)
  await choose(page, 'Choose an image', 'chef_g.webp')

  await page.getByRole('radio', { name: 'Evil', exact: true }).check()
  await expect(page.getByText('Same image as the other side. Tap the token to choose one for this side.', { exact: true })).toBeVisible()
  const [good, same] = await sideImages(page)
  expect(same).toBe(good)
  await choose(page, 'Choose the image for the evil side', 'chef_e.webp')
  // The editor decodes and re-encodes a picked file, so its image shows a moment after the pick.
  await expect.poll(async () => (await sideImages(page))[1]).not.toBe(good)
  const [kept, evil] = await sideImages(page)
  expect(kept).toBe(good)

  await page.getByRole('radio', { name: 'Good', exact: true }).check()
  await expect(page.getByRole('button', { name: 'Remove both images', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save character', exact: true }).click()

  await page.getByRole('button', { name: 'Edit Lamplighter', exact: true }).click()
  await expect.poll(() => sideImages(page)).toEqual([good, evil])
  await page.getByRole('radio', { name: 'Evil', exact: true }).check()
  await page.getByRole('button', { name: 'Use one image for both sides', exact: true }).click()
  await expect.poll(() => sideImages(page)).toEqual([good, good])
})

test('the character editor shows a field\'s limit and stops at twenty reminder tokens', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Create a character', exact: true }).click()
  const ability = page.getByRole('textbox', { name: 'Ability', exact: true })
  // A short ability carries no count; near the limit it shows, and a longer paste stops at it.
  await ability.fill('a'.repeat(100))
  await expect(page.getByText('100/250', { exact: true })).toHaveCount(0)
  await ability.fill('a'.repeat(231))
  await expect(page.getByText('231/250', { exact: true })).toBeVisible()
  await ability.fill('a'.repeat(300))
  await expect(ability).toHaveValue('a'.repeat(250))
  await expect(page.getByText('250/250', { exact: true })).toBeVisible()

  const add = page.getByRole('button', { name: 'Add a reminder token', exact: true })
  for (let n = 1; n <= 20; n++) await add.click()
  await expect(page.getByRole('textbox', { name: 'Reminder token 20', exact: true })).toBeVisible()
  await expect(add).toHaveCount(0)
})
