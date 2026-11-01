import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block' })

test('a direct load on a wide window draws the wide layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, '/scripts')
  const logo = page.getByRole('button', { name: 'Open Trouble Brewing', exact: true }).locator(':scope > div > div').first()
  await expect.poll(async () => (await logo.boundingBox())?.width).toBe(112)
})

test('the export holds its controls but not its text until React has hydrated it', async ({ browser, baseURL, page }) => {
  // Without JavaScript the page stays as exported, as every page is until React hydrates it.
  const exported = await browser.newContext({ baseURL, javaScriptEnabled: false })
  try {
    const before = await exported.newPage()
    await before.goto('/settings')
    const held = before.getByRole('button', { name: 'Language, English', exact: true })
    await expect(held).toHaveCSS('pointer-events', 'none')
    await expect(held).toHaveCSS('opacity', '0.4')
    await expect(before.getByRole('heading', { name: 'Settings', exact: true })).toHaveCSS('opacity', '1')
  } finally { await exported.close() }
  await open(page, '/settings')
  const live = page.getByRole('button', { name: 'Language, English', exact: true })
  await expect(live).toHaveCSS('pointer-events', 'auto')
  await expect(live).toHaveCSS('opacity', '1')
})

test('a language\'s Home opens in its language and keeps it until another is chosen', async ({ page, request }) => {
  const errors = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  // The browser asks for English; a first visit to the French Home stays French.
  await open(page, '/fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { name: 'Grimoire BotC', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nouvelle partie', exact: true })).toBeVisible()
  // A first visit is offered what the app is; the card's text stays out of sight until asked for,
  // and once the prompt is followed, the button beside the badge still opens it.
  const reading = page.getByRole('heading', { level: 2, name: 'Un grimoire numérique pour Blood on the Clocktower', exact: true })
  await expect(reading).toBeHidden()
  const prompt = page.getByRole('button', { name: /^Première visite.+Découvrez l'app$/ })
  await prompt.click()
  await expect(reading).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reading).toBeHidden()
  await expect(prompt).toHaveCount(0)
  await page.getByRole('button', { name: "À propos de l'app", exact: true }).click()
  await expect(reading).toBeVisible()
  await page.keyboard.press('Escape')
  // The export and the first render agree: a production build reports a mismatch only by number.
  expect(errors.filter((text) => /hydrat|react\.dev\/errors\/(418|423|425)/i.test(text))).toEqual([])
  // Another screen loaded later keeps it rather than the browser's.
  await open(page, '/settings')
  const french = page.getByRole('button', { name: 'Langue, Français', exact: true })
  await expect(french).toBeVisible()
  // A saved choice wins over every later entry URL.
  await french.click()
  await page.getByRole('button', { name: 'English (en)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Language, English', exact: true })).toBeVisible()
  await open(page, '/de')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await open(page, '/fr')
  await expect(page).toHaveURL(/\/fr$/)
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await open(page, '/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const slash = await request.get('/fr/', { maxRedirects: 0 })
  expect(new URL(slash.headers().location, 'http://127.0.0.1:4173').pathname).toBe('/fr')
  expect((await request.get('/xx')).status()).toBe(404)
})

test('a character created from the phone catalogue joins the draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '/scripts')
  await page.getByRole('button', { name: 'Compose a script', exact: true }).click()
  await page.getByRole('button', { name: 'Add characters', exact: true }).click()
  await page.getByRole('button', { name: 'Create a character', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Lamplighter')
  await page.getByRole('textbox', { name: 'Ability', exact: true }).fill('Each night, learn a number.')
  await page.getByRole('button', { name: 'Save character', exact: true }).click()
  // The catalogue is still open for more additions, with the new character chosen.
  await expect(page.getByRole('checkbox', { name: 'Remove Lamplighter', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Lamplighter', exact: true })).toBeVisible()
})
