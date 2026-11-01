import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

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

test('a copied link opens the script on another device, which saves it once', async ({ browser, baseURL }) => {
  const sender = await device(browser, baseURL, ['clipboard-read', 'clipboard-write'])
  const receiver = await device(browser, baseURL)
  try {
    await open(sender.page, '/scripts')
    await importFile(sender.page, script('Shared Script'))
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
