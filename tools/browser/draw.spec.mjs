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
