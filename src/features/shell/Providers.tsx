// Everything the routes render inside: the store, the safe area and the two faces. The root
// layout is a route file and may import only features, so the providers are a feature of their
// own. The fonts are bundled TTFs, one import per weight so only the five faces the theme names
// ship; until they load the app renders on the felt with the theme's fallbacks rather than
// waiting, since a Storyteller opening a game wants the board, not a blank page.
import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular'
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold'
import { Grenze_500Medium } from '@expo-google-fonts/grenze/500Medium'
import { Grenze_600SemiBold } from '@expo-google-fonts/grenze/600SemiBold'
import { Grenze_700Bold } from '@expo-google-fonts/grenze/700Bold'
import { useFonts } from 'expo-font'
import { usePathname } from 'expo-router'
import type { ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { StoreProvider } from '../../store'
import { ViewportProvider } from '../../ui/Viewport'
import { homeOf } from './homePages'

export const Providers = ({ children }: { readonly children: ReactNode }) => {
  // The result is not awaited: the fallback faces render first and the real ones swap in.
  useFonts({ Grenze_500Medium, Grenze_600SemiBold, Grenze_700Bold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold })
  // Match the exported page before the store loads the device's preferred language.
  const pathname = usePathname()
  const page = homeOf(pathname)
  return (
    <SafeAreaProvider>
      <ViewportProvider><StoreProvider page={page}>{children}</StoreProvider></ViewportProvider>
    </SafeAreaProvider>
  )
}
