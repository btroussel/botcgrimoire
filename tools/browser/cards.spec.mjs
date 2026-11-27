import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

const openBoard = async page => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
}

// The eye opens the blank card, with neither keyboard up.
const openBlank = async page => {
  await page.getByRole('button', { name: 'Show a card', exact: true }).click()
  return page.getByRole('dialog', { name: 'Custom note' })
}

// An official phrase on the blank card brings up its own card.
const chooseCard = async (page, words) => {
  const blank = await openBlank(page)
  await blank.getByRole('button', { name: words, exact: true }).click()
}

// The blank card with its token keys up, as the tokens alone are typed.
const openTokens = async page => {
  const card = await openBlank(page)
  await card.getByRole('radiogroup', { name: 'Keyboard', exact: true }).getByRole('radio', { name: 'Tokens', exact: true }).check()
  return card
}

// The card is held screen out toward a player, so a tap never closes it: a press held for half a
// second does.
const holdToClose = card => card.click({ delay: 700 })

// The Imp's seat: the deal may seat the Drunk anywhere, and a disguised seat starts empty.
const impSeat = page => page.locator('[data-seat-context-target]').getByRole('button', { name: /, Imp$/ }).first()

// A card about a player starts from that player's seat, and the eye lists only the others.
const seatCard = async (page, seat, words) => {
  const [player] = (await seat.getAttribute('aria-label')).split(', ')
  await seat.click()
  const menu = page.getByRole('group', { name: player, exact: true })
  await menu.getByRole('button', { name: 'Show a card', exact: true }).click()
  await menu.getByRole('button', { name: words, exact: true }).click()
  return player
}

