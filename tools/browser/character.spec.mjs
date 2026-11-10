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
