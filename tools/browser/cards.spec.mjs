import { readFileSync } from 'node:fs'

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

// There is one card, and it is always its own editor: the dialog is named for the action.
const theCard = page => page.getByRole('dialog', { name: 'Show a card' })

// The eye opens the card blank, with neither keyboard up.
const openBlank = async page => {
  await page.getByRole('button', { name: 'Show a card', exact: true }).click()
  return theCard(page)
}

const keyboard = card => card.getByRole('radiogroup', { name: 'Keyboard', exact: true })
const tokensSwitch = card => keyboard(card).getByRole('radio', { name: 'Tokens', exact: true })
const lettersSwitch = card => keyboard(card).getByRole('radio', { name: 'Letters', exact: true })
const field = card => card.getByRole('textbox', { name: 'Message' })
// The tokens printed on the card, by the names on their arcs, and the block they stand in.
const printed = card => card.locator('[data-card-tokens] text')
const tokenBlock = card => card.locator('[data-card-tokens] > *')

// The blank card with its token keys up, as the tokens alone are typed.
const openTokens = async page => {
  const card = await openBlank(page)
  await tokensSwitch(card).check()
  return card
}

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

test('This player is comes up from the seat\'s menu with its words, the character and the player\'s name', async ({ page }) => {
  await openBoard(page)
  const seat = impSeat(page)
  const player = await seatCard(page, seat, 'This player is')
  const card = theCard(page)
  await expect(field(card)).toHaveValue('THIS PLAYER IS')
  await expect(printed(card)).toHaveText(['IMP'])
  await expect(card.getByText(player, { exact: true })).toBeVisible()
  // Its content is known, so neither keyboard is up and the card is ready to turn round.
  for (const radio of [lettersSwitch(card), tokensSwitch(card)]) await expect(radio).not.toBeChecked()
  await card.getByRole('button', { name: 'Close', exact: true }).click()
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
  await expect(field(card)).not.toBeFocused()
  for (const radio of [lettersSwitch(card), tokensSwitch(card)]) await expect(radio).not.toBeChecked()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toHaveCount(0)
  // A tap on the words is for typing.
  await field(card).click()
  await expect(lettersSwitch(card)).toBeChecked()
  await expect(field(card)).toBeFocused()
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
  const card = theCard(page)
  await expect(field(card)).toHaveValue('YOU ARE')
  await expect(printed(card)).toHaveText(['IMP'])
})

test('You are is the same card as any other: a tap on its token brings up the keys, and its words can be rewritten', async ({ page }) => {
  await openBoard(page)
  await seatCard(page, impSeat(page), 'You are')
  const card = theCard(page)
  await tokenBlock(card).click()
  await expect(tokensSwitch(card)).toBeChecked()
  // A key takes its token, and a second tap on a key gives it back.
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await expect(printed(card)).toHaveText(['IMP', 'CHEF'])
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await expect(printed(card)).toHaveText(['CHEF'])
  await field(card).fill('YOU ARE NOW')
  await expect(field(card)).toHaveValue('YOU ARE NOW')
  await expect(printed(card)).toHaveText(['CHEF'])
})

test('a phrase only writes the card, which takes a token too', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await card.getByRole('button', { name: 'This is the Demon', exact: true }).click()
  // Written in capitals, as the printed info token is, and the phrases go once the card holds something.
  await expect(field(card)).toHaveValue('THIS IS THE DEMON')
  await expect(card.getByRole('button', { name: 'These are your Minions', exact: true })).toHaveCount(0)
  for (const radio of [lettersSwitch(card), tokensSwitch(card)]) await expect(radio).not.toBeChecked()
  await tokensSwitch(card).check()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await expect(printed(card)).toHaveText(['IMP'])
  await expect(field(card)).toHaveValue('THIS IS THE DEMON')
})

test('This character selected you comes up with its keys, since it is about a character', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await card.getByRole('button', { name: 'This character selected you', exact: true }).click()
  await expect(field(card)).toHaveValue('THIS CHARACTER SELECTED YOU')
  await expect(tokensSwitch(card)).toBeChecked()
  await card.getByRole('button', { name: 'Poisoner', exact: true }).click()
  await expect(printed(card)).toHaveText(['POISONER'])
})

