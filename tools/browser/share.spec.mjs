import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

const script = (name) => [
  { id: '_meta', name, author: 'Camille', bootlegger: ['Dead players may whisper.'] },
  'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk', 'ravenkeeper',
  'virgin', 'slayer', 'soldier', 'mayor', 'butler', 'drunk', 'recluse', 'saint', 'poisoner', 'spy', 'scarletwoman', 'baron', 'imp',
  { id: 'brewerx7k2', name: 'Brewer', team: 'townsfolk', ability: 'Each night, choose a player: you learn whether they are drunk or poisoned.' },
]

const device = async (browser, baseURL, permissions = []) => {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 390, height: 844 }, permissions })
  return { context, page: await context.newPage() }
}

const importFile = async (page, items) => {
  await page.getByRole('button', { name: 'Import a script', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose a file', exact: true }).click()
  await (await chooser).setFiles({ name: 'script.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(items)) })
}

// A picked file opens unsaved, so saving it is its own step.
const importAndSave = async (page, items) => {
  await importFile(page, items)
  await page.getByRole('button', { name: 'Save to your scripts', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()
}

test('a file imported twice is kept once', async ({ browser, baseURL }) => {
  const { context, page } = await device(browser, baseURL)
  try {
    await open(page, '/scripts')
    await importFile(page, script('Filed Script'))
    await expect(page.getByRole('heading', { name: 'Filed Script', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Save to your scripts', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Open Filed Script', exact: true })).toHaveCount(1)

    // The same file again reads as the saved script rather than offering a second copy.
    await importFile(page, script('Filed Script'))
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save to your scripts', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Back', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Open Filed Script', exact: true })).toHaveCount(1)
  } finally {
    await context.close()
  }
})

test('a copied link opens the script on another device, which saves it once', async ({ browser, baseURL }) => {
  const sender = await device(browser, baseURL, ['clipboard-read', 'clipboard-write'])
  const receiver = await device(browser, baseURL)
  try {
    await open(sender.page, '/scripts')
    await importAndSave(sender.page, script('Shared Script'))
    await sender.page.getByRole('button', { name: 'Share', exact: true }).click()
    await expect(sender.page.getByRole('img', { name: 'QR code for Shared Script' })).toBeVisible()
    await sender.page.getByRole('button', { name: 'Copy the link', exact: true }).click()
    await expect(sender.page.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible()
    const link = await sender.page.evaluate(() => navigator.clipboard.readText())
    expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4173\/scripts#script=[\w-]+$/)

    const { page } = receiver
    await open(page, link)
    await expect(page.getByRole('heading', { name: 'Shared Script', exact: true })).toBeVisible()
    await expect(page.getByText('Brewer', { exact: true })).toBeVisible()
    // The homebrew rules travel with the link and read under the Bootlegger, whose ability promises them.
    await expect(page.locator('#script-sheet-row-bootlegger').getByRole('list', { name: 'Homebrew rules' }).getByRole('listitem'))
      .toContainText(['Dead players may whisper.'])
    await page.getByRole('button', { name: 'Save to your scripts', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await page.getByRole('button', { name: 'Back', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Open Shared Script', exact: true })).toHaveCount(1)

    // Opened again, the link reads as the saved script rather than offering a second copy.
    await open(page, link)
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save to your scripts', exact: true })).toHaveCount(0)
  } finally {
    await sender.context.close()
    await receiver.context.close()
  }
})

test('New game and the library lead to each other', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const button = (name) => page.getByRole('button', { name, exact: true })
  // The pages under this one stay in the document, hidden, and text is found there too.
  const shown = (text) => page.getByText(text, { exact: true }).filter({ visible: true })
  await open(page, '/new')
  // A script New game does not list is one tap from the library's import window.
  await button('Import a script').click()
  await expect(button('Choose a file')).toBeVisible()
  await expect(page).toHaveURL(/\/scripts$/)
  const chooser = page.waitForEvent('filechooser')
  await button('Choose a file').click()
  await (await chooser).setFiles({ name: 'script.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(script('Table Script'))) })
  await expect(page.getByRole('heading', { name: 'Table Script', exact: true })).toBeVisible()
  // A file opens unsaved, and only a script on the device starts a game.
  await expect(button('New game')).toHaveCount(0)
  await button('Save to your scripts').click()
  await expect(button('New game')).toBeVisible()
  // Every toolbar control stays on the paper at phone width.
  const toolbar = page.locator('#script-sheet-toolbar')
  expect(await toolbar.evaluate(bar => bar.scrollWidth <= bar.clientWidth)).toBe(true)
  await expect(toolbar.getByRole('button', { name: 'Print', exact: true })).toBeVisible()

  // The sheet starts a game on its script, on the bag, and Back returns to the sheet.
  await button('New game').click()
  await expect(page).toHaveURL(/\/new\?script=\w+$/)
  await expect(button('Open grimoire')).toBeVisible()
  await expect(shown('Table Script')).toBeVisible()
  await button('Back').click()
  await expect(button('Share')).toBeVisible()
  await button('New game').click()
  await button('Open grimoire').click()
  await expect(page).toHaveURL(/\/game\/\w+$/)

  // An edition's sheet does the same, and a reload keeps the script.
  await open(page, '/scripts')
  await button('Open Bad Moon Rising').click()
  await button('New game').click()
  await expect(page).toHaveURL(/\/new\?script=bmr$/)
  await expect(shown('Bad Moon Rising')).toBeVisible()
  await expect(button('Open grimoire')).toBeVisible()
  await reload(page)
  await expect(button('Open grimoire')).toBeVisible()
  await expect(shown('Bad Moon Rising')).toBeVisible()
})
