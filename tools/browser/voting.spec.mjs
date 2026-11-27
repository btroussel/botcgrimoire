import { expect, test } from '@playwright/test'

import { open } from './app.mjs'
import { editionName, longestIn, stringsIn } from './locales.mjs'

const english = { script: 'Trouble Brewing', more: 'More players', fewer: 'Fewer players', count: /^\d+ players?$/,
  shuffle: 'Shuffle characters', open: 'Open grimoire', deal: 'Deal at random', setup: 'Setup', firstNight: 'Start the first night',
  night: 'Night 1', day: 'Start the day', dayWindow: 'Day 1' }
// The setup and phase labels of a locale, read from its UI strings so every language runs the
// same steps.
const escape = text => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
const labelsIn = locale => {
  const { board, common, day, night, setup } = stringsIn(locale)
  const count = Object.values(common.players).map(form => escape(form).replace('{count}', '\\d+'))
  return { script: editionName(locale, 'tb', 'Trouble Brewing'), more: setup.morePlayers, fewer: setup.fewerPlayers, count: new RegExp(`^(${count.join('|')})$`),
    shuffle: setup.shuffleBag, open: setup.manualOpen, deal: setup.dealRandom, setup: board.setup, firstNight: setup.startFirstNight,
    night: board.night.replace('{n}', '1'), day: night.startDay, dayWindow: board.day.replace('{n}', '1'),
    nominate: board.nominate,
    nomination: (by, of) => day.nominationArrow.replace('{by}', setup.defaultSeat.replace('{n}', by)).replace('{of}', setup.defaultSeat.replace('{n}', of)),
    dock: [day.voteReset, day.mark, common.done] }
}

const openDay = async (page, players, text = english) => {
  await open(page, '/new')
  await page.getByRole('button', { name: text.script, exact: true }).click()
  const count = page.getByText(text.count).first()
  await expect(async () => {
    const current = Number((await count.textContent()).match(/\d+/)[0])
    if (current !== players) {
      await page.getByRole('button', { name: current < players ? text.more : text.fewer, exact: true }).click()
    }
    expect(Number((await count.textContent()).match(/\d+/)[0])).toBe(players)
  }).toPass()
  await page.getByRole('button', { name: text.shuffle, exact: true }).click()
  await page.getByRole('button', { name: text.open, exact: true }).click()
  await page.getByRole('button', { name: text.deal, exact: true }).click()
  await expect(page.locator('[data-seat-context-target]')).toHaveCount(players)
  await page.getByRole('button', { name: text.setup, exact: true }).click()
  await page.getByRole('button', { name: text.firstNight, exact: true }).click()
  await page.getByRole('button', { name: text.night, exact: true }).click()
  await page.getByRole('button', { name: text.day, exact: true }).click()
  await expect(page.getByRole('button', { name: text.dayWindow, exact: true })).toBeVisible()
}

const seat = (page, index) => page.locator('[data-seat-context-target]').nth(index).getByRole('button').first()
const nominate = async (page, by, of, hands = []) => {
  await seat(page, by).tap()
  await page.getByRole('button', { name: 'Nominate a player', exact: true }).tap()
  await seat(page, of).tap()
  const controls = page.getByRole('region', { name: `Seat ${by + 1} nominates Seat ${of + 1}` })
  await expect(controls).toBeVisible()
  for (const hand of hands) await seat(page, hand).tap()
  return controls
}
const onTheBlock = page => page.locator('[data-seat-context-target]').evaluateAll(seats => seats
  .map((seat, index) => seat.querySelector('[aria-label]')?.getAttribute('aria-label')?.includes('On the block') ? index + 1 : undefined)
  .filter(Boolean))

test.use({ isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

test('Done records a failed vote, leaves the leader on the block, and History tells that day', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  await nominate(page, 0, 2, [3, 4, 5, 6, 2])
  await page.getByRole('button', { name: 'Mark', exact: true }).tap()
  expect(await onTheBlock(page)).toEqual([3])

  const failed = await nominate(page, 1, 5, [6])
  await page.getByRole('button', { name: 'Done', exact: true }).tap()
  await expect(failed).toHaveCount(0)
  expect(await onTheBlock(page)).toEqual([3])
  // Each seat says whether it nominated or was nominated today, without the list open.
  const seatLabel = index => page.locator('[data-seat-context-target]').nth(index).locator('[aria-label]').first().getAttribute('aria-label')
  expect(await seatLabel(1)).toContain('Has nominated today')
  expect(await seatLabel(5)).toContain('Has been nominated today')
  expect(await seatLabel(3)).not.toContain('nominated today')

  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Seat 1 → Seat 3: 5 votes. On the block', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seat 2 → Seat 6: 1 vote', exact: true })).toBeVisible()

  // History reads the day back from the edits the taps above saved.
  await open(page, '/history')
  await page.getByRole('link', { name: /^Trouble Brewing, / }).tap()
  const day = page.getByRole('region', { name: 'Days and nights', exact: true })
  // A vote is one line there, and its voters open under it.
  const vote = day.getByLabel('Seat 1 → Seat 3: 5 votes', { exact: true })
  await vote.tap()
  await expect(vote.locator('xpath=..').locator('.history-hand')).toHaveText(['Seat 4', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 3'])
  await expect(day).toContainText('Seat 3 is on the block')
  await expect(day.getByLabel('Seat 2 → Seat 6: 1 vote', { exact: true })).toBeVisible()
})