test('the tokens alone are the blank card with no words, and a second tap on a key takes its token off', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  // With a keyboard up the card is already the preview: the phrases go, and nothing asks for words.
  await expect(card.getByRole('button', { name: 'This is the Demon', exact: true })).toHaveCount(0)
  await expect(field(card)).toHaveJSProperty('placeholder', '')
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await expect(printed(card)).toHaveText(['CHEF', 'IMP'])
  // No token carries a cross: its key is what takes it off.
  await expect(card.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await expect(printed(card)).toHaveText(['CHEF'])
  await expect(field(card)).toHaveValue('')
  // Turned to the player, a card of tokens alone shows no prompt to write. The letters bring it back.
  await tokensSwitch(card).click()
  await expect(field(card)).toHaveJSProperty('placeholder', '')
  await lettersSwitch(card).check()
  await expect(field(card)).toHaveJSProperty('placeholder', 'Write your message')
})

test('a tap on the felt or on the keyboard that is up puts it away, and the card stays as it is', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  // The felt beside the token, above the keys.
  await card.click({ position: { x: 20, y: 200 } })
  await expect(tokensSwitch(card)).not.toBeChecked()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toHaveCount(0)
  await expect(printed(card)).toHaveText(['CHEF'])
  // Nothing else changes: no second state, and the card's two controls stay.
  await expect(card.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
  await expect(keyboard(card)).toBeVisible()

  await tokensSwitch(card).check()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toBeVisible()
  await tokensSwitch(card).click()
  await expect(tokensSwitch(card)).not.toBeChecked()
  await expect(card.getByRole('button', { name: 'Chef', exact: true })).toHaveCount(0)

  // A card of tokens alone has no words to tap, so the switch raises the letters.
  await lettersSwitch(card).check()
  await expect(field(card)).toBeFocused()
  await lettersSwitch(card).click()
  await expect(lettersSwitch(card)).not.toBeChecked()
  await expect(field(card)).not.toBeFocused()
  await expect(printed(card)).toHaveText(['CHEF'])
})

test('the card leaves on its cross', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()
  // Nothing is kept from one card to the next.
  await openBlank(page)
  await expect(printed(card)).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible()
})

test('several characters on a card stand in a column on an upright phone, as large as fits', async ({ page }) => {
  await openBoard(page)
  const card = await openTokens(page)
  for (const name of ['Chef', 'Imp', 'Monk']) await card.getByRole('button', { name, exact: true }).click()
  await tokensSwitch(card).click()

  // Each is large enough to print its name on the arc.
  await expect(printed(card)).toHaveText(['CHEF', 'IMP', 'MONK'])
  const [chef, imp, monk] = await Promise.all([0, 1, 2].map(at => printed(card).nth(at).boundingBox()))
  expect(chef.y).toBeLessThan(imp.y)
  expect(imp.y).toBeLessThan(monk.y)
  // The arc's print is not centred to the pixel, so one name over the other is enough.
  for (const box of [imp, monk]) expect(Math.abs(box.x + box.width / 2 - (chef.x + chef.width / 2))).toBeLessThan(chef.width / 2)
})

test('a keyboard closes the card with its Close button or Escape, and the focus goes back to what opened it', async ({ page }) => {
  await openBoard(page)
  const opener = page.getByRole('button', { name: 'Show a card', exact: true })
  const card = await openBlank(page)
  // The focus waits on Close as the card comes up, never in the words, which would raise the
  // device's keyboard unasked.
  const close = card.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(card).toBeHidden()
  await expect(opener).toBeFocused()
  await openBlank(page)
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(opener).toBeFocused()
})

test('putting a keyboard away from the switch leaves the focus on the switch, not on Close', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await tokensSwitch(card).focus()
  await page.keyboard.press('Space')
  await expect(tokensSwitch(card)).toBeChecked()
  await page.keyboard.press('Space')
  await expect(tokensSwitch(card)).not.toBeChecked()
  // A second Space must raise the keys again, never close the card and drop what was typed.
  await expect(card.getByRole('button', { name: 'Close', exact: true })).not.toBeFocused()
  await page.keyboard.press('Space')
  await expect(tokensSwitch(card)).toBeChecked()
  await expect(card).toBeVisible()
})

