// The Storyteller's own characters (docs/store.md, Custom scripts and settings). A record is the
// schema's homebrew object, so putting one on a script is copying it in, and the script file
// stays readable by any other tool. A game embeds its script, so editing or deleting a character
// here never changes a game already created with it.
import type { CustomScript, Homebrew, Script } from '../content'
import { asCharacterId, character, characters, demonNight, nightMarkers, scriptHomebrew } from '../content'
import { randomId } from '../engine'
import type { SavedGame } from './saved'
import type { SavedScript } from './customScripts'

export interface SavedCharacter {
  readonly character: Homebrew
  readonly updatedAt: number
}

// The schema allows lowercase letters and digits. The name gives it a readable start and four
// random characters keep it apart from an official id and from another Storyteller's homebrew
// of the same name, which a shared script may bring onto this device.
export const mintCharacterId = (name: string, taken: (id: string) => boolean = () => false): string => {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  for (;;) {
    const id = randomId(slug === '' ? 'homebrew' : slug, 4)
    if (!characters.has(asCharacterId(id)) && !taken(id)) return id
  }
}

// The script with its copy of this character replaced, or the same script when it has none.
export const withHomebrew = (script: CustomScript, h: Homebrew): CustomScript =>
  script.items.some((item) => typeof item !== 'string' && item.id === h.id)
    ? { ...script, items: script.items.map((item) => (typeof item !== 'string' && item.id === h.id ? h : item)) }
    : script

// The first editor offered the start of the night on other nights, just after dusk, for what
// really wakes before the Demon, and nothing for a Demon's own turn. A record saved there wakes
// in those places now; a game keeps the copy it was played with.
export const withCurrentWake = (h: Homebrew): Homebrew => {
  if (h.otherNight !== nightMarkers.other.dusk + 0.5) return h
  const otherNight = h.team === 'demon' ? character(asCharacterId('imp')).ordinals.other! + 0.5 : demonNight.first - 0.5
  return { ...h, otherNight }
}

export const scriptWithCurrentWake = (script: CustomScript): CustomScript => {
  const items = script.items.map((item) => (typeof item !== 'string' && item.id !== '_meta' && 'team' in item && item.team ? withCurrentWake(item) : item))
  return items.every((item, i) => item === script.items[i]) ? script : { ...script, items }
}

// Every homebrew record the device holds, the one to show last: old games, then saved scripts,
// then the Storyteller's own list, then the open game, whose copy is the one it was played with.
export const registryOf = (
  games: readonly SavedGame[],
  scripts: readonly SavedScript[],
  own: readonly SavedCharacter[],
  open?: Script,
): readonly Homebrew[] => [
  ...[...games].reverse().flatMap((g) => scriptHomebrew(g.script)),
  ...[...scripts].reverse().flatMap((s) => scriptHomebrew(s.script)),
  ...own.map((c) => c.character),
  ...(open ? scriptHomebrew(open) : []),
]
