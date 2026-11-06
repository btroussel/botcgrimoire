// Binds language and grimoire style to the settings screen.
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

import type { BoardColour, Locale, Translate } from '../../content'
import { boardColours, locales, t as translate } from '../../content'
import { useStore } from '../../store'
import { backOrHome } from '../../ui/homePath'

export interface LocaleOption {
  readonly locale: Locale
  readonly name: string // the language named in itself: English, Français
  readonly selected: boolean
}

export interface SettingsView {
  readonly t: Translate
  readonly locale: Locale
  readonly localeOptions: readonly LocaleOption[]
  readonly setLocale: (locale: Locale) => void
  readonly colourOptions: readonly { readonly key: BoardColour; readonly name: string; readonly selected: boolean }[]
  readonly setBoardColour: (boardColour: BoardColour) => void
  readonly back: () => void
}

export const useSettings = (): SettingsView => {
  const store = useStore()
  const router = useRouter()
  const { t, settings } = store

  const localeOptions = locales.map((locale) => ({
    locale,
    name: translate(locale, 'common.localeName'),
    selected: locale === settings.locale,
  }))

  const setLocale = useCallback((locale: Locale) => store.setSettings({ locale }), [store])
  const setBoardColour = useCallback((boardColour: BoardColour) => store.setSettings({ boardColour }), [store])

  const back = useCallback(() => backOrHome(router, settings.locale), [router, settings.locale])

  return {
    t,
    locale: settings.locale,
    localeOptions,
    setLocale,
    colourOptions: boardColours.map((key) => ({ key, name: t(`common.velvet_${key}`), selected: settings.boardColour === key })),
    setBoardColour,
    back,
  }
}
