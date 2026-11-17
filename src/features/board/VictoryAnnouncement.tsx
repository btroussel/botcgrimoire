import type { ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef } from 'react'

import { durationFor, useReducedMotion } from '../../ui/motion'
import { font, motion, palette } from '../../ui/theme'
import type { CentreBox } from './ringLayout'
import { slack, widthAtOnePoint as widthIn } from './textWidth'
import { fitResult, resultFrame, twoLineWidth } from './victory'

const widthAtOnePoint = (text: string) => widthIn(text, font.display.bold)

// The saved result stays on the velvet for as long as the board is finished, in the largest
// box across the ring's centre that leaves every token and name clear. A dark glow opens first
// and the words rise into it once the End game dialog has gone; the result is already recorded,
// so nothing waits on the show. Actions under the words keep their room out of the fit, and rise
// with the words.
export const VictoryAnnouncement = ({ winner, label, boxes, left, top, band, actions }: {
  readonly winner: 'good' | 'evil'
  readonly label: string
  readonly boxes: readonly CentreBox[] // from centreBoxes, in band coordinates
  readonly left: number // the band's place in the parent
  readonly top: number
  readonly band: { readonly width: number; readonly height: number } // the fallback when no box is clear
  readonly actions?: { readonly node: ReactNode; readonly room: { readonly width: number; readonly height: number } }
}) => {
  const glow = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const room = actions?.room
  const fit = useMemo(() => {
    const text = label.toLocaleUpperCase()
    const below = room ? room.height : 0
    const fitted = fitResult((boxes.length > 0 ? boxes : [{ left: 0, top: 0, ...band }])
      .filter(box => !room || box.width >= room.width + 2 * resultFrame.padX).map(box => ({ ...box, height: box.height - below })),
    widthAtOnePoint(text) * slack, twoLineWidth(text.split(/\s+/), widthAtOnePoint) * slack)
    return fitted && { ...fitted, box: { ...fitted.box, height: fitted.box.height + below } }
  }, [label, boxes, band, room])
  useLayoutEffect(() => {
    const shown = { opacity: 1, transform: 'none' }
    const glowRun = glow.current?.animate?.(reduced ? [{ opacity: 0 }, shown] : [{ opacity: 0, transform: 'scale(0.6)' }, shown],
      { duration: durationFor(motion.duration.win, reduced, true), easing: motion.css.ease, fill: 'backwards' })
    const wordsRun = words.current?.animate?.(reduced ? [{ opacity: 0 }, shown] : [{ opacity: 0, transform: 'scale(0.92) translateY(12px)' }, shown],
      { duration: durationFor(motion.duration.winWords, reduced, true), delay: durationFor(motion.duration.winWordsDelay, reduced),
        easing: motion.css.ease, fill: 'backwards' })
    return () => { glowRun?.cancel(); wordsRun?.cancel() }
  }, [reduced, winner])

  if (!fit) return null
  const { box, fontSize } = fit
  const colour = palette.teamOnFelt[winner === 'good' ? 'townsfolk' : 'demon']
  const rule = { height: 1, width: '70%', background: `linear-gradient(90deg, transparent, ${colour}, transparent)` }
  return <div style={{ position: 'absolute', left: left + box.left, top: top + box.top, width: box.width, height: box.height, zIndex: 1,
    display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
    <div role="status" aria-live="polite" style={{ position: 'relative', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center',
      padding: `${resultFrame.padY}px ${resultFrame.padX}px`, fontSize }}>
      <div ref={glow} aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse, #100b0be8 0%, #100b0b88 50%, transparent 76%)' }} />
      <div ref={words} data-win-words style={{ position: 'relative' }}>
        <div aria-hidden style={{ ...rule, margin: `0 auto ${resultFrame.rules / 2}em` }} />
        <div style={{ fontFamily: font.display.bold, lineHeight: resultFrame.line, textTransform: 'uppercase',
          color: colour, textShadow: `0 2px 8px #000, 0 0 28px ${colour}88` }}>{label}</div>
        <div aria-hidden style={{ ...rule, margin: `${resultFrame.rules / 2}em auto 0` }} />
        {actions ? <div style={{ display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}>{actions.node}</div> : null}
      </div>
    </div>
  </div>
}
