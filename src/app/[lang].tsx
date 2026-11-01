import { Unmatched, useLocalSearchParams } from 'expo-router'

import { HomeScreen } from '../features/home/HomeScreen'
import { homeOf, languageHomes } from '../features/shell/homePages'

// Home in one language, exported once per language other than English, which keeps `/`.
export function generateStaticParams() {
  return languageHomes.map((lang) => ({ lang }))
}

export default function LanguageHome() {
  const { lang } = useLocalSearchParams<{ lang: string }>()
  return homeOf(`/${lang}`) ? <HomeScreen /> : <Unmatched />
}