test('hands are numbered in counting order, Execute ends the day, and dawn lists the night\'s deaths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  // Hands tapped out of order still number from the seat after the nominee round to them.
  const controls = await nominate(page, 0, 2, [6, 3, 2, 4])
  await expect(controls.locator('[aria-live]')).toHaveText(/^4\s*of 4$/)
  const place = index => seat(page, index).getAttribute('aria-label').then(label => label.match(/Vote (\d+)$/)?.[1])
  expect(await Promise.all([3, 4, 6, 2, 5].map(place))).toEqual(['1', '2', '3', '4', undefined])
  await seat(page, 4).tap()
  await expect.poll(() => place(6)).toBe('2')
  await seat(page, 4).tap()
  await page.getByRole('button', { name: 'Mark', exact: true }).tap()
  await expect.poll(() => place(3)).toBeUndefined()

  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await page.getByRole('button', { name: 'Execute Seat 3, start night 2', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Night 2', exact: true })).toBeVisible()
  await expect(page.getByText('6 / 7 alive')).toBeVisible()

  // The plaque's menu is where the Storyteller reads out the night's deaths before starting the day.
  const dawn = page.locator('[popover]:popover-open')
  await page.getByRole('button', { name: 'Night 2', exact: true }).tap()
  await expect(dawn).toContainText('Nobody died tonight')
  await page.keyboard.press('Escape')
  await seat(page, 5).tap()
  await page.getByRole('group', { name: 'Seat 6', exact: true }).getByRole('button', { name: 'Mark dead', exact: true }).tap()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Night 2', exact: true }).tap()
  await expect(dawn).toContainText('Died tonight')
  await expect(dawn).toContainText('Seat 6')
  await expect(dawn).not.toContainText('Seat 3')
  await page.getByRole('button', { name: 'Start the day', exact: true }).tap()
  await page.getByRole('button', { name: 'Day 2', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Start the next night', exact: true })).toBeVisible()
})

test('No execution starts the night with the player on the block alive', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  await nominate(page, 0, 2, [3, 4, 5, 6])
  await page.getByRole('button', { name: 'Mark', exact: true }).tap()
  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await page.getByRole('button', { name: 'No execution, start night 2', exact: true }).tap()
  await expect(page.getByText('7 / 7 alive')).toBeVisible()
})

test('by day a tap on another seat moves the menu, a tap off the seats lets a nomination go, and the nominator may pick themselves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  const nominations = page.getByRole('region', { name: /nominates/ })
  await seat(page, 0).tap()
  await seat(page, 2).tap()
  const menu = page.getByRole('group', { name: 'Seat 3', exact: true })
  await expect(menu).toBeVisible()
  await expect(page.getByRole('group', { name: 'Seat 1', exact: true })).toHaveCount(0)
  await expect(nominations).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Nominate self', exact: true })).toHaveCount(0)

  // The middle of the ring is bare velvet while no vote is open.
  await menu.getByRole('button', { name: 'Nominate a player', exact: true }).tap()
  await expect(menu).toHaveCount(0)
  const ring = await page.locator('[data-seat-context-target]').evaluateAll(seats => seats.map(seat => {
    const { x, y, width, height } = seat.getBoundingClientRect()
    return { x: x + width / 2, y: y + height / 2 }
  }))
  await page.touchscreen.tap(ring.reduce((sum, at) => sum + at.x, 0) / ring.length, ring.reduce((sum, at) => sum + at.y, 0) / ring.length)
  await seat(page, 4).tap()
  await expect(page.getByRole('group', { name: 'Seat 5', exact: true })).toBeVisible()
  await expect(nominations).toHaveCount(0)

  await page.getByRole('group', { name: 'Seat 5', exact: true }).getByRole('button', { name: 'Nominate a player', exact: true }).tap()
  await expect(seat(page, 4)).toHaveAccessibleName(/Nominate self/)
  await seat(page, 4).tap()
  await expect(page.getByRole('region', { name: 'Seat 5 nominates Seat 5', exact: true })).toBeVisible()
})

test('only the day\'s seat menu offers a nomination, and the night\'s leaves it out rather than greyed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  const nominate = page.getByRole('group', { name: 'Seat 1', exact: true }).getByRole('button', { name: 'Nominate a player' })
  await seat(page, 0).tap()
  await expect(nominate).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await page.getByRole('button', { name: 'Start the next night', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Night 2', exact: true })).toBeVisible()
  await seat(page, 0).tap()
  await expect(page.getByRole('group', { name: 'Seat 1', exact: true })).toBeVisible()
  await expect(nominate).toHaveCount(0)
})

test('a seat nominates again and a dead player with no ghost vote still raises a hand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openDay(page, 7)
  await seat(page, 4).tap()
  const menu = page.getByRole('group', { name: 'Seat 5', exact: true })
  await menu.getByRole('button', { name: 'Mark dead', exact: true }).tap()
  await menu.getByRole('button', { name: 'Spend ghost vote', exact: true }).tap()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  for (const nominee of [2, 3]) {
    const controls = await nominate(page, 0, nominee, [4])
    await page.getByRole('button', { name: 'Done', exact: true }).tap()
    await expect(controls).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Seat 1 → Seat 3: 1 vote', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seat 1 → Seat 4: 1 vote', exact: true })).toBeVisible()
})

