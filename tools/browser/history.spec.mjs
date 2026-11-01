import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block' })

const pins = JSON.parse(await readFile(new URL('../../assets/upstream.json', import.meta.url), 'utf8'))
const savedGame = (script, count) => {
  const roles = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor', 'butler', '_empty', 'poisoner', 'spy', 'baron', 'scarletwoman', 'imp'].slice(-count)
  const start = Date.UTC(2026, 8, 22, 16)
  const events = roles.map((character, at) => ({ kind: 'addSeat', seat: `seat-${at}`, at,
    name: at === 0 ? 'Alexandrine avec un nom très long' : `Player ${at + 1}`, character,
    alignment: ['poisoner', 'spy', 'baron', 'scarletwoman', 'imp'].includes(character) ? 'evil' : 'good',
  }))
  events.push({ kind: 'setBluffs', characters: ['saint', 'drunk', 'recluse'] })
  events.push({ kind: 'placeToken', seat: 'seat-1', token: ['fortuneteller', 'Red Herring'], source: 'seat-5' })
  events.push({ kind: 'phase', to: 'night', night: 1 })
  events.push({ kind: 'kill', seat: 'seat-0', cause: 'storyteller' })
  events.push({ kind: 'phase', to: 'day' })
  const nomination = events.push({ kind: 'nominate', by: 'seat-2', of: 'seat-0' }) - 1
  for (const seat of ['seat-2', 'seat-3', 'seat-4']) events.push({ kind: 'vote', nomination, seat, weight: 1 })
  return { version: 14, id: `history-test-${script}`, script, mode: 'free',
    createdAt: start, updatedAt: start + 5_400_000,
    content: { release: pins['botc-release'].revision, translations: pins['botc-translations'].revision },
    playTime: [{ start, end: start + 5_400_000 }],
    log: events.map((event, id) => ({ ...event, id, audience: 'storyteller', recordedAt: start + id * 1000 })),
  }
}

const importGame = async (page, game, label = 'Import game') => {
  const count = await page.getByRole('article').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: label, exact: true }).click()
  await (await chooser).setFiles({ name: 'history-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(game)) })
  await expect(page.getByRole('article')).toHaveCount(count + 1)
  await expect(page.getByText('Alexandrine avec un nom très long', { exact: true }).last()).toBeVisible()
}

test('French history fits a phone, keeps every player and respects reduced motion', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, locale: 'fr-FR', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  try {
    await open(page, '/history')
    await importGame(page, savedGame('tb', 20), 'Importer une partie')
    await expect(page.getByText('1 partie enregistrée', { exact: true })).toBeVisible()
    await expect(page.locator('.history-player')).toHaveCount(20)
    await expect(page.locator('.history-player').first()).toContainText('Alexandrine avec un nom très long')
    await expect(page.locator('.history-player').first()).toContainText('Mort · Nuit 1')
    await expect(page.locator('.history-reminder')).toHaveCount(1)
    await expect(page.locator('.history-bluff')).toHaveCount(3)
    const chronicle = page.getByRole('region', { name: 'Jours et nuits', exact: true })
    await expect(chronicle).toContainText('Alexandrine avec un nom très long meurt')
    await expect(chronicle).toContainText('Player 3 → Alexandrine avec un nom très long : 3 votes')

    for (const width of [390, 320, 844]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const overflow = await page.locator('.history-player, .history-reminder, .history-fact, .history-preview-token, .history-bluff, .history-actions').evaluateAll(elements =>
        elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.left < 0 || rect.right > innerWidth }).length)
      expect(overflow).toBe(0)
    }
    expect(await page.locator('.history-chevron').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
    const detailsId = await page.locator('.history-details').getAttribute('id')
    await open(page, `/history/${detailsId.replace('history-details-', '')}`)
    await expect(page.getByRole('region', { name: 'Détails de la partie', exact: true })).toBeVisible()
    await expect(page.locator('.history-player')).toHaveCount(20)
  } finally { await context.close() }
})