test('the letters go down when the words lose the caret, and the count of a long note never shows at rest', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await field(card).fill('x'.repeat(210))
  await expect(lettersSwitch(card)).toBeChecked()
  await expect(card.getByText('210/250', { exact: true })).toBeVisible()
  // A Tab away takes the caret with no tap on the card, as the device's own Done key does.
  await page.keyboard.press('Tab')
  await expect(lettersSwitch(card)).not.toBeChecked()
  await expect(card.getByText('210/250', { exact: true })).toHaveCount(0)
  // The switch then raises them on its first press.
  await lettersSwitch(card).check()
  await expect(field(card)).toBeFocused()
})

test('a long name under a token keeps its word whole on the narrowest phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openBoard(page)
  // Six tokens under a phrase have no room for names on their arcs, so each has its name beneath.
  const card = await openBlank(page)
  await card.getByRole('button', { name: 'These are your Minions', exact: true }).click()
  await tokensSwitch(card).check()
  const long = ['Washerwoman', 'Undertaker', 'Ravenkeeper', 'Investigator', 'Librarian', 'Poisoner']
  for (const name of long) await card.getByRole('button', { name, exact: true }).click()
  await tokensSwitch(card).click()

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

// The bluffs drawer's keys, and those ticked among them.
const bluffKeys = drawer => drawer.locator('[role="button"][aria-pressed]')
const keyNames = async (drawer, count) => (await bluffKeys(drawer).evaluateAll(keys => keys.map(key => key.getAttribute('aria-label')))).slice(0, count)
const ticked = drawer => drawer.locator('[role="button"][aria-pressed="true"]').evaluateAll(keys => keys.map(key => key.getAttribute('aria-label')))
const trayNames = tray => tray.getByRole('button', { name: /^Bluff: / }).evaluateAll(wells => wells.map(well => well.getAttribute('aria-label')))

test('the not-in-play phrase with no bluffs saved opens the tray\'s drawer, so the tray holds what was shown', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(0)
  const blank = await openBlank(page)
  await blank.getByRole('button', { name: 'These characters are not in play', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  // It opens empty: a random draw would cost a hand pick its taps to undo.
  await expect(drawer.getByRole('button', { name: 'Show', exact: true })).toBeDisabled()
  for (const name of await keyNames(drawer, 3)) await drawer.getByRole('button', { name, exact: true }).click()
  await drawer.getByRole('button', { name: 'Show', exact: true }).click()

  const card = theCard(page)
  await expect(field(card)).toHaveValue('THESE CHARACTERS ARE NOT IN PLAY')
  await expect(printed(card)).toHaveCount(3)
  const shown = await printed(card).allTextContents()
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()
  const saved = (await trayNames(tray)).map(label => label.replace('Bluff: ', '').toUpperCase())
  expect(saved).toHaveLength(3)
  expect(shown.map(name => name.trim())).toEqual(saved)
})

test('three keys tick three bluffs, and a fourth waits until one comes off', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  // The ticked keys are the picks: no second row of tokens repeats them.
  await expect(drawer.getByText('0 of 3', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('button', { name: /^Bluff/ })).toHaveCount(0)
  const [a, b, c, d] = await keyNames(drawer, 4)
  for (const name of [a, b, c]) await drawer.getByRole('button', { name, exact: true }).click()
  expect(await ticked(drawer)).toEqual([a, b, c])
  await expect(drawer.getByText('3 of 3', { exact: true })).toBeVisible()
  // With three ticked the others dim, so a fourth is never taken in place of one unasked.
  await expect(drawer.getByRole('button', { name: d, exact: true })).toBeDisabled()
  // A swap is two keys: one comes off, another goes on.
  await drawer.getByRole('button', { name: b, exact: true }).click()
  await expect(drawer.getByText('2 of 3', { exact: true })).toBeVisible()
  await drawer.getByRole('button', { name: d, exact: true }).click()
  expect(await ticked(drawer)).toEqual([a, c, d])
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(drawer).toBeHidden()
  expect(await trayNames(tray)).toEqual([a, c, d].map(name => `Bluff: ${name}`))
})

test('Shuffle fills what is missing and keeps a hand pick', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).nth(2).click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  const [pick] = await keyNames(drawer, 1)
  await drawer.getByRole('button', { name: pick, exact: true }).click()
  await drawer.getByRole('button', { name: 'Shuffle bluffs', exact: true }).click()
  const picks = await ticked(drawer)
  expect(picks).toHaveLength(3)
  expect(picks).toContain(pick)
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  // The tray lists them in the order they were picked, the hand pick first.
  const saved = await trayNames(tray)
  expect(saved[0]).toBe(`Bluff: ${pick}`)
  expect([...saved].sort()).toEqual(picks.map(name => `Bluff: ${name}`).sort())
})

