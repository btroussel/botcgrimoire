import { expect, test } from '@playwright/test'

import { open, reload } from './app.mjs'

const openBoard = async (page, players) => {
  await open(page, '/new')
  await page.getByRole('button', { name: 'Trouble Brewing', exact: true }).click()
  const count = page.getByText(/^\d+ players?$/).first()
  await expect(async () => {
    const current = Number((await count.textContent()).match(/\d+/)[0])
    if (current !== players) {
      await page.getByRole('button', { name: current < players ? 'More players' : 'Fewer players', exact: true }).click()
    }
    expect(Number((await count.textContent()).match(/\d+/)[0])).toBe(players)
  }).toPass()
  await page.getByRole('button', { name: 'Shuffle characters', exact: true }).click()
  await page.getByRole('button', { name: 'Open grimoire', exact: true }).click()
  await page.getByRole('button', { name: 'Deal at random', exact: true }).click()
  const seats = page.locator('[data-seat-context-target]')
  await expect(seats).toHaveCount(players)
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Arrange the seats', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toBeVisible()
  // Seats render in ring order, seat 0 at the top, and each token's label starts with its player.
  const names = () => seats.evaluateAll(all => all.map(seat => seat.querySelector('[role="button"]').getAttribute('aria-label').split(',')[0]))
  return { seats, names, token: i => seats.nth(i).getByRole('button').first() }
}

const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
// A moved seat glides to its place, so a press waits for it to arrive.
const settled = page => page.waitForFunction(() => document.getAnimations().every(run => run.playState !== 'running'))
const order = (list, ...indices) => indices.map(i => list[i])

test('a mouse drags a seat onto another to swap them and into a gap to move it, and one undo puts it back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const { names, token } = await openBoard(page, 7)
  const start = await names()

  const from = centre(await token(0).boundingBox())
  const onto = centre(await token(2).boundingBox())
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(onto.x, onto.y, { steps: 10 })
  await page.mouse.up()
  const swapped = order(start, 2, 1, 0, 3, 4, 5, 6)
  await expect.poll(names).toEqual(swapped)

  // Lifted, the seat shows the gaps it can go into; the one before seat 4 puts it there.
  await settled(page)
  const lifted = centre(await token(0).boundingBox())
  await page.mouse.move(lifted.x, lifted.y)
  await page.mouse.down()
  await page.mouse.move(lifted.x + 20, lifted.y + 20, { steps: 4 })
  const gap = page.locator('#seat-insertion-4')
  await expect(gap).toBeVisible()
  // The gaps either side of the lifted seat would change nothing, so they are not offered.
  await expect(page.locator('#seat-insertion-1')).toHaveCount(0)
  await expect(page.locator('#seat-insertion-7')).toHaveCount(0)
  const into = centre(await gap.boundingBox())
  await page.mouse.move(into.x, into.y, { steps: 10 })
  await page.mouse.up()
  const moved = order(swapped, 1, 2, 3, 0, 4, 5, 6)
  await expect.poll(names).toEqual(moved)

  // Let go over the velvet in the ring's middle, a seat goes back and the arrangement stays open.
  await settled(page)
  const middle = await page.locator('#ring-turn').boundingBox()
  const back = centre(await token(1).boundingBox())
  await page.mouse.move(back.x, back.y)
  await page.mouse.down()
  await page.mouse.move(middle.x + middle.width / 2, middle.y - 40, { steps: 10 })
  await page.mouse.up()
  await expect.poll(names).toEqual(moved)
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toBeVisible()

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(names).toEqual(swapped)
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(names).toEqual(start)
})

test('a tap picks a seat up, and the next tap swaps it, moves it or puts it down', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { seats, names, token } = await openBoard(page, 6)
  const start = await names()

  await token(1).click()
  await expect(token(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(token(4)).toHaveAttribute('aria-label', new RegExp(`Swap with ${start[1]}$`))
  await expect(page.getByText(`Tap where ${start[1]} goes.`, { exact: true })).toBeVisible()
  await token(4).click()
  const swapped = order(start, 0, 4, 2, 3, 1, 5)
  await expect.poll(names).toEqual(swapped)
  await expect(token(4)).toHaveAttribute('aria-pressed', 'false')

  // A picked-up seat turns the add markers into the places it can go.
  await token(0).click()
  await expect(page.getByRole('button', { name: /^Add a seat/ })).toHaveCount(0)
  await page.getByRole('button', { name: `Move ${swapped[0]} to position 4`, exact: true }).click()
  const moved = order(swapped, 1, 2, 3, 0, 4, 5)
  await expect.poll(names).toEqual(moved)

  // Escape and a second tap put a seat down and keep the arrangement open; Escape then ends it.
  await token(2).click()
  await page.keyboard.press('Escape')
  await expect(token(2)).toHaveAttribute('aria-pressed', 'false')
  await token(2).click()
  await token(2).click()
  await expect(token(2)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Add a seat at position 3', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toHaveCount(0)
  await reload(page)
  await expect(seats).toHaveCount(6)
  await expect.poll(names).toEqual(moved)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })

  test('a long press lifts a seat onto another, while a tap still picks it up', async ({ page, context }) => {
    const session = await context.newCDPSession(page)
    const touch = (type, at) => session.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ x: at.x, y: at.y }] : [] })
    const swipe = async (from, to, steps = 8) => {
      for (let i = 1; i <= steps; i++) await touch('touchMove', { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps })
    }
    const { names, token } = await openBoard(page, 7)
    const start = await names()
    const box = await token(0).boundingBox()
    const from = centre(box)
    const seat = centre(await token(3).boundingBox())
    // The lifted seat rides above the finger, so the finger ends a little below the seat it lands on.
    const to = { x: seat.x, y: seat.y + box.height * 0.6 }

    await touch('touchStart', from)
    await page.waitForTimeout(600)
    await swipe(from, to)
    await touch('touchEnd')
    await expect.poll(names).toEqual(order(start, 3, 1, 2, 0, 4, 5, 6))
    await expect(page.getByRole('button', { name: 'Rotate clockwise', exact: true })).toBeVisible()

    await token(5).tap()
    await expect(token(5)).toHaveAttribute('aria-pressed', 'true')
  })
})
