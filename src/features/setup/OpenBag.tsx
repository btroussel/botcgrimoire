// The bag, open on the table and seen from above, its tokens heaped face down inside. A player
// slides discs aside to look, taps the one on top to take it, or shakes the phone to stir them.
// The heap lives in bagPile.ts at a fixed reference size; this draws it at the square's size and
// writes each frame straight to the discs, so a moving heap never re-renders React.
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import type { Translate } from '../../content'
import { artUri } from '../../ui/Art'
import { useFocusVisible } from '../../ui/focus'
import { focusRing, motion, palette } from '../../ui/theme'
import { TokenBack } from './TokenBack'
import { VelvetColourContext, velvetArt } from '../../ui/Velvet'
import { bagToken, dragTo, grab, hitPile, joltPile, letGo, lift, openPile, posePile, stepPile, stir, tossPile, wakePile } from './bagPile'
import type { Disc, Pile } from './bagPile'
import { shakePush, tossAbove, useShake } from './shake'
import type { Lift } from './Spread'

// The heap is simulated in a square this wide and drawn scaled to the bag's room.
const reference = 320
// The mouth's radius, as a share of the room; the narrow fold of cloth round it reaches the edge.
const mouthShare = 0.42
const R = reference * mouthShare
// A finger that moves this far is sliding, not tapping; a press held this long is not a tap.
const slop = 7
const tapMs = 500

// Which way rotate3d lifts a point toward the viewer, measured once rather than assumed.
let tiltSign: number | undefined
const measureTilt = () => {
  if (tiltSign === undefined) {
    try { tiltSign = new DOMMatrix().rotateAxisAngle(1, 0, 0, 10).transformPoint(new DOMPoint(0, 1, 0)).z > 0 ? 1 : -1 } catch { tiltSign = 1 }
  }
  return tiltSign
}

interface Press {
  readonly startX: number
  readonly startY: number
  readonly at: number
  readonly target: Disc | undefined
  readonly offX: number
  readonly offY: number
  x: number
  y: number
  lastX: number
  lastY: number
  moved: boolean
}

