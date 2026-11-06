import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

const release = async (request, version) => {
  expect((await request.post(`/__test__/release?version=${version}`)).ok()).toBeTruthy()
}
// Settings no longer shows the download status, so the checks read the worker directly: an
// active worker with nothing installing or waiting has the whole release cached.
const installed = page => expect.poll(() => page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration()
  return !!registration?.active && !registration.installing && !registration.waiting
}).catch(() => false)).toBe(true)
const ready = async (page) => {
  await installed(page)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}
const checkUpdate = (page) => page.evaluate(async () => {
  await (await navigator.serviceWorker.getRegistration()).update()
})
const expectSetup = async (page) => {
  await expect(page.getByRole('button', { name: 'Setup', exact: true })).toBeVisible()
}
const createGame = async (page) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/[^/]+$/)
  await expectSetup(page)
  return new URL(page.url()).pathname
}

test.beforeEach(async ({ request }) => { await release(request, 'v1') })

test('host routes work on a first visit or hard reload, including trailing slashes and replay queries', async ({ request }) => {
  for (const path of ['/game/local-123', '/game/local-123/history', '/history/local-123']) {
    const canonical = await request.get(path)
    expect(canonical.status()).toBe(200)
    const redirect = await request.get(`${path}/?replay=1`, { maxRedirects: 0 })
    expect(redirect.status()).toBe(301)
    expect(new URL(redirect.headers().location, 'http://127.0.0.1:4173').pathname).toBe(path)
    expect(new URL(redirect.headers().location, 'http://127.0.0.1:4173').search).toBe('?replay=1')
    const followed = await request.get(`${path}/?replay=1`)
    expect(followed.status()).toBe(200)
    expect(await followed.text()).toBe(await canonical.text())
  }
  expect((await request.get('/not-a-route')).status()).toBe(404)
})

test('a saved game survives normal, hard and offline reloads', async ({ page, context }) => {
  await open(page, '/settings')
  await ready(page)
  const game = await createGame(page)
  await reload(page)
  await expectSetup(page)
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.setBypassServiceWorker', { bypass: true })
  expect((await open(page, game + '/')).status()).toBe(200)
  await expectSetup(page)
  await session.send('Network.setBypassServiceWorker', { bypass: false })
  await context.setOffline(true)
  await open(page, game + '/')
  await reload(page)
  await expectSetup(page)
  // Expo Router's own not-found page draws no app frame, so nothing marks it.
  const missing = await page.goto('/not-a-route')
  expect(missing.status()).toBe(404)
})

const activated = async (page, version) => {
  await expect.poll(() => page.evaluate(async version => (await caches.keys()).includes('botc-grimoire-' + version), version).catch(() => false)).toBe(true)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}

test('a new release automatically updates open game and settings windows', async ({ page, context, request }) => {
  await open(page, '/settings')
  await ready(page)
  const game = await createGame(page)
  const settings = await context.newPage()
  await open(settings, '/settings')
  await ready(settings)
  // About names the running build, which is what a bug report needs.
  const version = name => settings.getByText(`Source code · Version ${name}`, { exact: true })
  await expect(version('v1')).toBeVisible()
  await release(request, 'v2')
  await checkUpdate(settings)
  await activated(settings, 'v2')
  await ready(settings)
  await expect(version('v2')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(game + '$'))
  await expectSetup(page)
  await expect(settings.getByRole('button', { name: 'Update and reload', exact: true })).toHaveCount(0)
  await context.setOffline(true)
  await reload(page)
  await expectSetup(page)
})

test('an interrupted update leaves the app working and the next check installs a fixed release', async ({ page, request }) => {
  await open(page, '/settings')
  await ready(page)
  await release(request, 'broken')
  await checkUpdate(page).catch(() => {})
  // The broken worker fails its install and the running release stays in charge.
  await installed(page)
  await expect(page.getByRole('button', { name: 'Language, English', exact: true })).toBeVisible()
  await release(request, 'v2')
  await checkUpdate(page)
  await activated(page, 'v2')
  await ready(page)
  await reload(page)
  await ready(page)
})
