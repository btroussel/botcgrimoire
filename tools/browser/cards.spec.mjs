import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

const openBoard = async page => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
}

const chooseCard = async (page, words) => {
  await page.getByRole('button', { name: 'Show a card', exact: true }).click()
  await page.getByRole('button', { name: words, exact: true }).click()
}

// The card is held screen out toward a player, so a tap never closes it: a press held for half a
// second does.
const holdToClose = card => card.click({ delay: 700 })

// The Imp's seat: the deal may seat the Drunk anywhere, and a disguised seat starts empty.
const impSeat = page => page.locator('[data-seat-context-target]').getByRole('button', { name: /, Imp$/ }).first()

test('a card about a player comes up shown with their character, and the sheet stays closed', async ({ page }) => {
  await openBoard(page)
  const seat = impSeat(page)
  const [player] = (await seat.getAttribute('aria-label')).split(', ')

  await chooseCard(page, 'This player is')
  await expect(page.getByRole('dialog', { name: 'Show a card' })).toBeHidden()
  await seat.click()
  const card = page.getByRole('dialog', { name: 'This player is' })
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
  await expect(card.getByText(player, { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Show', exact: true })).toHaveCount(0)
  await holdToClose(card)
  await expect(card).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Show a card' })).toBeHidden()
})

test('a seat menu shows You are for its player in three taps', async ({ page }) => {
  await openBoard(page)
  const seat = impSeat(page)
  const [player] = (await seat.getAttribute('aria-label')).split(', ')
  await seat.click()
  const menu = page.getByRole('group', { name: player, exact: true })
  await menu.getByRole('button', { name: 'Show a card', exact: true }).click()
  // The menu turns in place to the two cards about a player; the others stay under the eye.
  await expect(menu.getByRole('button', { name: 'Add a reminder', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Token only', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
  await menu.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(menu.getByRole('button', { name: 'Add a reminder', exact: true })).toBeVisible()
  await menu.getByRole('button', { name: 'Show a card', exact: true }).click()
  await menu.getByRole('button', { name: 'You are', exact: true }).click()

  await expect(menu).toHaveCount(0)
  const card = page.getByRole('dialog', { name: 'You are' })
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeVisible()
})

test('a card waiting for its player is named in the toolbar, and its cross cancels the pick', async ({ page }) => {
  await openBoard(page)
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const eye = page.getByRole('button', { name: 'Show a card', exact: true })
  await expect(undo).toBeEnabled()
  await chooseCard(page, 'This player is')

  const hint = page.getByText('Tap a player', { exact: true })
  await expect(hint).toBeVisible()
  // The list may still be leaving, so the name is found beside the line.
  await expect(hint.locator('..')).toContainText('This player is')
  await expect(eye).toHaveAttribute('aria-pressed', 'true')
  // What takes no tap during the pick is dimmed and out of reach.
  await expect(undo).toBeDisabled()

  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(hint).toHaveCount(0)
  await expect(eye).not.toHaveAttribute('aria-pressed', 'true')
  await expect(undo).toBeEnabled()
  // The ring is back to its menus: a seat's tap brings up no card.
  const seat = impSeat(page)
  const [player] = (await seat.getAttribute('aria-label')).split(', ')
  await seat.click()
  await expect(page.getByRole('group', { name: player, exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'This player is' })).toHaveCount(0)
})

test('Change on a shown You are types another character, and one key shows it again', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'You are')
  await impSeat(page).click()
  const card = page.getByRole('dialog', { name: 'You are' })
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()

  // Change does not start a hold: the card stays up and goes back to editing.
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toHaveCount(0)
  await expect(card.getByText('CHEF', { exact: true })).toBeVisible()
  await expect(card.getByText('IMP', { exact: true })).toHaveCount(0)
})

test('This character selected you shows on the first key', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This character selected you')
  const card = page.getByRole('dialog', { name: 'This character selected you' })
  // It comes up editing: the cross leaves, and no Show waits for a single token.
  await expect(card.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Show', exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: 'Poisoner', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Poisoner', exact: true })).toHaveCount(0)
  await expect(card.getByText('POISONER', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeVisible()
})

test('the tokens alone take two tokens and show both', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const card = page.getByRole('dialog', { name: 'Token only' })
  const show = card.getByRole('button', { name: 'Show', exact: true })
  await expect(show).toBeDisabled()
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  // A token on the card comes off with a tap while editing, and goes back on from its key.
  await card.getByRole('button', { name: 'Remove Imp', exact: true }).click()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await show.click()
  await expect(show).toHaveCount(0)
  for (const name of ['CHEF', 'IMP']) await expect(card.getByText(name, { exact: true })).toBeVisible()
})

test('an editing card leaves on its cross without showing anything', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const card = page.getByRole('dialog', { name: 'Token only' })
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()
})

test('several characters on a card stand in a column on an upright phone, as large as fits', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const card = page.getByRole('dialog', { name: 'Token only' })
  for (const name of ['Chef', 'Imp', 'Monk']) await card.getByRole('button', { name, exact: true }).click()
  await card.getByRole('button', { name: 'Show', exact: true }).click()

  // The tokens alone have no words. Each is large enough to print its name on the arc.
  await expect(card.getByRole('heading')).toHaveCount(0)
  const names = ['CHEF', 'IMP', 'MONK'].map(name => card.getByText(name, { exact: true }))
  for (const name of names) await expect(name).toBeVisible()
  const [chef, imp, monk] = await Promise.all(names.map(name => name.boundingBox()))
  expect(chef.y).toBeLessThan(imp.y)
  expect(imp.y).toBeLessThan(monk.y)
  // The arc's print is not centred to the pixel, so one name over the other is enough.
  for (const box of [imp, monk]) expect(Math.abs(box.x + box.width / 2 - (chef.x + chef.width / 2))).toBeLessThan(chef.width / 2)
})