test('a Traveller\'s exile counts the dead hand, keeps its ghost vote and leaves the block alone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Above fifteen seats the shuffle adds one of the script's Travellers.
  await openDay(page, 16)
  const traveller = (await page.locator('[data-seat-context-target]').evaluateAll(seats => seats.map(seat =>
    seat.querySelector('[aria-label]')?.getAttribute('aria-label') ?? '')))
    .findIndex(label => /Scapegoat|Gunslinger|Beggar|Bureaucrat|Thief/.test(label))
  expect(traveller).toBeGreaterThanOrEqual(0)
  const ghost = traveller === 0 ? 1 : 0
  await seat(page, ghost).tap()
  const ghostMenu = page.getByRole('group', { name: `Seat ${ghost + 1}`, exact: true })
  await ghostMenu.getByRole('button', { name: 'Mark dead', exact: true }).tap()
  await page.keyboard.press('Escape')

  await seat(page, traveller).tap()
  await page.getByRole('group', { name: `Seat ${traveller + 1}`, exact: true }).getByRole('button', { name: 'Call for exile', exact: true }).tap()
  const controls = page.getByRole('region', { name: `Exile: Seat ${traveller + 1}`, exact: true })
  await expect(controls.getByRole('img', { name: '8 votes to exile', exact: true })).toBeVisible()
  await expect(controls.locator('[aria-live]')).toHaveText(/^0\s*of 8$/)
  await expect(controls.getByRole('button', { name: 'Mark', exact: true })).toHaveCount(0)
  for (const hand of [ghost, traveller]) await seat(page, hand).tap()
  await controls.getByRole('button', { name: 'Done', exact: true }).tap()
  await expect(controls).toHaveCount(0)

  await seat(page, ghost).tap()
  await expect(ghostMenu.getByRole('button', { name: 'Spend ghost vote', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Day 1', exact: true }).tap()
  await expect(page.getByRole('button', { name: `Exile: Seat ${traveller + 1}, 2 votes`, exact: true })).toBeVisible()
  expect(await onTheBlock(page)).toEqual([])
})

// A seat's token and its name, which sits below the token outside the seat's own box.
const seatBoxes = page => page.locator('[data-seat-context-target]').evaluateAll(seats => seats.map(seat =>
  [seat, ...seat.querySelectorAll('div')].filter(part => part === seat || (part.childElementCount === 0 && part.textContent.trim()))
    .map(part => { const { x, y, width, height } = part.getBoundingClientRect(); return { x, y, width, height } })))
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

for (const players of [6, 12]) {
  test(`the docked voting controls cover no seat or name, ${players} seats on a portrait phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openDay(page, players)
    const controls = await nominate(page, 0, players / 2)
    const dock = await controls.boundingBox()
    const covered = (await seatBoxes(page)).flatMap((parts, index) => parts.some(part => overlap(part, dock)) ? [index + 1] : [])
    expect(covered).toEqual([])
  })
}

// The docked labels are the board's tightest words, checked on the narrowest phone in the
// language where they run longest.
const locale = longestIn(code => labelsIn(code).dock)

test.describe(`in ${locale}`, () => {
  test.use({ locale })
  const text = labelsIn(locale)

  test('the docked voting labels keep whole words at 320 points', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openDay(page, 7, text)
    await seat(page, 0).tap()
    await page.getByRole('button', { name: text.nominate, exact: true }).tap()
    await seat(page, 3).tap()
    const controls = page.getByRole('region', { name: text.nomination(1, 4) })
    await expect(controls).toBeVisible()
    // Each label is one line: every character of it shares the first character's line.
    const lines = await controls.getByRole('button').evaluateAll(buttons => buttons.map(button => {
      const text = [...button.querySelectorAll('div')].find(part => part.childElementCount === 0 && part.textContent.trim())
      const range = document.createRange()
      range.selectNodeContents(text)
      return [text.textContent, new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size]
    }))
    expect(lines).toEqual(text.dock.map(label => [label, 1]))
  })
})