test('the not-in-play phrase writes the saved bluffs, and changing the card saves nothing', async ({ page }) => {
  await openBoard(page)
  const tray = page.getByRole('region', { name: "Demon's Bluffs" })
  await tray.getByRole('button', { name: 'Set bluffs', exact: true }).first().click()
  const drawer = page.getByRole('dialog', { name: "Demon's Bluffs" })
  await drawer.getByRole('button', { name: 'Shuffle bluffs', exact: true }).click()
  await drawer.getByRole('button', { name: 'Save', exact: true }).click()
  const before = await trayNames(tray)
  expect(before).toHaveLength(3)
  const bluffs = before.map(label => label.replace('Bluff: ', ''))

  const card = await openBlank(page)
  await card.getByRole('button', { name: 'These characters are not in play', exact: true }).click()
  await expect(field(card)).toHaveValue('THESE CHARACTERS ARE NOT IN PLAY')
  await expect(printed(card)).toHaveText(bluffs.map(name => name.toUpperCase()))
  await tokenBlock(card).click()
  await card.getByRole('button', { name: bluffs[2], exact: true }).click()
  await expect(printed(card)).toHaveCount(2)
  await card.getByRole('button', { name: 'Close', exact: true }).click()
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

  const card = theCard(page)
  await expect(printed(card)).toHaveCount(3)
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card).toBeHidden()
  await expect(tray.getByRole('button', { name: /^Bluff: / })).toHaveCount(3)
})

// A device's keyboard shrinks only the visible viewport. Desktop automation has no software
// keyboard, so the test shrinks it as a phone would.
const keyboardUp = (page, height) => page.evaluate(h => {
  Object.defineProperty(visualViewport, 'height', { configurable: true, value: h })
  visualViewport.dispatchEvent(new Event('resize'))
}, height)

test('a yes, a no and a small count are each one tap on the empty card', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  for (const name of ['Yes', 'No', '0', '1', '2', '3', '4', '5']) await expect(card.getByRole('button', { name, exact: true })).toBeVisible()
  // A count shows at a lone number's size, and the offers go once the card holds something.
  await card.getByRole('button', { name: '3', exact: true }).click()
  await expect(field(card)).toHaveValue('3')
  await expect(field(card)).toHaveCSS('font-size', '96px')
  await expect(card.getByRole('button', { name: 'Yes', exact: true })).toHaveCount(0)
  for (const radio of [lettersSwitch(card), tokensSwitch(card)]) await expect(radio).not.toBeChecked()
  // A word is written in capitals, as a phrase is.
  await card.getByRole('button', { name: 'Close', exact: true }).click()
  await openBlank(page)
  await card.getByRole('button', { name: 'No', exact: true }).click()
  await expect(field(card)).toHaveValue('NO')
})

test('a number typed on the card shows at a lone number\'s size', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await field(card).click()
  await field(card).fill('3')
  // The phrases go with the first character.
  await expect(card.getByRole('button', { name: 'This is the Demon', exact: true })).toHaveCount(0)
  await expect(field(card)).toHaveCSS('font-size', '96px')
})

