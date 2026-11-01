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
