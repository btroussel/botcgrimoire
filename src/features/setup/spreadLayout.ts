// The face-down bag in a square: a honeycomb, the tightest way to set discs down, so even twenty
// tokens stay large enough to tap. Every row is centred and each sits in the hollows of the last,
// so the bag keeps one symmetric shape (3·2·3, 3·4·3, 4·5·4) instead of a row trailing off to one
// side. Each disc lies at a slight turn of its own, so the bag reads as tokens tipped out on the
// table rather than a grid of buttons.
const rowStep = Math.sqrt(3) / 2
// A small bag would otherwise spread a few huge discs.
const largest = 0.36
// What a shape gives up in size to stay the same upside down, and to keep its ends full.
const lopsided = 0.88
const tapered = 0.97

export interface SpreadPlace {
  readonly x: number // the centre, from the square's top left
  readonly y: number
  readonly turn: number // degrees
}

// Centred rows nest in each other's hollows only when their lengths alternate odd and even.
// Inside the shape neighbours differ by one; only the first and last rows may be shorter by
// three, the way a short row sits in the middle of the edge. A longer step leaves a hole.
const nests = (rows: readonly number[], at: number) => {
  const step = rows[at]! - rows[at - 1]!
  if (Math.abs(step) === 1) return true
  return (at === 1 && step === 3) || (at === rows.length - 1 && step === -3)
}

const shapes = (count: number): readonly (readonly number[])[] => {
  const found: number[][] = []
  const grow = (rows: number[], left: number) => {
    // A step down by three is only known to be the last once the count runs out.
    if (left === 0) { if (rows.every((_, at) => at === 0 || nests(rows, at))) found.push([...rows]); return }
    for (let length = 1; length <= left; length++) {
      rows.push(length)
      const at = rows.length - 1
      if (at === 0 || nests(rows, at) || length - rows[at - 1]! === -3) grow(rows, left - length)
      rows.pop()
    }
  }
  grow([], count)
  return found
}

const fit = (rows: readonly number[], size: number, gap: number) => {
  const columns = Math.max(...rows)
  return Math.min((size - (columns - 1) * gap) / columns,
    (size - (rows.length - 1) * gap * rowStep) / (1 + (rows.length - 1) * rowStep))
}

const score = (rows: readonly number[], size: number, gap: number) => {
  const mirrored = rows.every((length, i) => length === rows[rows.length - 1 - i])
  const full = rows.every((length, i) => i === 0 || Math.abs(length - rows[i - 1]!) === 1)
  return fit(rows, size, gap) * (mirrored ? 1 : lopsided) * (full ? 1 : tapered)
}

export const spreadLayout = (count: number, size: number, gap: number): { readonly token: number; readonly places: readonly SpreadPlace[] } => {
  if (count < 2) return { token: size * largest, places: count ? [{ x: size / 2, y: size / 2, turn: 0 }] : [] }
  let best = { score: -Infinity, rows: [count] as readonly number[] }
  for (const rows of shapes(count)) {
    const value = score(rows, size, gap)
    if (value > best.score + 0.01) best = { score: value, rows }
  }
  const rows = best.rows
  const token = Math.min(fit(rows, size, gap), size * largest)
  const pitch = token + gap
  const top = (size - token - (rows.length - 1) * pitch * rowStep) / 2
  const places: SpreadPlace[] = []
  rows.forEach((length, row) => {
    for (let slot = 0; slot < length; slot++) {
      places.push({
        x: size / 2 + (slot - (length - 1) / 2) * pitch,
        y: top + token / 2 + row * pitch * rowStep,
        turn: ((places.length * 67) % 61) - 30,
      })
    }
  })
  return { token, places }
}
