import { deflateRawSync } from 'node:zlib'

import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block' })

// Browsers leave CSS backgrounds off paper unless the reader turns them on, so the art on the
// printed sheet has to be a drawn image. react-native-web's Image keeps a transparent <img> under
// its background, so loaded alone is not enough.
const drawn = (locator) => locator.evaluate((img) =>
  img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '1')

test('the printed sheet keeps the script logo and the night markers', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Open Trouble Brewing', exact: true }).click()
  await page.emulateMedia({ media: 'print' })

  const logo = page.locator('#script-sheet-logo img')
  await expect(logo).toBeVisible()
  await expect.poll(() => drawn(logo)).toBe(true)

  // Each night order opens with Dusk, a marker rather than a character.
  const dusk = page.locator('#script-sheet-nights img').first()
  await expect(dusk).toBeVisible()
  await expect.poll(() => drawn(dusk)).toBe(true)
})

// The app's own link form: the script file deflated into the fragment, base64url.
const scriptLink = (items) =>
  '/scripts#script=' + deflateRawSync(Buffer.from(JSON.stringify(items))).toString('base64url')

test('paper lists the Travellers, Fabled and Loric beside the night orders, not on a page of their own', async ({ page }) => {
  await open(page, scriptLink([
    { id: '_meta', name: 'Paper Test', author: 'Camille' },
    'washerwoman', 'chef', 'empath', 'butler', 'poisoner', 'imp', 'thief', 'spiritofivory',
  ]))
  await expect(page.getByRole('heading', { name: 'Paper Test', exact: true })).toBeVisible()
  await expect(page.getByText('by Camille', { exact: true }).first()).toBeVisible()
  await expect(page.locator('#script-sheet-reference-traveller')).toBeHidden()
  await expect(page.locator('#script-sheet-page-foot')).toBeHidden()

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#script-sheet-block-traveller')).toBeHidden()
  await expect(page.locator('#script-sheet-block-fabled')).toBeHidden()
  await expect(page.locator('#script-sheet-reference-traveller').getByText('Thief', { exact: true })).toBeVisible()
  await expect(page.locator('#script-sheet-reference-fabled').getByText('Spirit of Ivory', { exact: true })).toBeVisible()
  // The head still names the Fabled, whose rule is on the next page.
  await expect(page.locator('#script-sheet-head').getByText('Spirit of Ivory', { exact: true })).toBeVisible()
  const foot = page.locator('#script-sheet-page-foot')
  await expect(foot).toBeVisible()
  await expect(foot).toContainText('The Pandemonium Institute')
  await expect(foot).toContainText('* Not the first night.')
})
