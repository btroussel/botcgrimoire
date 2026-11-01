// Dragging a placed reminder to another seat. Touch lifts it after a long press, so a tap still
// takes it off and a pan or a pinch that starts on it still moves the board; a mouse lifts it
// once it has moved a few pixels. While it is lifted the board holds still and the seat under it
// is the drop target. Letting go anywhere else, a second finger or Escape puts it back.
// A draggable chip carries `data-chip` inside its seat's `data-seat-context-target`, so one set of
// handlers on the ring finds what was pressed.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'

import type { SeatId } from '../../engine'

export interface DragPoint {
  readonly x: number // where the lifted chip's centre is drawn, in the ring's band
  readonly y: number
  readonly seat?: SeatId // the seat it would land on
}

export interface Lifted {
  readonly seat: SeatId // where it came from
  readonly chip: string
  readonly target: SeatId | undefined // another seat under it
  readonly touch: boolean
}

interface Press {
  readonly pointer: number
  readonly seat: SeatId
  readonly chip: string
  readonly x: number
  readonly y: number
  readonly touch: boolean
  last: { x: number; y: number }
  timer?: ReturnType<typeof setTimeout>
  lifted?: true
}

const hold = 400 // ms, near the platforms' own long press
const touchSlop = 10 // px a finger may wander before the press is a pan, as Pressable allows
const mouseSlop = 5 // px, as the reference drawer

export const useReminderDrag = (
  enabled: boolean,
  locate: (clientX: number, clientY: number, touch: boolean) => DragPoint,
  onDrop: (from: SeatId, chip: string, to: SeatId) => void,
) => {
  const [lifted, setLifted] = useState<Lifted>()
  const root = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const press = useRef<Press | undefined>(undefined)
  const point = useRef<DragPoint | undefined>(undefined)
  // The click that follows a drag belongs to no chip, or it would take the reminder off.
  const swallowClick = useRef(false)
  const latest = useRef({ locate, onDrop })
  useLayoutEffect(() => { latest.current = { locate, onDrop } })

  const follow = (clientX: number, clientY: number) => {
    const p = press.current
    if (!p) return
    const at = latest.current.locate(clientX, clientY, p.touch)
    point.current = at
    if (ghost.current) ghost.current.style.transform = `translate(${at.x}px, ${at.y}px)`
    const target = at.seat !== p.seat ? at.seat : undefined
    setLifted(current => current && current.target !== target ? { ...current, target } : current)
  }
  const lift = (p: Press) => {
    p.lifted = true
    clearTimeout(p.timer)
    // Capture keeps a mouse drag attached once it leaves the ring.
    try { root.current?.setPointerCapture(p.pointer) } catch { /* the pointer has already gone */ }
    setLifted({ seat: p.seat, chip: p.chip, target: undefined, touch: p.touch })
    follow(p.last.x, p.last.y)
  }
  const end = (drop: boolean) => {
    const p = press.current
    press.current = undefined
    if (!p) return
    clearTimeout(p.timer)
    if (!p.lifted) return
    swallowClick.current = true
    setLifted(undefined)
    const to = point.current?.seat
    point.current = undefined
    if (root.current?.hasPointerCapture(p.pointer)) root.current.releasePointerCapture(p.pointer)
    if (drop && to !== undefined && to !== p.seat) latest.current.onDrop(p.seat, p.chip, to)
  }
  const endRef = useRef(end)
  useLayoutEffect(() => { endRef.current = end })

  // The lifted chip is drawn where the pointer is before its first paint.
  useLayoutEffect(() => {
    if (lifted && ghost.current && point.current) ghost.current.style.transform = `translate(${point.current.x}px, ${point.current.y}px)`
  }, [lifted])
  useEffect(() => { if (!enabled) endRef.current(false) }, [enabled])
  useEffect(() => () => clearTimeout(press.current?.timer), [])
  // Any new press, anywhere, starts a new gesture; a second finger is a pinch.
  useEffect(() => {
    const another = (event: PointerEvent) => {
      swallowClick.current = false
      if (press.current && event.pointerId !== press.current.pointer) endRef.current(false)
    }
    document.addEventListener('pointerdown', another, true)
    return () => document.removeEventListener('pointerdown', another, true)
  }, [])
  // Browsers only let a page stop a scroll from a listener that is neither passive nor added
  // mid-gesture, so this one stays on the ring and acts only while a reminder is lifted.
  useEffect(() => {
    const node = root.current
    if (!node) return
    const still = (event: TouchEvent) => { if (press.current?.lifted) event.preventDefault() }
    node.addEventListener('touchmove', still, { passive: false })
    return () => node.removeEventListener('touchmove', still)
  }, [])
  const isLifted = lifted !== undefined
  useEffect(() => {
    if (!isLifted) return
    const cancel = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      event.preventDefault()
      endRef.current(false)
    }
    // Captured, so Escape puts the reminder back before it closes anything under it.
    document.addEventListener('keydown', cancel, true)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('keydown', cancel, true)
      window.removeEventListener('blur', cancel)
    }
  }, [isLifted])

  const handlers: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: event => {
      if (press.current || !enabled || !event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return
      const chip = event.target.closest('[data-chip]')?.getAttribute('data-chip')
      const seat = event.target.closest('[data-seat-context-target]')?.getAttribute('data-seat-context-target')
      if (!chip || !seat) return
      const x = event.clientX
      const y = event.clientY
      const p: Press = { pointer: event.pointerId, seat: seat as SeatId, chip, x, y, touch: event.pointerType !== 'mouse', last: { x, y } }
      if (p.touch) p.timer = setTimeout(() => { if (press.current === p) lift(p) }, hold)
      press.current = p
    },
    onPointerMove: event => {
      const p = press.current
      if (!p || event.pointerId !== p.pointer) return
      if (p.lifted) { follow(event.clientX, event.clientY); return }
      p.last = { x: event.clientX, y: event.clientY }
      const moved = Math.hypot(event.clientX - p.x, event.clientY - p.y)
      if (p.touch) { if (moved > touchSlop) end(false) } // a pan or a pinch, the board's own
      else if (event.buttons === 0) end(false) // let go outside the page
      else if (moved > mouseSlop) lift(p)
    },
    onPointerUp: event => {
      const p = press.current
      if (!p || event.pointerId !== p.pointer) return
      if (p.lifted) follow(event.clientX, event.clientY)
      end(true)
    },
    onPointerCancel: event => { if (event.pointerId === press.current?.pointer) end(false) },
    onLostPointerCapture: event => {
      // A finger first captures the chip under it; that capture moving to the ring is no loss.
      if (event.target === event.currentTarget && event.pointerId === press.current?.pointer) end(false)
    },
    onClickCapture: event => {
      if (!swallowClick.current) return
      swallowClick.current = false
      event.preventDefault()
      event.stopPropagation()
    },
    // A long press on a phone would open the browser's menu, and an image would start its own drag.
    onContextMenu: event => { if (press.current?.touch) event.preventDefault() },
    onDragStart: event => { if (press.current) event.preventDefault() },
  }
  return { lifted, root, ghost, handlers }
}