export const OpenBag = ({ size, room, free, taken, t, onTake }: {
  readonly size: number // the token's square, which the bag is centred on and a taken token rises into
  readonly room: number // the bag's own square, at least as large
  readonly free: readonly boolean[]
  readonly taken?: number
  readonly t: Translate
  readonly onTake: (at: number, from: Lift) => void
}) => {
  const colour = useContext(VelvetColourContext)
  const focusVisible = useFocusVisible()
  const scale = room / reference
  const token = bagToken(R, free.length)
  const [pile] = useState<Pile>(() => openPile(free.flatMap((open, at) => open ? [at] : []), R, token, Math.random))
  const [places] = useState(() => pile.discs.map(d => d.at).sort((a, b) => a - b))
  const [focused, setFocused] = useState<number>()
  const cloth = useMemo(() => drape(velvetArt[colour] ? artUri(velvetArt[colour]) : ''), [colour])
  const sway = useRef<HTMLDivElement>(null)
  const mouth = useRef<HTMLDivElement>(null)
  const discs = useRef(new Map<number, HTMLDivElement>())
  const press = useRef<Press | undefined>(undefined)
  const loop = useRef({ frame: 0, awake: 0, last: 0, swayX: 0, swayY: 0, swayVX: 0, swayVY: 0, tossed: 0 })
  const leaving = taken !== undefined

  const paint = () => {
    const sign = measureTilt(), poses = posePile(pile), D = token * scale
    for (const d of pile.discs) {
      const el = discs.current.get(d.at), pose = poses.get(d.at)
      if (!el || !pose) continue
      const face = el.firstElementChild as HTMLElement | null, shade = face?.lastElementChild as HTMLElement | null
      const raised = d === pile.drag ? 1.08 : 1 + d.hop * 0.007
      el.style.transform = `translate3d(${(R + d.x) * scale - D / 2}px, ${(R + d.y) * scale - D / 2}px, 0)`
      el.style.zIndex = String(d.z)
      if (face) face.style.transform = `perspective(${D * 5}px) rotate3d(${pose.toward[1] * sign}, ${-pose.toward[0] * sign}, 0, ${pose.tilt}deg) scale(${(1 + Math.min(pose.level, 4) * 0.025) * raised}) rotate(${d.turn}deg)`
      if (shade) shade.style.opacity = String(Math.min(0.5, pose.cover * 0.55))
    }
    const l = loop.current
    if (sway.current) sway.current.style.transform = Math.abs(l.swayX) + Math.abs(l.swayY) > 0.02 ? `translate(${l.swayX}px, ${l.swayY}px)` : ''
  }

  // Runs only while something moves; a sleeping heap and a still bag stop it.
  const frame = (time: number) => {
    const l = loop.current
    l.frame = 0
    const steps = l.last ? Math.max(1, Math.min(3, Math.round((time - l.last) / (1000 / 60)))) : 1
    l.last = time
    let energy = 0
    for (let i = 0; i < steps; i++) {
      const p = press.current
      if (p && pile.drag) dragTo(pile, p.x + p.offX, p.y + p.offY)
      energy = Math.max(energy, stepPile(pile))
      l.swayVX = (l.swayVX - l.swayX * 0.2) * 0.72; l.swayVY = (l.swayVY - l.swayY * 0.2) * 0.72
      l.swayX = Math.max(-10, Math.min(10, l.swayX + l.swayVX)); l.swayY = Math.max(-10, Math.min(10, l.swayY + l.swayVY))
    }
    paint()
    const swaying = Math.abs(l.swayX) + Math.abs(l.swayY) + Math.abs(l.swayVX) + Math.abs(l.swayVY) > 0.05
    if (energy > 0.04 || press.current || swaying) l.awake = Math.max(l.awake, 20)
    if (--l.awake > 0) l.frame = requestAnimationFrame(frame)
    else { l.last = 0; l.swayX = l.swayY = l.swayVX = l.swayVY = 0; paint() }
  }
  const kick = (frames = 60) => {
    const l = loop.current
    l.awake = Math.max(l.awake, frames)
    if (!l.frame) l.frame = requestAnimationFrame(frame)
  }
  useLayoutEffect(() => {
    paint()
    const l = loop.current
    return () => { cancelAnimationFrame(l.frame); l.frame = 0 }
    // The first paint places the heap before the browser draws it; later ones come from the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  useShake(!leaving, (ax, ay) => {
    const push = shakePush(ax, ay)
    if (!push || press.current) return
    joltPile(pile, push.fx, push.fy, push.strength, Math.random)
    const l = loop.current, now = performance.now()
    if (push.strength > tossAbove && now - l.tossed > 140) { l.tossed = now; tossPile(pile, Math.random) }
    // The bag itself slides a little on the table, the same way.
    l.swayVX += push.fx * 2.2; l.swayVY += push.fy * 2.2
    kick()
  })

  const take = (d: Disc) => {
    if (leaving) return
    onTake(d.at, { x: size / 2 + d.x * scale, y: size / 2 + d.y * scale, token: token * scale, turn: d.turn })
  }
  // Where a pointer is, in the heap's own units from the mouth's centre.
  const local = (event: ReactPointerEvent) => {
    const box = mouth.current!.getBoundingClientRect()
    return { x: (event.clientX - box.left) / scale - R, y: (event.clientY - box.top) / scale - R }
  }
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving || press.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const p = local(event), target = hitPile(pile, p.x, p.y)
    wakePile(pile)
    press.current = { startX: p.x, startY: p.y, at: performance.now(), target, offX: target ? target.x - p.x : 0, offY: target ? target.y - p.y : 0, x: p.x, y: p.y, lastX: p.x, lastY: p.y, moved: false }
    kick()
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pr = press.current
    if (!pr) return
    const p = local(event)
    pr.x = p.x; pr.y = p.y
    if (!pr.moved && Math.hypot(p.x - pr.startX, p.y - pr.startY) * scale > slop) {
      pr.moved = true
      if (pr.target) grab(pile, pr.target)
    }
    if (pr.moved && !pr.target) stir(pile, { x: p.x, y: p.y, vx: p.x - pr.lastX, vy: p.y - pr.lastY })
    pr.lastX = p.x; pr.lastY = p.y
    wakePile(pile)
    kick()
  }
  const up = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const pr = press.current
    if (!pr) return
    press.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    letGo(pile)
    kick()
    if (!cancelled && !pr.moved && pr.target && performance.now() - pr.at < tapMs) take(pr.target)
  }
  const key = (d: Disc) => (event: ReactKeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    take(d)
  }

  const D = token * scale, mouthSize = R * 2 * scale, offset = size / 2 - R * scale
  return <div style={{ position: 'absolute', inset: 0, opacity: leaving ? 0 : 1, transition: `opacity ${motion.duration.lift}ms`, pointerEvents: leaving ? 'none' : 'auto' }}>
    <div ref={sway} style={{ position: 'absolute', inset: 0 }}>
      <Cloth size={size} scale={scale} cloth={cloth} />
      <div ref={mouth} onPointerDown={down} onPointerMove={move} onPointerUp={event => up(event, false)} onPointerCancel={event => up(event, true)}
        style={{ position: 'absolute', left: offset, top: offset, width: mouthSize, height: mouthSize, borderRadius: '50%', overflow: 'hidden', touchAction: 'none',
          background: 'radial-gradient(circle at 50% 46%, #3a0e18 0%, #22070e 45%, #100306 80%, #050102 100%)' }}>
        {places.map(at => {
          const d = pile.discs.find(disc => disc.at === at)
          if (!d) return null
          const ring = focused === at && focusVisible
          return <div key={at} role="button" tabIndex={0} aria-label={t('setup.drawTake', { n: at + 1 })}
            ref={el => { if (el) discs.current.set(at, el); else discs.current.delete(at) }}
            onKeyDown={key(d)}
            // A disc picked by keyboard comes up on top, so the player sees which one it is.
            onFocus={() => { setFocused(at); lift(pile, d, 10); kick() }}
            onBlur={() => setFocused(current => current === at ? undefined : current)}
            style={{ position: 'absolute', left: 0, top: 0, width: D, height: D, borderRadius: D / 2, display: at === taken ? 'none' : 'block',
              outline: ring ? `${focusRing.width}px solid ${palette.accent}` : 'none', outlineOffset: focusRing.offset }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <TokenBack size={D} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#0a0306', opacity: 0, pointerEvents: 'none' }} />
            </div>
          </div>
        })}
        {/* The lip's shadow falls into the mouth over the discs nearest the edge. */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', zIndex: 1000,
          background: 'radial-gradient(circle at 50% 52%, transparent 52%, #0a020580 78%, #050102d8 94%, #000 100%)' }} />
      </div>
      <Lip size={size} scale={scale} cloth={cloth} />
    </div>
  </div>
}

