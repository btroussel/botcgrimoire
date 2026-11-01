// Shaking the phone shakes the open bag. The browser reports the phone's acceleration; the bag
// answers with the opposite push, as a real bag's contents lag behind the hand. The phone passes
// from player to player, so ordinary handling stays under a threshold and moves nothing.
import { useEffect, useRef } from 'react'

// m/s² with gravity removed; handing the phone over stays below it.
const deadzone = 2.5
// Pixels per frame squared of push for each m/s² past the threshold.
const pushPerUnit = 0.16
// A shake this hard throws a disc from low in the heap onto the top.
export const tossAbove = 12

export interface Push { readonly fx: number; readonly fy: number; readonly strength: number }

export const shakePush = (ax: number, ay: number): Push | undefined => {
  const m = Math.hypot(ax, ay)
  if (m < deadzone) return undefined
  const k = (m - deadzone) / m
  return { fx: -ax * k * pushPerUnit, fy: -ay * k * pushPerUnit, strength: m }
}

// Device axes point right and up with the phone upright; the page's point right and down, and
// turn with the screen.
export const screenAxes = (x: number, y: number, angleDegrees: number): readonly [number, number] => {
  const angle = angleDegrees * Math.PI / 180, dy = -y
  return [x * Math.cos(angle) + dy * Math.sin(angle), -x * Math.sin(angle) + dy * Math.cos(angle)]
}

// iPhone reports motion only after the person allows it, and asks only from a tap: the draw's
// start button calls this. Elsewhere it does nothing, and a refusal only leaves the bag still.
export const askForShakes = () => {
  if (typeof DeviceMotionEvent === 'undefined') return
  const request = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
  if (typeof request === 'function') void request.call(DeviceMotionEvent).catch(() => undefined)
}

// Calls back with the phone's acceleration on the page's axes, while `active`.
export const useShake = (active: boolean, onShake: (ax: number, ay: number) => void) => {
  const handler = useRef(onShake)
  useEffect(() => { handler.current = onShake })
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    // Some Android browsers give only the reading with gravity: a slow average stands in for it.
    const gravity = { x: 0, y: 0, ready: false }
    const listen = (event: DeviceMotionEvent) => {
      let x: number, y: number
      const bare = event.acceleration, whole = event.accelerationIncludingGravity
      if (bare?.x != null && bare.y != null) { x = bare.x; y = bare.y }
      else if (whole?.x != null && whole.y != null) {
        if (!gravity.ready) { gravity.x = whole.x; gravity.y = whole.y; gravity.ready = true }
        gravity.x += (whole.x - gravity.x) * 0.1; gravity.y += (whole.y - gravity.y) * 0.1
        x = whole.x - gravity.x; y = whole.y - gravity.y
      } else return
      const [ax, ay] = screenAxes(x, y, screen.orientation?.angle ?? 0)
      handler.current(ax, ay)
    }
    window.addEventListener('devicemotion', listen)
    return () => window.removeEventListener('devicemotion', listen)
  }, [active])
}
