import { expect, test } from '@playwright/test'

import { open } from './app.mjs'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })

const button = (page, name) => page.getByRole('button', { name, exact: true })
const faceDown = page => page.getByRole('button', { name: /^Take face-down token \d+$/ })

test('each player takes a token from the open bag, and the Storyteller deals what they drew', async ({ page }) => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').click()
  const count = page.getByText(/^\d+ players?$/).first()
  for (let now; (now = Number((await count.textContent()).match(/\d+/)[0])) !== 5;) {
    await button(page, now < 5 ? 'More players' : 'Fewer players').click()
  }
  await button(page, 'Shuffle characters').click()
  await button(page, 'Open grimoire').click()
  // The board opens empty, on the setup window that deals the bag.
  await expect(page.getByText('0 of 5 characters assigned', { exact: true })).toBeVisible()
  await button(page, 'Let players draw').click()
  await button(page, 'Start with Seat 1').click()

  for (let player = 1; player <= 5; player++) {
    await expect(page.getByText(`${player} of 5`, { exact: true })).toBeVisible()
    // A token taken by an earlier player is gone from the bag.
    await expect(faceDown(page)).toHaveCount(6 - player)
    // The heap overlaps, so a tap takes the highest token under the finger.
    await faceDown(page).first().click({ force: true })
    await expect(faceDown(page)).toHaveCount(0)
    await button(page, player < 5 ? 'Hide and pass to next player' : 'Hide and finish').click()
  }

  await expect(page.getByText('Everyone has drawn a token.', { exact: true })).toBeVisible()
  await button(page, 'Deal the tokens').click()
  await button(page, 'Setup').click()
  await expect(page.getByText('5 of 5 characters assigned', { exact: true })).toBeVisible()
})

test('the Storyteller chooses the Townsfolk the Drunk sees with the characters, and its player draws it', async ({ page }) => {
  await open(page, '/new')
  await button(page, 'Trouble Brewing').click()
  const count = page.getByText(/^\d+ players?$/).first()
  for (let now; (now = Number((await count.textContent()).match(/\d+/)[0])) !== 3;) {
    await button(page, now < 3 ? 'More players' : 'Fewer players').click()
  }
  for (const name of ['Drunk', 'Imp', 'Chef']) await button(page, name).click()

  // While choosing the characters, the Storyteller may pick what the Drunk sees, never a
  // Townsfolk already in the bag. Left alone, the bag picks.
  await button(page, 'Choose what the Drunk sees').click()
  const picker = page.getByRole('dialog', { name: 'What the Drunk sees' })
  await expect(button(picker, 'Chef')).toHaveCount(0)
  await expect(button(picker, 'Clear choice')).toHaveCount(0)
  await button(picker, 'Monk').click()
  await button(page, 'Drunk sees: Monk').click()
  await expect(button(picker, 'Monk')).toHaveAttribute('aria-pressed', 'true')
  await button(picker, 'Close').click()
  await button(page, 'Open grimoire').click()
  // The setup window only deals the bag.
  await expect(button(page, 'Drunk sees: Monk')).toHaveCount(0)

  await button(page, 'Let players draw').click()
  await button(page, 'Start with Seat 1').click()
  const seen = []
  for (let player = 1; player <= 3; player++) {
    await faceDown(page).first().click({ force: true })
    await expect(button(page, player < 3 ? 'Hide and pass to next player' : 'Hide and finish')).toBeEnabled()
    seen.push((await page.getByRole('img', { name: /^(Monk|Imp|Chef|Drunk)\./ }).getAttribute('aria-label')).split('.')[0])
    await button(page, player < 3 ? 'Hide and pass to next player' : 'Hide and finish').click()
  }
  expect(seen.sort()).toEqual(['Chef', 'Imp', 'Monk'])

  // The Drunk sits as the Monk it saw.
  await button(page, 'Deal the tokens').click()
  await expect(page.getByRole('button', { name: /^Seat \d, Monk$/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Seat \d, Drunk$/ })).toHaveCount(0)
})

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 810, height: 1080 } })

  test('tapping the name holds the field still, and the keyboard shrinks the bag only as far as it must', async ({ page }) => {
    await open(page, '/new')
    await button(page, 'Trouble Brewing').click()
    await button(page, 'Shuffle characters').click()
    await button(page, 'Open grimoire').click()
    await button(page, 'Let players draw').click()
    await button(page, 'Start with Seat 1').click()
    const name = page.getByRole('textbox', { name: 'Player name', exact: true })
    // The turn slides in, so the field is measured once it has come to rest.
    let before
    await expect.poll(async () => { const last = before; before = await name.boundingBox(); return last?.y === before.y }).toBe(true)
    await name.tap()
    await expect(name).toBeFocused()
    expect(await name.boundingBox()).toEqual(before)

    // Desktop automation has no software keyboard, so only the visual viewport shrinks, as on a tablet.
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 700 })
      visualViewport.dispatchEvent(new Event('resize'))
    })
    await expect.poll(async () => (await name.boundingBox()).y + (await name.boundingBox()).height).toBeLessThanOrEqual(700)
    await expect(faceDown(page).first()).toBeVisible()
  })
})
