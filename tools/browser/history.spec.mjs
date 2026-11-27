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
  events.push({ kind: 'placeToken', seat: 'seat-2', token: ['poisoner', 'Poisoned'], source: 'seat-1' })
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
  const count = await page.locator('.history-row').count()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: label, exact: true }).click()
  await (await chooser).setFiles({ name: 'history-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(game)) })
  await expect(page.locator('.history-row')).toHaveCount(count + 1)
  await expect(page.locator('.history-row-names').filter({ hasText: 'Alexandrine avec un nom très long' })).toBeVisible()
}

test('French history fits a phone, keeps every player and respects reduced motion', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, locale: 'fr-FR', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  try {
    await open(page, '/history')
    await importGame(page, savedGame('tb', 20), 'Importer une partie')
    await expect(page.getByText('1 partie enregistrée', { exact: true })).toBeVisible()
    // A game still running is listed first, and its row names who played. The row opens its page.
    await expect(page.getByRole('heading', { name: 'En cours', exact: true })).toBeVisible()
    await expect(page.locator('.history-row-names')).toContainText('20 joueurs · Alexandrine avec un nom très long, Player 2')
    await page.getByRole('link', { name: /^Trouble Brewing, / }).click()
    await expect(page).toHaveURL(/\/history\/history-test-tb$/)
    await expect(page.getByRole('heading', { name: 'Trouble Brewing', exact: true, level: 1 })).toBeVisible()
    await expect(page.locator('.history-player')).toHaveCount(20)
    await expect(page.locator('.history-player').first()).toContainText('Alexandrine avec un nom très long')
    await expect(page.locator('.history-player').first()).toContainText('Mort, Nuit 1')
    // A reminder dealt in setup stays on its player; one placed at night is told by its night.
    await expect(page.locator('.history-player .history-reminder')).toHaveText(['Leurre'])
    await expect(page.locator('.history-chapter .history-reminder')).toHaveCount(1)
    await expect(page.locator('.history-bluff')).toHaveCount(3)
    const chronicle = page.getByRole('region', { name: 'Jours et nuits', exact: true })
    await expect(chronicle).toContainText('Alexandrine avec un nom très long meurt')
    // A vote is one line that opens on its voters.
    const vote = chronicle.getByLabel('Player 3 → Alexandrine avec un nom très long : 3 votes', { exact: true })
    await expect(chronicle.locator('.history-hand').first()).toBeHidden()
    await vote.click()
    await expect(chronicle.locator('.history-hand').first()).toBeVisible()
    await expect(chronicle.locator('.history-hand')).toHaveText(['Player 3', 'Player 4', 'Player 5'])

    for (const width of [390, 320, 844]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const overflow = await page.locator('.history-player, .history-fate, .history-reminder, .history-fact, .history-vote-line > *, .history-hand, .history-bluff, .history-actions').evaluateAll(elements =>
        elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.left < 0 || rect.right > innerWidth }).length)
      expect(overflow).toBe(0)
    }
    expect(await page.locator('.history-vote-chevron').first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
    // Back returns to the list, and the page's address opens the game with no list behind it.
    await page.getByRole('button', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.locator('.history-row')).toHaveCount(1)
    await open(page, '/history/history-test-tb')
    await expect(page.locator('.history-player')).toHaveCount(20)
    await page.getByRole('button', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.locator('.history-row')).toHaveCount(1)
  } finally { await context.close() }
})

test('History in More lists the running game over its board, latest phase first', async ({ page }) => {
  await open(page, '/history')
  await importGame(page, savedGame('tb', 7))
  await page.getByRole('button', { name: 'Resume Trouble Brewing', exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(7)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  const log = page.getByRole('dialog', { name: 'History', exact: true })
  await expect(log.getByRole('heading', { level: 3 })).toHaveText(['Day 1', 'Night 1'])
  const vote = log.getByLabel('Player 3 → Alexandrine avec un nom très long: 3 votes', { exact: true })
  await expect(log.locator('.history-hand').first()).toBeHidden()
  await vote.click()
  await expect(log.locator('.history-hand').first()).toBeVisible()
  await expect(log.locator('.history-hand')).toHaveText(['Player 3', 'Player 4', 'Player 5'])
  await expect(log).toContainText('Alexandrine avec un nom très long dies')
  await expect(log.getByRole('list', { name: 'Reminder tokens', exact: true })).toHaveText('Poisoned on Player 3')
  await log.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(log).toBeHidden()
  await expect(page).toHaveURL(/\/game\/history-test-tb$/)
})
