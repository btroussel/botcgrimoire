import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ isMobile: true, hasTouch: true, serviceWorkers: 'block', viewport: { width: 390, height: 844 } })

// The mail app is the operating system's, so the check catches the address the page hands it.
const mailTo = page => page.evaluate(() => new Promise(resolve => {
  navigation.addEventListener('navigate', event => {
    if (event.destination.url.startsWith('mailto:')) { event.preventDefault(); resolve(event.destination.url) }
  })
}))

test('someone who has played finds Feedback on Home, writes from Settings and reaches the bug form', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/[^/]+$/)
  await open(page, '/')
  await expect(page.getByRole('button', { name: 'About this app', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Feedback', exact: true }).tap()
  await expect(page).toHaveURL(/\/settings\?section=feedback$/)
  await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeInViewport()

  const mail = mailTo(page)
  await page.getByRole('button', { name: 'Send feedback', exact: true }).tap()
  const url = new URL(await mail)
  expect(url.pathname).toBe('contact@botcgrimoire.com')
  expect(url.searchParams.get('subject')).toBe('BotC Grimoire feedback')
  const body = url.searchParams.get('body').split('\r\n')
  expect(body.slice(0, 4)).toEqual(['', '', '', '-- '])
  // No worker runs here, so no build names itself.
  expect(body.slice(4, 9)).toEqual(['These details help us find the problem:', 'App version: Unknown', 'Language: en', 'Screen: 390 x 844', 'Opened in a browser tab'])

  await page.getByRole('button', { name: 'Copy the address', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Address copied', exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('contact@botcgrimoire.com')

  const form = new URL(await page.getByRole('link', { name: 'report a bug there', exact: true }).getAttribute('href'))
  expect(form.origin + form.pathname).toBe('https://github.com/btroussel/botcgrimoire/issues/new')
  expect(form.searchParams.get('template')).toBe('bug_report.yml')
  expect(form.searchParams.get('device')).toMatch(/^Browser tab, 390 x 844, Mozilla\//)
  expect(form.searchParams.get('language')).toBe('English')
})
