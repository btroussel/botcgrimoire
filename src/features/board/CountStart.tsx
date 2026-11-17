import { palette } from '../../ui/theme'
import type { Size } from '../../ui/theme'

// The one mark a count draws on the board: a brass chevron in the gap after the nominee, pointing
// the way the count goes. The numbered hands say how far it has come, so nothing else is drawn,
// and nothing moves on its own.
export const CountStart = ({ band, at, size, label }: {
  readonly band: Size
  readonly at: { readonly x: number; readonly y: number; readonly angle: number }
  readonly size: number // the tokens' diameter, which the chevron scales with
  readonly label: string
}) => {
  const half = Math.max(8, size * 0.16)
  return <svg width={band.width} height={band.height} role="img" aria-label={label}
    style={{ position: 'absolute', pointerEvents: 'none', overflow: 'visible' }}>
    <path d={`M ${-half * 0.6} ${-half} L ${half * 0.7} 0 L ${-half * 0.6} ${half} L ${-half * 0.15} 0 Z`}
      fill={palette.accent} stroke={palette.ink} strokeWidth={1.5} strokeLinejoin="round"
      transform={`translate(${at.x} ${at.y}) rotate(${at.angle})`} />
  </svg>
}
