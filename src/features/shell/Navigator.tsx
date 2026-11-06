// The navigator, inside the providers so it can read the palette and the translator: no header,
// since each screen draws its own title on the felt, and the felt behind every transition so a
// route change never flashes white. Head keeps the page's metadata and the document language in
// sync with the chosen language and the board's phase once the app runs; the document writes
// them into the static export.
import { Stack, usePathname } from 'expo-router'
import Head from 'expo-router/head'
import { useEffect, useMemo } from 'react'

import { tokenArt } from '../../content/generated/art'
import { useStore } from '../../store'
import { phaseLabel } from '../../store/gameSummary'
import { artIds } from '../../store/scriptSheet'
import { preloadArt, preloadImage } from '../../ui/preloadArt'
import { palette } from '../../ui/theme'
import { followPwaRoute, registerPwa, usePwa } from './pwa'
import { VelvetColourContext } from '../../ui/Velvet'
import { pageTags } from './pageTags'

export const Navigator = () => {
  useEffect(registerPwa, [])
  const store = useStore()
  const p = palette
  const pathname = usePathname()
  useEffect(() => followPwaRoute(pathname), [pathname])
  const pwa = usePwa()
  const script = pathname.startsWith('/game/') ? store.session?.game.script : undefined
  useEffect(() => {
    // The neutral back is needed before any private face, including the discovery introduction.
    if (tokenArt.character_back) void preloadImage(tokenArt.character_back.uri)
  }, [script])
  const locale = store.settings.locale
  // The installer owns the complete download. Once ready, background decoding can
  // continue across routes; a game's complete sheet, including Travellers, comes first.
  // A waiting update must be able to retire the old worker without background requests.
  const catalogue = pwa === 'ready'
  useEffect(() => preloadArt(script ? artIds(script, locale) : [], catalogue), [script, locale, catalogue])
  const clock = store.board?.clock
  const t = store.t
  const app = t('common.appName')
  const phase = pathname.startsWith('/game/') && clock !== undefined ? phaseLabel(clock, t) : undefined
  // The navigator hears every edit for the document title; the stack's options stay the same object.
  const screenOptions = useMemo(() => ({ headerShown: false, title: app, contentStyle: { backgroundColor: p.felt } }), [app, p.felt])
  return (
    <VelvetColourContext value={store.settings.boardColour}>
      <Head>
        {/* The chosen language, so screen readers pick the right voice and spell-check the right dictionary. */}
        <html lang={locale} />
        {pageTags(pathname, t, phase)}
      </Head>
      <Stack screenOptions={screenOptions} />
    </VelvetColourContext>
  )
}
