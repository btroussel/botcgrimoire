import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()
const button = (page, name) => page.getByRole('button', { name, exact: true })

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// Every seat's token and name against a box, so the actions are seen to keep clear of the table.
const clearOfSeats = async (page, box) => {
  const seats = await page.locator('[data-seat-context-target]').evaluateAll(all => all.map(seat => {
    const { x, y, width, height } = seat.getBoundingClientRect()
    return { x, y, width, height }
  }))
  expect(seats.filter(at => overlaps(at, box))).toEqual([])
}

const finish = async (page, winner, seats = 7) => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').click()
  for (let more = 7; more < seats; more++) await button(page, 'More players').click()
  await button(page, 'Shuffle characters').click()
  await button(page, 'Open grimoire').click()
  await button(page, 'Deal at random').click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(seats)
  await button(page, 'More').click()
  await button(page, 'End game').click()
  await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: winner, exact: true }).click()
}

test.describe('on a tablet', () => {
  test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('a finished game offers its actions under the result and goes Home without asking', async ({ page }) => {
    await finish(page, 'Good wins')
    // Show a card and More have nothing left to do, so only Undo stays at the edge.
    await expect(button(page, 'More')).toHaveCount(0)
    await expect(button(page, 'Show a card')).toHaveCount(0)
    await expect(button(page, 'Undo')).toBeVisible()
    const playAgain = await button(page, 'Play again').boundingBox()
    const home = await button(page, 'Home').boundingBox()
    const words = await page.getByRole('status').filter({ hasText: 'Good wins' }).boundingBox()
    expect(playAgain.y).toBeGreaterThan(words.y)
    expect(Math.abs(playAgain.x + playAgain.width / 2 - (words.x + words.width / 2))).toBeLessThan(2)
    await clearOfSeats(page, { ...playAgain, height: home.y + home.height - playAgain.y })

    await button(page, 'Replay').click()
    const exit = button(page, 'Exit replay')
    await expect(exit).toBeVisible()
    await exit.click()
    await expect(exit).toHaveCount(0)

    await button(page, 'Home').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    // A device that has played drops the first-visit nudge and offers Feedback beside About.
    await expect(button(page, 'New game')).toBeVisible()
    await expect(button(page, 'Feedback')).toBeVisible()
    await expect(button(page, 'New here? See what the app does')).toHaveCount(0)
  })

  test('Play again seats the same players in order on the script of choice', async ({ page }) => {
    await open(page, '/new')
    await button(page, 'Trouble Brewing').click()
    await button(page, 'More players').click()
    await button(page, 'Open grimoire').click()
    await expect(page.locator('[data-seat-context-target]')).toHaveCount(8)
    for (const [at, name] of [[0, 'Ana'], [2, 'Ben']]) {
      await seat(page, at).click()
      await button(page, 'Rename player').click()
      await page.getByRole('textbox', { name: 'Player name', exact: true }).fill(name)
      await page.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter')
      await page.keyboard.press('Escape')
      await expect(seat(page, at)).toHaveAttribute('aria-label', new RegExp(`^${name}, `))
    }
    await button(page, 'More').click()
    await button(page, 'End game').click()
    await page.getByRole('dialog', { name: 'End game' }).getByRole('button', { name: 'Evil wins', exact: true }).click()

    await button(page, 'Play again').click()
    await expect(page).toHaveURL(/\/new\?from=/)
    await button(page, 'Bad Moon Rising').click()
    await expect(page.getByText('8 players', { exact: true }).first()).toBeVisible()
    await button(page, 'Open grimoire').click()
    await expect(page.locator('[data-seat-context-target]')).toHaveCount(8)
    const names = await page.locator('[data-seat-context-target]').evaluateAll(all =>
      all.map(at => at.querySelector('[role="button"]').getAttribute('aria-label').split(',')[0]))
    expect(names).toEqual(['Ana', 'Seat 2', 'Ben', 'Seat 4', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'])
    // The new game is live and the old one stays finished in History.
    await expect(button(page, 'More')).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('the actions dock at the foot, clear of every seat, and Undo takes them away with the result', async ({ page }) => {
    await finish(page, 'Evil wins', 10)
    const playAgain = await button(page, 'Play again').boundingBox()
    const home = await button(page, 'Home').boundingBox()
    expect(playAgain.y + playAgain.height).toBeGreaterThan(844 - 80)
    expect(Math.abs(home.y - playAgain.y)).toBeLessThan(playAgain.height)
    expect(playAgain.x).toBeLessThan(home.x)
    await clearOfSeats(page, { x: 0, y: playAgain.y, width: 390, height: playAgain.height })

    await button(page, 'Undo').click()
    await expect(button(page, 'Play again')).toHaveCount(0)
    await expect(button(page, 'More')).toBeVisible()
  })
})
