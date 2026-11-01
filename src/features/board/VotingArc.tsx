import { useReducedMotion } from '../../ui/motion'
import { motion, palette } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import type { SeatPosition } from './ring'
import { voteArc } from './ring'

// The count's route around the ring. It lights up to the furthest hand recorded and never advances
// or casts a vote on its own; the checks on the tokens say who voted.
export const VotingArc = ({ band, rx, ry, tokenSize, seatCount, nominee, reached, label }: {
  readonly band: Size
  readonly rx: number
  readonly ry: number
  readonly tokenSize: number
  readonly seatCount: number
  readonly nominee: SeatPosition
  readonly reached: SeatPosition | undefined
  readonly label: string
}) => {
  const reduced = useReducedMotion()
  const arc = voteArc(band, rx, ry, tokenSize, seatCount, nominee, reached)
  if (!arc) return null
  const transition = reduced ? 'none' : `stroke-dashoffset ${motion.duration.mark}ms ${motion.css.ease}`
  return <svg width={band.width} height={band.height} role="img" aria-label={label}
    style={{ position: 'absolute', pointerEvents: 'none', overflow: 'visible' }}>
    <path d={arc.path} fill="none" stroke={palette.accent} strokeOpacity={0.4} strokeWidth={2}
      strokeLinecap="round" strokeDasharray="0.1 7" />
    {/* pathLength makes the dash a share of the route, so the lit part eases with one number. */}
    <path d={arc.path} pathLength={1} fill="none" stroke={palette.accent} strokeWidth={3.5}
      strokeDasharray="1 1" strokeDashoffset={1 - arc.lit}
      style={{ transition }} />
    <path d="M 0 0 L -13 -7 L -10 0 L -13 7 Z" fill={palette.accent} stroke={palette.ink} strokeWidth={1}
      strokeLinejoin="round" transform={`translate(${arc.arrow.x} ${arc.arrow.y}) rotate(${arc.arrow.angle})`} />
  </svg>
}
