import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { boardLayoutFor, referenceCompactWidth, referenceMaximumWidth, referenceSettledWidth } from './boardLayout'
import { useReducedMotion } from '../../ui/motion'
import { motion } from '../../ui/theme'

// Pointer capture keeps a horizontal drag attached when it leaves the drawer.
// Coalescing pointer events avoids rendering every hardware sample.
// `onReserve` hears the width the board yields in the same update as the drawer's own width,
// so a screen wide enough to yield redraws once per frame.
export const useReferenceDrawer = (open: boolean, viewport: number, upright: boolean, onOpen: () => void, onClose: () => void,
  onReserve: (width: number) => void) => {
  const maximum = referenceMaximumWidth(viewport)
  const compact = Math.min(referenceCompactWidth(viewport), maximum)
  const reduced = useReducedMotion()
  const [width, setWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const current = useRef(0)
  const preferred = useRef<'compact' | 'full'>('compact')
  const frame = useRef<number | undefined>(undefined)
  const drag = useRef<{ x: number; y: number; width: number; moved: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const stop = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
  }, [])
  const board = useRef({ viewport, upright, onReserve })
  useLayoutEffect(() => {
    board.current = { viewport, upright, onReserve }
    onReserve(boardLayoutFor(viewport, current.current, upright).reservedWidth)
  }, [viewport, upright, onReserve])
  const write = useCallback((value: number) => {
    current.current = value
    setWidth(value)
    board.current.onReserve(boardLayoutFor(board.current.viewport, value, board.current.upright).reservedWidth)
  }, [])
  const animate = useCallback((target: number) => {
    stop()
    const from = current.current
    if (reduced || Math.abs(target - from) < 1) { write(target); return }
    const started = performance.now()
    const tick = (now: number) => {
      const time = Math.min(1, (now - started) / motion.duration.drawer)
      write(from + (target - from) * motion.ease(time))
      if (time < 1) frame.current = requestAnimationFrame(tick)
      else frame.current = undefined
    }
    frame.current = requestAnimationFrame(tick)
  }, [reduced, stop, write])
  useLayoutEffect(() => {
    if (!drag.current?.moved) animate(open ? preferred.current === 'full' ? maximum : compact : 0)
  }, [open, maximum, compact, animate])
  useEffect(() => stop, [stop])

  const settle = (value: number) => {
    const target = referenceSettledWidth(value, maximum, compact)
    if (target === 0) { onClose(); animate(0) }
    else { preferred.current = target > compact ? 'full' : 'compact'; onOpen(); animate(target) }
  }
  const handlers: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: event => {
      if (event.button !== 0 || !event.isPrimary) return
      stop()
      suppressClick.current = false
      drag.current = { x: event.clientX, y: event.clientY, width: current.current, moved: false }
    },
    onPointerMove: event => {
      const start = drag.current
      if (!start) return
      const delta = start.x - event.clientX
      // A vertical gesture belongs to the reference's native scroll container.
      if (!start.moved && Math.abs(event.clientY - start.y) > Math.max(5, Math.abs(delta))) {
        drag.current = undefined
        return
      }
      if (!start.moved && Math.abs(delta) < 5) return
      event.preventDefault()
      if (!start.moved) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); onOpen() }
      suppressClick.current = true
      const next = Math.max(0, Math.min(maximum, start.width + delta))
      stop()
      frame.current = requestAnimationFrame(() => { write(next); frame.current = undefined })
    },
    onPointerUp: event => {
      const start = drag.current
      if (!start) return
      const next = Math.max(0, Math.min(maximum, start.width + start.x - event.clientX))
      drag.current = undefined
      setDragging(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (start.moved) { stop(); write(next); settle(next) }
    },
    onPointerCancel: () => {
      const start = drag.current
      drag.current = undefined
      setDragging(false)
      if (start?.moved) settle(start.width)
    },
    onLostPointerCapture: event => {
      // Touch initially captures the child under the finger. Ignore its bubbled release
      // when the drag transfers capture to the binding.
      if (event.target !== event.currentTarget) return
      if (!drag.current) return
      const start = drag.current
      drag.current = undefined
      setDragging(false)
      if (start.moved) settle(start.width)
    },
    onClickCapture: event => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
    },
  }
  const keyboard: HTMLAttributes<HTMLDivElement>['onKeyDown'] = event => {
    let next: number
    if (event.key === 'ArrowLeft') next = open ? maximum : compact
    else if (event.key === 'ArrowRight') next = open && preferred.current === 'full' ? compact : 0
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = maximum
    else return
    event.preventDefault()
    settle(next)
  }
  // A tap on a compact row asks for the rest of it, the instruction or the ability, this once:
  // the drawer's next opening keeps the width the Storyteller last dragged it to.
  const expand = () => { onOpen(); animate(maximum) }
  return { width, maximum, dragging, handlers, keyboard, expand }
}
