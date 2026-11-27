import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

const image = new URL('../../assets/art/editions/tb.webp', import.meta.url).pathname

const choose = async (page, label) => {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: label, exact: true }).click()
  await (await chooser).setFiles(image)
}

const sheetLogo = (page) => page.locator('#script-sheet-logo img')
const rowLogo = (page, label) => page.getByRole('button', { name: label, exact: true }).locator('img')

test('a custom script takes a picked image as its logo, shows it where it is listed, and gives it up', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Open Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Edit a copy', exact: true }).click()
  // A copy of an edition starts with the bundled logo, never the edition's own.
  const bundled = await sheetLogo(page).getAttribute('src')
  await expect(page.getByRole('button', { name: 'Remove the logo', exact: true })).toHaveCount(0)

  // The picked file is decoded and encoded again, so the logo shows a moment after the pick.
  await choose(page, 'Choose a logo')
  await expect(sheetLogo(page)).toHaveAttribute('src', /^data:image\//)
  const own = await sheetLogo(page).getAttribute('src')
  await page.getByRole('button', { name: 'Save script', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Trouble Brewing (copy)', exact: true })).toBeVisible()
  await expect(sheetLogo(page)).toHaveAttribute('src', own)
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(rowLogo(page, 'Open Trouble Brewing (copy)')).toHaveAttribute('src', own)
  await expect(rowLogo(page, 'Open Trouble Brewing')).not.toHaveAttribute('src', own)

  await open(page, '/new')
  await expect(rowLogo(page, 'Trouble Brewing (copy)')).toHaveAttribute('src', own)

  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Open Trouble Brewing (copy)', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  // With a logo of its own, the logo opens a menu: another image, or none.
  await page.getByRole('button', { name: 'Change the logo', exact: true }).click()
  await choose(page, 'Choose an image')
  await expect(sheetLogo(page)).toHaveAttribute('src', /^data:image\//)
  await page.getByRole('button', { name: 'Change the logo', exact: true }).click()
  await page.getByRole('button', { name: 'Remove the logo', exact: true }).click()
  await expect(sheetLogo(page)).toHaveAttribute('src', bundled)
  await page.getByRole('button', { name: 'Save script', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(rowLogo(page, 'Open Trouble Brewing (copy)')).toHaveAttribute('src', bundled)
})