test('a tap leaves the card up and says how to close it, and a hold closes it', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This is the Demon')
  const card = page.getByRole('dialog', { name: 'This is the Demon' })
  await expect(card.getByRole('heading')).toBeVisible()

  await card.click()
  await expect(card.getByText('Hold to close', { exact: true })).toBeVisible()
  await expect(card).toBeVisible()

  await holdToClose(card)
  await expect(card).toBeHidden()
})

test('a keyboard closes the card with its one Close button', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'These are your Minions')
  const card = page.getByRole('dialog', { name: 'These are your Minions' })
  await expect(card.getByRole('heading')).toBeVisible()
  await page.keyboard.press('Tab')
  const close = card.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(card).toBeHidden()
})

test('a long name under a token keeps its word whole on the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openBoard(page)
  await chooseCard(page, 'Token only')
  const card = page.getByRole('dialog', { name: 'Token only' })
  const long = ['Washerwoman', 'Undertaker', 'Ravenkeeper']
  for (const name of long) await card.getByRole('button', { name, exact: true }).click()
  await card.getByRole('button', { name: 'Show', exact: true }).click()

  // A word broken across two lines leaves its characters on two line tops.
  for (const name of long) {
    const lines = await card.getByText(name, { exact: true }).evaluate(caption => {
      const range = document.createRange()
      range.selectNodeContents(caption)
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size
    })
    expect(lines, name).toBe(1)
  }
})

test('the not-in-play card with no bluffs saved opens the tray\'s picker, so the tray holds what was shown', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(0)
  await chooseCard(page, 'These characters are not in play')
  const picker = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await picker.getByRole('button', { name: 'Show', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await expect(card.getByRole('heading')).toBeVisible()
  const shown = await card.locator('text').allTextContents()
  await holdToClose(card)
  await expect(card).toBeHidden()
  const saved = (await tray.getByRole('button', { name: /^Bluff: / }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label'))))
    .map(label => label.replace('Bluff: ', '').toUpperCase())
  expect(saved).toHaveLength(3)
  expect(shown.map(name => name.trim())).toEqual(saved)
})

test('Change on the not-in-play card edits what it shows and saves nothing', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  await page.getByRole('dialog', { name: "Demon's Bluffs" }).getByRole('button', { name: 'Save', exact: true }).click()
  const before = await tray.getByRole('button', { name: /^Bluff: / }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label')))
  expect(before).toHaveLength(3)

  await chooseCard(page, 'These characters are not in play')
  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  // Three are on the card, so a key not chosen is dimmed and refused until one comes off.
  await expect(card.locator('[aria-disabled="true"]').first()).toBeVisible()
  await card.getByRole('button', { name: 'Take the last token off', exact: true }).click()
  await expect(card.locator('[aria-disabled="true"]')).toHaveCount(0)
  await card.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(card.locator('text')).toHaveCount(2)
  await holdToClose(card)
  await expect(card).toBeHidden()
  expect(await tray.getByRole('button', { name: /^Bluff: / }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label')))).toEqual(before)
})

test('the bluff picker shows the set on screen and saves it, so the tray holds what the Demon saw', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const picker = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await picker.getByRole('button', { name: 'Show', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await expect(card.getByRole('heading')).toBeVisible()
  await holdToClose(card)
  await expect(card).toBeHidden()
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(3)
})
