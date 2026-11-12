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
    { id: '_meta', name: 'Paper Test', author: 'Camille', bootlegger: ['The Demon may choose to kill no one.'] },
    'washerwoman', 'chef', 'slayer', 'butler', 'poisoner', 'lleech', 'thief', 'spiritofivory',
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
  // As on the official sheet, the Djinn heads the jinxes, the Fabled and Loric need no heading, and
  // the Bootlegger's rules follow it to this page.
  await expect(page.locator('#script-sheet-refrow-djinn')).toBeVisible()
  await expect(page.locator('#script-sheet-jinxlist').getByText('If the Slayer slays the Lleech host, the host dies.', { exact: true })).toBeVisible()
  await expect(page.locator('#script-sheet-reference-fabled').getByText('Fabled', { exact: true })).toHaveCount(0)
  await expect(page.locator('#script-sheet-reference-loric').getByText('The Demon may choose to kill no one.', { exact: true })).toBeVisible()
  // The head still names the Fabled, whose rule is on the next page.
  await expect(page.locator('#script-sheet-head').getByText('Spirit of Ivory', { exact: true })).toBeVisible()
  const foot = page.locator('#script-sheet-page-foot')
  await expect(foot).toBeVisible()
  await expect(foot).toContainText('The Pandemonium Institute')
  await expect(foot).toContainText('* Not the first night.')
})

// A custom script's own logo is a web address, the only art the app fetches. At a table with no
// signal it never arrives, and the sheet has to show the bundled logo rather than an empty box.
const logoScript = (address) => scriptLink([{ id: '_meta', name: 'Logo Test', logo: address }, 'washerwoman', 'imp'])
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test('a script logo the network cannot reach gives way to the bundled one, on screen and on paper', async ({ page }) => {
  const address = 'https://logo.test/lost.png'
  await page.route(address, (route) => route.abort())
  await open(page, logoScript(address))
  await expect(page.getByRole('heading', { name: 'Logo Test', exact: true })).toBeVisible()

  const logo = page.locator('#script-sheet-logo img')
  await expect.poll(() => drawn(logo)).toBe(true)
  await expect(logo).not.toHaveAttribute('src', address)
  await page.emulateMedia({ media: 'print' })
  await expect.poll(() => drawn(logo)).toBe(true)
})

test('a script logo the network reaches is the one drawn', async ({ page }) => {
  const address = 'https://logo.test/reached.png'
  await page.route(address, (route) => route.fulfill({ contentType: 'image/png', body: pixel }))
  await open(page, logoScript(address))

  const logo = page.locator('#script-sheet-logo img')
  await expect.poll(() => drawn(logo)).toBe(true)
  await expect(logo).toHaveAttribute('src', address)
})