test('typed words take tokens under them, and the bar stays above the device keyboard', async ({ page }) => {
  await openBoard(page)
  const card = await openBlank(page)
  await field(card).fill('Watch your left')
  await keyboardUp(page, 400)
  const bottom = async () => { const box = await keyboard(card).boundingBox(); return box.y + box.height }
  await expect.poll(bottom).toBeLessThanOrEqual(400)
  // With the keyboard down the bar goes back to the foot before the next tap.
  await keyboardUp(page, 844)
  await expect.poll(bottom).toBeGreaterThan(800)

  // The two keyboards swap: the caret leaves with the letters and comes back with them. The
  // switch is one radio group, so it is one tab stop.
  await tokensSwitch(card).check()
  await expect(field(card)).not.toBeFocused()
  await card.getByRole('button', { name: 'Imp', exact: true }).click()
  await card.getByRole('button', { name: 'Chef', exact: true }).click()
  await expect(printed(card)).toHaveText(['IMP', 'CHEF'])
  await lettersSwitch(card).check()
  await expect(field(card)).toBeFocused()
  // A tap on the words while the keys are up is for typing, so the letters come back: the
  // device's keyboard never stands up under the keys.
  await tokensSwitch(card).check()
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toBeVisible()
  await field(card).click()
  await expect(lettersSwitch(card)).toBeChecked()
  await expect(card.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0)
  await expect(field(card)).toBeFocused()
  await expect(field(card)).toHaveValue('Watch your left')
  await expect(printed(card)).toHaveText(['IMP', 'CHEF'])
})

// The keys are laid out from whatever the script holds, so a team may have one character, none
// or dozens. Two scripts at the ends: five characters with no Outsider or Traveller, and every
// character the app bundles.
const bundled = JSON.parse(readFileSync(new URL('../../assets/data/raw/release/roles.json', import.meta.url), 'utf8'))
const teamsOf = ids => ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'].filter(team => ids.some(id => bundled.find(role => role.id === id)?.team === team))
const everyone = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'].flatMap(team => bundled.filter(role => role.team === team).map(role => role.id))
const headings = { townsfolk: 'Townsfolk', outsider: 'Outsiders', minion: 'Minions', demon: 'Demons', traveller: 'Travellers' }

for (const [name, ids, players] of [['Tiny', ['washerwoman', 'empath', 'monk', 'poisoner', 'imp'], 5], ['Whale', everyone, 10]]) {
  test(`the token keys hold a script of ${ids.length} characters, each team on its own rows`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await open(page, '/scripts')
    await page.getByRole('button', { name: 'Import a script', exact: true }).click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Choose a file', exact: true }).click()
    await (await chooser).setFiles({ name: 'script.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ id: '_meta', name, author: 'Probe' }, ...ids])) })
    await page.getByRole('button', { name: 'Save to your scripts', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible()

    await open(page, '/new')
    await page.getByRole('button', { name, exact: true }).click()
    const count = page.getByText(/^\d+ players?$/).first()
    await expect(async () => {
      const current = Number((await count.textContent()).match(/\d+/)[0])
      if (current !== players) await page.getByRole('button', { name: current < players ? 'More players' : 'Fewer players', exact: true }).click()
      expect(Number((await count.textContent()).match(/\d+/)[0])).toBe(players)
    }).toPass()
    await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
    await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
    await page.getByRole('button', { name: 'Deal at random', exact: true }).click()

    const card = await openTokens(page)
    const keys = card.locator('[data-keys] [role="button"]')
    await expect(keys).toHaveCount(ids.length)
    // A team with no character has no row, and the others keep their order.
    await expect(card.locator('[data-keys] [role="heading"]')).toHaveText(teamsOf(ids).map(team => headings[team]))
    // The last key of the last team is reached by a scroll and typed.
    const last = await keys.last().getAttribute('aria-label')
    await keys.last().click()
    // Its name is on the arc in capitals, or under a token too small for that.
    await expect(tokenBlock(card).getByText(new RegExp(`^${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))).toBeVisible()
  })
}
