// The bluffs drawer's picks: up to three keys, ticked in the order they were tapped.
import type { CharacterId } from '../../content'

export const bluffCount = 3

// The drawer opens on the saved bluffs, one that has since come into play included: the Demon
// was shown it, and opening the drawer to show them again must not quietly drop it.
export const openPicks = (saved: readonly CharacterId[]): readonly CharacterId[] => saved.slice(0, bluffCount)

// A ticked key comes back off. Any other is taken while there is room: with three ticked the
// other keys dim, so a fourth waits for one to come off rather than replace one unasked.
export const tapPick = (picks: readonly CharacterId[], id: CharacterId): readonly CharacterId[] =>
  picks.includes(id) ? picks.filter((pick) => pick !== id) : picks.length < bluffCount ? [...picks, id] : picks

// Shuffle fills only what is missing, so a hand pick stays, and draws all three afresh once
// three are ticked. It draws from the choices alone, never a good character in play, so a
// redraw also lets go of a saved bluff that has come into play.
export const shufflePicks = (picks: readonly CharacterId[], choices: readonly CharacterId[], random = Math.random): readonly CharacterId[] => {
  const kept = picks.length >= bluffCount ? [] : picks
  const pool = choices.filter((id) => !kept.includes(id))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return [...kept, ...pool.slice(0, bluffCount - kept.length)]
}
