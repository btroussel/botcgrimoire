// Whether focus should be drawn. A focus ring helps a keyboard user and is noise under a thumb,
// and react-native-web reports focus for both, so this watches the last input: a key press turns
// rings on, a pointer turns them off. One listener for the whole page, shared by every control.
import { useEffect, useState } from 'react'

let keyboard = false
const listeners = new Set<(on: boolean) => void>()
let installed = false

const install = () => {
  if (installed || typeof window === 'undefined') return
  installed = true
  const set = (on: boolean) => {
    if (keyboard === on) return
    keyboard = on
    listeners.forEach((l) => l(on))
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') set(true)
  })
  window.addEventListener('pointerdown', () => set(false))
}

export const useFocusVisible = (): boolean => {
  const [on, setOn] = useState(keyboard)
  useEffect(() => {
    install()
    listeners.add(setOn)
    return () => {
      listeners.delete(setOn)
    }
  }, [])
  return on
}

// react-native-web draws a View as a DOM element while its ref is typed as the native View, so
// a caller that reads the box or moves focus checks the node is one first.
export const domElement = (node: unknown): HTMLElement | null =>
  typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null

// Escape belongs to the topmost layer: a modal window, an open dialog or menu, or a popover. A
// window kept mounted while closed has no box, so it is not a layer. `except` is the caller's own
// window, which is not above itself.
export const layerAbove = (except?: Element | null): boolean =>
  Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"], [data-layer], :popover-open'))
    .some(element => element !== except && element.getClientRects().length > 0)
