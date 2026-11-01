// Bundled art as a plain image. react-native-web's Image draws nothing on its first render, then
// paints a CSS background once its own loader has decoded the file: its art is missing from the
// static export and lands frames after the <img> art beside it. A plain image is in the exported
// HTML, so the browser fetches it before JavaScript runs, and a cached file paints with the frame
// that mounts it.
import type { CSSProperties } from 'react'

// Expo's web bundler exports a static require as { uri, width, height }; some generated maps type it as a number.
export type ArtSource = number | { readonly uri: string }

export interface ArtProps {
  readonly source: ArtSource
  readonly fit?: CSSProperties['objectFit'] // contain when omitted
  readonly style?: CSSProperties // size and placement; fills its parent when omitted
}

export const artUri = (source: ArtSource): string => (source as { readonly uri: string }).uri

export const Art = ({ source, fit = 'contain', style }: ArtProps) => (
  <img src={artUri(source)} alt="" aria-hidden draggable={false} decoding="sync"
    style={{ display: 'block', width: '100%', height: '100%', objectFit: fit, pointerEvents: 'none', ...style }} />
)
