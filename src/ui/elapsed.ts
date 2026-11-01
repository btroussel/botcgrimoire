// The corner clock shows minutes and seconds, adding hours only when needed.
const second = 1_000

// Never negative: a game restored from a clock set ahead reads 0:00.
export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / second))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds / 60) % 60
  const s = String(seconds % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// Align updates to elapsed seconds, including clocks restored ahead of the current time.
export const untilNextSecond = (elapsedMs: number): number => second - (((elapsedMs % second) + second) % second)
