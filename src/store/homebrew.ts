// The Storyteller's own characters (docs/store.md, Custom scripts and settings). A record is the
// schema's homebrew object, so putting one on a script is copying it in, and the script file
// stays readable by any other tool. A game embeds its script, so editing or deleting a character
// here never changes a game already created with it.
import type { CustomScript, Homebrew, Script } from '../content'
import { asCharacterId, characters, nightMarkers, scriptHomebrew, stepBefore, wakeAfter } from '../content'
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

// A record saved before wakes named their step carries only its number, which this build's sheet
// reads as an imported file's is read. Once it names its step it is left alone, so a Storyteller
// who placed a character just after dusk keeps it there. The first editor offered other nights
// nothing but that start of the night, so a Demon saved there wakes with the Demons, after the
// Imp. A game keeps the copy it was played with.
export const withWakeSteps = (h: Homebrew): Homebrew => {
  const first = h.firstNightAfter === undefined && h.firstNight !== undefined && h.firstNight > 0 ? stepBefore('first', h.firstNight) : undefined
  const firstDemon = h.team === 'demon' && h.otherNight === nightMarkers.other.dusk + 0.5
  const other = h.otherNightAfter === undefined && h.otherNight !== undefined && h.otherNight > 0
    ? (firstDemon ? 'imp' : stepBefore('other', h.otherNight)) : undefined
  if (first === undefined && other === undefined) return h
  return {
    ...h,
    ...(first !== undefined ? { firstNightAfter: first } : {}),
    ...(other !== undefined ? { otherNight: wakeAfter('other', other) ?? h.otherNight!, otherNightAfter: other } : {}),
  }
}

export const scriptWithWakeSteps = (script: CustomScript): CustomScript => {
  const items = script.items.map((item) => (typeof item !== 'string' && item.id !== '_meta' && 'team' in item && item.team ? withWakeSteps(item) : item))
  return items.every((item, i) => item === script.items[i]) ? script : { ...script, items }
}

// Every homebrew record the device holds, the one to show last: old games, then saved scripts,
// then the Storyteller's own list, then the script being read, so a sheet shows the copy it
// carries, even an imported file's before it is saved, then the open game, whose copy is the one
// it was played with.
export const registryOf = (
  games: readonly SavedGame[],
  scripts: readonly SavedScript[],
  own: readonly SavedCharacter[],
  open?: Script,
  read?: Script,
): readonly Homebrew[] => [
  ...[...games].reverse().flatMap((g) => scriptHomebrew(g.script)),
  ...[...scripts].reverse().flatMap((s) => scriptHomebrew(s.script)),
  ...own.map((c) => c.character),
  ...(read ? scriptHomebrew(read) : []),
  ...(open ? scriptHomebrew(open) : []),
]
