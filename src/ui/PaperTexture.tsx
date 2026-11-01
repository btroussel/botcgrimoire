import { memo, useId } from 'react'
import Svg, { Defs, Image, Pattern, Rect } from 'react-native-svg'

const vellum = require('../../assets/art/paper/warm-vellum.webp')

// Keep the material at the same scale on a button and a full page. Stretching it would
// turn the fibres into broad streaks on tall readers. The static import also bundles it offline.
export const PaperTexture = memo(function PaperTexture({ radius = 0, opacity = 1 }: { readonly radius?: number; readonly opacity?: number }) {
  const id = useId()
  return (
    <div className="paper-texture" aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none', opacity }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={440} height={440} patternUnits="userSpaceOnUse">
            <Image href={vellum} width={440} height={440} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </div>
  )
})
