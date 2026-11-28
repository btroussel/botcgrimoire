// How the token keys stand in a row of a given width. Kept apart from the piece that draws them
// so the rule can be tested: it is what keeps a key's name readable.
import { tokenKeys } from './theme'

const { comfortable, largest, gap, across } = tokenKeys
const span = (count: number, size: number) => count * size + Math.max(0, count - 1) * gap

// The widest a row of keys runs. A dock under the keys stops at the same width, so its buttons
// line up with their columns.
export const tokenKeysWidth = span(across, largest)

// As many across as stay large enough to read, then grown to fill the row. The row is what is
// capped, never the key: a capped key left the keys narrower than the dock under them on the
// phones whose width falls between two column counts.
export const tokenKeysLayout = (width: number): { readonly columns: number; readonly size: number; readonly width: number } => {
  const room = Math.min(width, tokenKeysWidth)
  const columns = Math.max(1, Math.min(across, Math.floor((room + gap) / (comfortable + gap))))
  const size = Math.floor((room - (columns - 1) * gap) / columns)
  return { columns, size, width: span(columns, size) }
}
