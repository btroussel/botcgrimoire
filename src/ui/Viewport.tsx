import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface Viewport {
  readonly width: number
  readonly height: number
  readonly top: number
  readonly left: number
}

const initialViewport: Viewport = { width: 0, height: 0, top: 0, left: 0 }
const ViewportContext = createContext(initialViewport)

// Scroll the field's own containers. Scrolling the document would also move the board
// and its fixed controls when Safari pans the viewport above the keyboard.
const revealInput = () => {
  const input = document.activeElement
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return
  for (let parent = input.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (parent.scrollHeight <= parent.clientHeight || !/auto|scroll/.test(getComputedStyle(parent).overflowY)) continue
    const field = input.getBoundingClientRect()
    const bounds = parent.getBoundingClientRect()
    const top = bounds.top + 8
    const bottom = bounds.bottom - 8
    if (field.top < top) parent.scrollTop += field.top - top
    else if (field.bottom > bottom) parent.scrollTop += Math.min(field.bottom - bottom, field.top - top)
  }
}

export const ViewportProvider = ({ children }: { readonly children: ReactNode }) => {
  // Match the static export until hydration completes, then measure the browser.
  const [viewport, setViewport] = useState(initialViewport)

  useEffect(() => {
    const visual = window.visualViewport
    const update = () => {
      // Pinch zoom magnifies the existing layout; it must not shrink or recenter it.
      if (visual && Math.abs(visual.scale - 1) > 0.01) return
      const next = visual
        ? { width: visual.width, height: visual.height, top: visual.offsetTop, left: visual.offsetLeft }
        : { width: window.innerWidth, height: window.innerHeight, top: 0, left: 0 }
      setViewport(previous => previous.width === next.width && previous.height === next.height
        && previous.top === next.top && previous.left === next.left ? previous : next)
    }
    update()
    window.addEventListener('resize', update)
    visual?.addEventListener('resize', update)
    visual?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      visual?.removeEventListener('resize', update)
      visual?.removeEventListener('scroll', update)
    }
  }, [])

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(revealInput)
    const focus = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(revealInput) }
    document.addEventListener('focusin', focus)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('focusin', focus) }
  }, [viewport.width, viewport.height, viewport.top, viewport.left])

  return <ViewportContext value={viewport}>{children}</ViewportContext>
}

export const useViewport = () => useContext(ViewportContext)

// The seating ring follows the page, not the smaller view above the keyboard.
// React Native Web's window dimensions also follow visualViewport on phones.
export const useLayoutViewport = () => {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const update = () => setSize(previous => {
      const next = { width: window.innerWidth, height: window.innerHeight }
      return previous.width === next.width && previous.height === next.height ? previous : next
    })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}