test('This player is comes up from the seat\'s menu, shown with the character and the player\'s name', async ({ page }) => {
  await openBoard(page)
  const seat = impSeat(page)
  const player = await seatCard(page, seat, 'This player is')
  const card = page.getByRole('dialog', { name: 'This player is' })
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
  await expect(card.getByText(player, { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Show', exact: true })).toHaveCount(0)
  await holdToClose(card)
  await expect(card).toBeHidden()
})

test('the eye opens the blank card at rest, with the phrases about no seat and neither keyboard up', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  for (const name of ['This is the Demon', 'These are your Minions', 'These characters are not in play', 'This character selected you']) {
    await expect(card.getByRole('button', { name, exact: true })).toBeVisible()
  }
  // The two cards about a player start from that player's seat.
  for (const name of ['You are', 'This player is']) await expect(card.getByRole('button', { name, exact: true })).toHaveCount(0)
  const field = card.getByRole('textbox', { name: 'Message' })
  await expect(field).not.toBeFocused()
  const keyboard = card.getByRole('radiogroup', { name: 'Keyboard', exact: true })
  for (const name of ['Letters', 'Tokens']) await expect(keyboard.getByRole('radio', { name, exact: true })).not.toBeChecked()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toHaveCount(0)
  // A tap on the words is for typing.
  await field.click()
  await expect(keyboard.getByRole('radio', { name: 'Letters', exact: true })).toBeChecked()
  await expect(field).toBeFocused()
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
  await expect(menu.getByRole('button', { name: 'This is the Demon', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
  await menu.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(menu.getByRole('button', { name: 'Add a reminder', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Show a card', exact: true })).toBeFocused()
  await menu.getByRole('button', { name: 'Show a card', exact: true }).click()
  await menu.getByRole('button', { name: 'You are', exact: true }).click()

  await expect(menu).toHaveCount(0)
  const card = page.getByRole('dialog', { name: 'You are' })
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeVisible()
})

test('Change on a shown You are types another character, and one key shows it again', async ({ page }) => {
  await openBoard(page)
  await seatCard(page, impSeat(page), 'You are')
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

test('Change on You are opens the same editor as any card: its words can be rewritten', async ({ page }) => {
  await openBoard(page)
  await seatCard(page, impSeat(page), 'You are')
  const card = page.getByRole('dialog', { name: 'You are' })
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  const field = card.getByRole('textbox', { name: 'Message' })
  await expect(field).toHaveValue('YOU ARE')
  await field.fill('YOU ARE NOW')
  await card.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(card.getByRole('heading', { name: 'YOU ARE NOW', exact: true })).toBeVisible()
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
})

test('a card of words takes a token too', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This is the Demon')
  const card = page.getByRole('dialog', { name: 'This is the Demon' })
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  await card.getByRole('radiogroup', { name: 'Keyboard', exact: true }).getByRole('radio', { name: 'Tokens', exact: true }).check()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await card.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(card.getByRole('heading', { name: 'THIS IS THE DEMON', exact: true })).toBeVisible()
  await expect(card.getByText('IMP', { exact: true })).toBeVisible()
})

test('This character selected you shows on the first key', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'This character selected you')
  const card = page.getByRole('dialog', { name: 'This character selected you' })
  // It comes up in the editor every card shares, its phrase written in capitals and its keys up.
  await expect(card.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  await expect(card.getByRole('textbox', { name: 'Message' })).toHaveValue('THIS CHARACTER SELECTED YOU')
  await card.getByRole('button', { name: 'Poisoner', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Poisoner', exact: true })).toHaveCount(0)
  await expect(card.getByText('POISONER', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeVisible()
})

test('the tokens alone are the blank card with no words: two keys, then Show', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  const show = card.getByRole('button', { name: 'Show', exact: true })
  await expect(show).toBeDisabled()
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  // A token on the card comes off by its cross while editing, and goes back on from its key.
  await card.getByRole('button', { name: 'Remove Imp', exact: true }).click()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await show.click()
  await expect(show).toHaveCount(0)
  for (const name of ['CHEF', 'IMP']) await expect(card.getByText(name, { exact: true })).toBeVisible()
})

test('an editing card leaves on its cross without showing anything', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()
})

test('several characters on a card stand in a column on an upright phone, as large as fits', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
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

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true })

  // A touch's lift sends its mouse events and click after the hold has closed the card, at the
  // spot under the thumb: they must not reach Undo there.
  test('a hold over Undo closes the card and leaves the game as it was', async ({ page }) => {
    await openBoard(page)
    await page.locator('[data-seat-context-target]').first().getByRole('button').first().tap()
    await page.getByRole('group', { name: 'Seat 1', exact: true }).getByRole('button', { name: 'Mark dead', exact: true }).tap()
    const alive = page.getByText(/^\d+ \/ \d+ alive$/).first()
    await expect(alive).toHaveText('6 / 7 alive')
    // The menu stays up for the next edit on that seat.
    const menus = page.locator('[role="group"][data-layer]')
    await page.keyboard.press('Escape')
    await expect(menus).toHaveCount(0)
    const undo = await page.getByRole('button', { name: 'Undo', exact: true }).boundingBox()

    await chooseCard(page, 'This is the Demon')
    const card = page.getByRole('dialog', { name: 'This is the Demon' })
    await expect(card.getByRole('heading')).toBeVisible()
    const touch = await page.context().newCDPSession(page)
    const at = { x: undo.x + undo.width / 2, y: undo.y + undo.height / 2 }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] })
    await page.waitForTimeout(700)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(card).toBeHidden()
    await page.waitForTimeout(300)
    await expect(alive).toHaveText('6 / 7 alive')
    await expect(menus).toHaveCount(0)
  })
})

test('a keyboard closes the card with its one Close button', async ({ page }) => {
  await openBoard(page)
  await chooseCard(page, 'These are your Minions')
  const card = page.getByRole('dialog', { name: 'These are your Minions' })
  await expect(card.getByRole('heading')).toBeVisible()
  // The focus waits on Close as the card comes up, so Enter hands the phone back, and Tab goes
  // on to Change and round again.
  const close = card.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(card).toBeHidden()
})

test('a long name under a token keeps its word whole on the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openBoard(page)
  const card = await openTokens(page)
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

// The bluffs drawer's keys: every token key wears aria-pressed, and the wells are named Bluff.
const bluffKeys = drawer => drawer.locator('[role="button"][aria-pressed]:not([aria-label^="Bluff"])')
const keyNames = async (drawer, count) => (await bluffKeys(drawer).evaluateAll(keys => keys.map(key => key.getAttribute('aria-label')))).slice(0, count)
// The ringed well, where the next key goes, says so in its name rather than as pressed.
const wellNames = drawer => drawer.getByRole('button', { name: /^Bluff/ }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label').replace(/, next$/, '')))
const ringed = drawer => drawer.getByRole('button', { name: /^Bluff.*, next$/ })
const trayNames = tray => tray.getByRole('button', { name: /^Bluff: / }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label')))

test('the not-in-play card with no bluffs saved opens the tray\'s drawer, so the tray holds what was shown', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(0)
  await chooseCard(page, 'These characters are not in play')
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  // It opens empty: a random draw would cost a hand pick its taps to undo.
  await expect(drawer.getByRole('button', { name: 'Show', exact: true })).toBeDisabled()
  for (const name of await keyNames(drawer, 3)) await drawer.getByRole('button', { name, exact: true }).click()
  await drawer.getByRole('button', { name: 'Show', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await expect(card.getByRole('heading')).toBeVisible()
  const shown = await card.locator('text').allTextContents()
  await holdToClose(card)
  await expect(card).toBeHidden()
  const saved = (await trayNames(tray)).map(label => label.replace('Bluff: ', '').toUpperCase())
  expect(saved).toHaveLength(3)
  expect(shown.map(name => name.trim())).toEqual(saved)
})

test('three keys fill the bluff wells in order, and a fourth key is never refused', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await expect(ringed(drawer)).toHaveAccessibleName('Bluff 1: empty, next')
  await expect(ringed(drawer)).not.toHaveAttribute('aria-pressed')
  const [a, b, c, d] = await keyNames(drawer, 4)
  for (const name of [a, b, c]) await drawer.getByRole('button', { name, exact: true }).click()
  expect(await wellNames(drawer)).toEqual([a, b, c].map(name => `Bluff: ${name}`))
  // With every well full the ring stays on the last, so the next key replaces it.
  await expect(drawer.locator('[aria-disabled="true"]')).toHaveCount(0)
  await drawer.getByRole('button', { name: d, exact: true }).click()
  expect(await wellNames(drawer)).toEqual([a, b, d].map(name => `Bluff: ${name}`))
  // A full well empties and takes the ring, so a swap is the well, then a key.
  await expect(ringed(drawer)).toHaveAccessibleName(`Bluff: ${d}, next`)
  await drawer.getByRole('button', { name: `Bluff: ${a}`, exact: true }).click()
  await expect(ringed(drawer)).toHaveAccessibleName('Bluff 1: empty, next')
  await drawer.getByRole('button', { name: c, exact: true }).click()
  expect(await wellNames(drawer)).toEqual(['Bluff: ' + c, 'Bluff: ' + b, 'Bluff: ' + d])
  // A chosen key comes back out of its well.
  await drawer.getByRole('button', { name: b, exact: true }).click()
  expect(await wellNames(drawer)).toEqual(['Bluff: ' + c, 'Bluff 2: empty', 'Bluff: ' + d])
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(drawer).toBeHidden()
  expect(await trayNames(tray)).toEqual([c, d].map(name => `Bluff: ${name}`))
})

test('Shuffle fills the empty wells and keeps a hand pick', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  // The third well opens ringed, so the hand pick goes there.
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).nth(2).click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  const [pick] = await keyNames(drawer, 1)
  await drawer.getByRole('button', { name: pick, exact: true }).click()
  await drawer.getByRole('button', { name: 'Shuffle bluffs', exact: true }).click()
  const wells = await wellNames(drawer)
  expect(wells).toHaveLength(3)
  expect(wells[2]).toBe(`Bluff: ${pick}`)
  expect(new Set(wells).size).toBe(3)
  expect(wells.every(well => well.startsWith('Bluff: '))).toBe(true)
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  expect(await trayNames(tray)).toEqual(wells)
})

test('Change on the not-in-play card edits what it shows and saves nothing', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await drawer.getByRole('button', { name: 'Shuffle bluffs', exact: true }).click()
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  const before = await trayNames(tray)
  expect(before).toHaveLength(3)

  await chooseCard(page, 'These characters are not in play')
  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  // Three are on the card, so a key not chosen is dimmed and refused until one comes off.
  await expect(card.locator('[aria-disabled="true"]').first()).toBeVisible()
  await card.getByRole('button', { name: /^Remove / }).last().click()
  await expect(card.locator('[aria-disabled="true"]')).toHaveCount(0)
  await card.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(card.locator('text')).toHaveCount(2)
  await holdToClose(card)
  await expect(card).toBeHidden()
  expect(await trayNames(tray)).toEqual(before)
})

test('the bluffs drawer shows the set on screen and saves it, so the tray holds what the Demon saw', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await drawer.getByRole('button', { name: 'Shuffle bluffs', exact: true }).click()
  await drawer.getByRole('button', { name: 'Show', exact: true }).click()

  const card = page.getByRole('dialog', { name: 'These characters are not in play' })
  await expect(card.getByRole('heading')).toBeVisible()
  await holdToClose(card)
  await expect(card).toBeHidden()
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(3)
})

// A device's keyboard shrinks only the visible viewport. Desktop automation has no software
// keyboard, so the test shrinks it as a phone would.
const keyboardUp = (page, height) => page.evaluate(h => {
  Object.defineProperty(visualViewport, 'height', { configurable: true, value: h })
  visualViewport.dispatchEvent(new Event('resize'))
}, height)

test('a number typed on the card shows at a lone number\'s size', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  const field = card.getByRole('textbox', { name: 'Message' })
  await field.click()
  await field.fill('3')
  // The phrases go with the first character.
  await expect(card.getByRole('button', { name: 'This is the Demon', exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(field).toHaveCount(0)
  await expect(card.getByRole('heading', { name: '3', exact: true })).toHaveCSS('font-size', '96px')
  await expect(card.getByRole('button', { name: 'Change', exact: true })).toBeVisible()
})

test('typed words with tokens show them all, and the bar stays above the device keyboard', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  const field = card.getByRole('textbox', { name: 'Message' })
  const show = card.getByRole('button', { name: 'Show', exact: true })
  await expect(show).toBeDisabled()
  await field.fill('Watch your left')
  await keyboardUp(page, 400)
  const bottom = async () => { const box = await show.boundingBox(); return box.y + box.height }
  await expect.poll(bottom).toBeLessThanOrEqual(400)
  // With the keyboard down the bar goes back to the foot before the next tap.
  await keyboardUp(page, 844)
  await expect.poll(bottom).toBeGreaterThan(800)

  // The two keyboards swap: the caret leaves with the letters and comes back with them. The
  // switch is one radio group, so it is one tab stop.
  const keyboard = card.getByRole('radiogroup', { name: 'Keyboard', exact: true })
  await keyboard.getByRole('radio', { name: 'Tokens', exact: true }).check()
  await expect(field).not.toBeFocused()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  // The card takes any number of tokens, each with its own cross.
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Remove Imp', exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Remove Imp', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Remove Imp', exact: true })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Remove Chef', exact: true })).toBeVisible()
  await keyboard.getByRole('radio', { name: 'Letters', exact: true }).check()
  await expect(field).toBeFocused()
  // A tap on the words while the keys are up is for typing, so the letters come back: the
  // device's keyboard never stands up under the keys.
  await keyboard.getByRole('radio', { name: 'Tokens', exact: true }).check()
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toBeVisible()
  await field.click()
  await expect(keyboard.getByRole('radio', { name: 'Letters', exact: true })).toBeChecked()
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0)
  await expect(field).toBeFocused()
  await show.click()
  await expect(card.getByRole('heading', { name: 'Watch your left', exact: true })).toBeVisible()
  await expect(card.getByText('CHEF', { exact: true })).toBeVisible()
  // Change goes back to the editor with what the card showed.
  await card.getByRole('button', { name: 'Change', exact: true }).click()
  await expect(field).toHaveValue('Watch your left')
})

test('a kept note is offered again after a reload, and forgetting it takes it away', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  const field = card.getByRole('textbox', { name: 'Message' })
  const keep = card.getByRole('button', { name: 'Keep this note', exact: true })
  await field.fill('Open your eyes')
  await expect(keep).toHaveAttribute('aria-pressed', 'false')
  await keep.click()
  await expect(keep).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()

  await reload(page)
  await openBlank(page)
  const kept = card.getByRole('button', { name: 'Open your eyes', exact: true })
  await kept.click()
  await expect(field).toHaveValue('Open your eyes')
  await expect(keep).toHaveAttribute('aria-pressed', 'true')
  await keep.click()
  await expect(keep).toHaveAttribute('aria-pressed', 'false')
  // Emptied, the card offers its phrases again, without the forgotten note.
  await field.fill('')
  await expect(card.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible()
  await expect(kept).toHaveCount(0)
})
