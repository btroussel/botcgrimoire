import type { ImperativeRouter } from 'expo-router'

import type { Locale } from '../content'

// English keeps the root; every other Home uses its locale tag in lower case.
export const homePath = (locale: Locale): string => (locale === 'en' ? '/' : `/${locale.toLowerCase()}`)

// Back to the page before, or to Home in the chosen language when this page opened the visit.
export const backOrHome = (router: ImperativeRouter, locale: Locale): void =>
  router.canGoBack() ? router.back() : router.replace(homePath(locale))
