// The bluffs drawer's three wells. One wears the ring, where the next key goes, so no tap is ever
// refused: a key fills the ringed well, a tap on a full well empties it, a chosen key comes back out.
import type { CharacterId } from '../../content'

export const bluffCount = 3

export interface Wells {
  readonly wells: readonly (CharacterId | undefined)[]
  readonly ring: number
}

const firstEmpty = (wells: Wells['wells'], after = -1): number | undefined => {
  for (let step = 1; step <= wells.length; step++) {
    const i = (after + step) % wells.length
    if (wells[i] === undefined) return i
  }
  return undefined
}

// The saved bluffs still to be had, each in its own well, and the ring on the well asked for or
// the first empty one.
export const openWells = (saved: readonly CharacterId[], choices: readonly CharacterId[], well?: number): Wells => {
  const wells = Array.from({ length: bluffCount }, (_, i) => {
    const id = saved[i]
    return id !== undefined && choices.includes(id) ? id : undefined
  })
  return { wells, ring: well ?? firstEmpty(wells) ?? 0 }
}

// A chosen key leaves its well and rings it. Any other fills the ringed well, and the ring moves
// on to the next empty well, or stays where it is once all three are full.
export const tapKey = ({ wells, ring }: Wells, id: CharacterId): Wells => {
  const at = wells.indexOf(id)
  if (at >= 0) return { wells: wells.map((w, i) => (i === at ? undefined : w)), ring: at }
  const next = wells.map((w, i) => (i === ring ? id : w))
  return { wells: next, ring: firstEmpty(next, ring) ?? ring }
}

export const tapWell = ({ wells }: Wells, index: number): Wells =>
  ({ wells: wells.map((w, i) => (i === index ? undefined : w)), ring: index })

// Shuffle fills only the empty wells, so a hand pick stays, and draws all three afresh once none
// is empty. It draws from the choices alone, never a good character in play.
export const shuffleWells = ({ wells, ring }: Wells, choices: readonly CharacterId[], random = Math.random): Wells => {
  const redraw = wells.every((w) => w !== undefined)
  const kept = redraw ? [] : wells.filter((w): w is CharacterId => w !== undefined)
  const pool = choices.filter((id) => !kept.includes(id))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return { wells: wells.map((w) => (redraw || w === undefined ? pool.shift() : w)), ring }
}