// ---- The cloth, drawn once per size: the rolled-down skirt, the lip over the mouth, the drawstring.

interface Drape { readonly velvet: string; readonly folds: string; readonly outline: readonly { readonly k: number; readonly amp: number; readonly phase: number }[] }

// Irregular folds and a wavy hem, fixed for the bag's life so the cloth never shimmers.
const drape = (velvet: string): Drape => {
  const widths = Array.from({ length: 26 }, () => ({ w: 6 + Math.random() * 12, dark: 0.18 + Math.random() * 0.25 }))
  const total = widths.reduce((sum, f) => sum + f.w, 0)
  let at = 0
  const stops = widths.flatMap(f => {
    const start = at * 360 / total, mid = (at + f.w / 2) * 360 / total, end = (at + f.w) * 360 / total
    at += f.w
    return [`#ffffff14 ${start.toFixed(1)}deg`, `rgba(0,0,0,${f.dark.toFixed(2)}) ${mid.toFixed(1)}deg`, `#ffffff10 ${end.toFixed(1)}deg`]
  })
  return {
    velvet,
    folds: `conic-gradient(from 7deg, ${stops.join(', ')})`,
    outline: Array.from({ length: 7 }, () => ({ k: 3 + Math.floor(Math.random() * 9), amp: 0.01 + Math.random() * 0.02, phase: Math.random() * Math.PI * 2 })),
  }
}

