import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

test('an edition opens as a copy to edit, and saving it leaves the edition as it was', async ({ page }) => {
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Open Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Edit a copy', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Script name', exact: true })
  await expect(name).toHaveValue('Trouble Brewing (copy)')
  await expect(page.getByRole('button', { name: 'Remove Washerwoman', exact: true }).first()).toBeAttached()

  // Nothing changed yet, so Back returns to the edition without asking.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Edit a copy', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit a copy', exact: true }).click()

  await page.getByRole('button', { name: 'Save script', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trouble Brewing (copy)', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Open Trouble Brewing', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Open Trouble Brewing (copy)', exact: true })).toHaveCount(1)
})
