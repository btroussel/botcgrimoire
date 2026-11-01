// The root of every route: the providers around everything, then the navigator, which sits
// inside them so it can read the store.
import { Navigator } from '../features/shell/Navigator'
import { Providers } from '../features/shell/Providers'

export default function RootLayout() {
  return (
    <Providers>
      <Navigator />
    </Providers>
  )
}