const Cloth = ({ size, scale, cloth }: { readonly size: number; readonly scale: number; readonly cloth: Drape }) => {
  const r = R * scale, outer = r * 1.19, box = outer * 2.2, c = box / 2
  let hem = ''
  for (let i = 0; i <= 120; i++) {
    const th = i / 120 * Math.PI * 2
    const rr = outer * (1 + cloth.outline.reduce((sum, w) => sum + w.amp * Math.sin(w.k * th + w.phase), 0))
    hem += `${i ? 'L' : 'M'}${(c + rr * Math.cos(th)).toFixed(1)},${(c + rr * Math.sin(th)).toFixed(1)}`
  }
  return <div aria-hidden style={{ position: 'absolute', left: size / 2 - c, top: size / 2 - c, width: box, height: box, pointerEvents: 'none', filter: 'drop-shadow(0 12px 16px rgba(0,0,0,0.7))' }}>
    <div style={{ position: 'absolute', inset: 0, clipPath: `path('${hem}Z')`,
      background: `radial-gradient(circle, transparent ${r * 0.98}px, #00000060 ${r * 1.02}px, #ffffff1c ${r * 1.07}px, transparent ${r * 1.11}px, #00000040 ${outer * 0.96}px, #00000090 ${outer * 1.05}px), ${cloth.folds}, url(${cloth.velvet}) center / ${r * 1.6}px` }} />
  </div>
}

const Lip = ({ size, scale, cloth }: { readonly size: number; readonly scale: number; readonly cloth: Drape }) => {
  const r = R * scale, l = r * 1.12, c = size / 2
  const ring = `radial-gradient(circle, transparent ${r * 0.93}px, #000 ${r * 0.945}px, #000 ${r * 1.03}px, transparent ${r * 1.09}px)`
  // The drawstring lies loose round the rim, its two ends trailing onto the table.
  const cr = r * 1.04, k = Math.max(3, r * 0.03), ex = c + cr * Math.cos(0.5), ey = c + cr * Math.sin(0.5)
  const ends = [
    { d: `M${ex},${ey} C${ex + r * 0.2},${ey + r * 0.1} ${ex + r * 0.12},${ey + r * 0.32} ${ex + r * 0.25},${ey + r * 0.45}`, knot: [ex + r * 0.25, ey + r * 0.45] },
    { d: `M${ex},${ey} C${ex + r * 0.08},${ey + r * 0.2} ${ex - r * 0.08},${ey + r * 0.36} ${ex + r * 0.02},${ey + r * 0.55}`, knot: [ex + r * 0.02, ey + r * 0.55] },
  ]
  const rope = (d: string) => <>
    <path d={d} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={k + 3} strokeLinecap="round" transform="translate(2 4)" />
    <path d={d} fill="none" stroke="#a9834a" strokeWidth={k} strokeLinecap="round" />
    <path d={d} fill="none" stroke="#5e4220" strokeWidth={k} strokeDasharray={`${k * 0.5} ${k * 0.9}`} opacity={0.75} />
  </>
  return <>
    <div aria-hidden style={{ position: 'absolute', left: c - l, top: c - l, width: l * 2, height: l * 2, pointerEvents: 'none', zIndex: 1,
      background: `radial-gradient(circle, transparent ${r * 0.93}px, #2a0710 ${r * 0.945}px, #ffffff30 ${r * 0.975}px, #ffffff10 ${r * 1.0}px, #00000070 ${r * 1.04}px, transparent ${r * 1.09}px), ${cloth.folds}, url(${cloth.velvet}) center / ${r * 1.6}px`,
      maskImage: ring, WebkitMaskImage: ring }} />
    <svg aria-hidden width={size} height={size} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 1 }}>
      {rope(`M${c + cr},${c} A${cr},${cr} 0 1 1 ${c + cr - 0.01},${c - 0.5}`)}
      {ends.map(({ d }) => <g key={d}>{rope(d)}</g>)}
      {ends.map(({ knot: [x, y] }) => <circle key={`${x},${y}`} cx={x} cy={y} r={k * 1.15} fill="#8a6a38" stroke="#4a3418" strokeWidth={1.5} />)}
    </svg>
  </>
}
