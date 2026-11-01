// Loading a page of the app. The export draws its controls before React has hydrated them, and
// they take no taps until the app marks the root as hydrated. Every load waits for that mark, so
// a first click lands on a live page however slow the runner, and no check reads the export.
import { expect } from '@playwright/test'

const hydrated = page => expect(page.locator('#root')).toHaveAttribute('data-hydrated')

export const open = async (page, url) => {
  const response = await page.goto(url)
  await hydrated(page)
  return response
}

export const reload = async page => {
  const response = await page.reload()
  await hydrated(page)
  return response
}
