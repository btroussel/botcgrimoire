// The binding between the store and the scripts screen: the editions, the custom scripts and the
// Storyteller's own characters as rows in the UI locale, saving, importing, exporting and
// deleting a custom script, and the words the ScriptSheet piece is handed. The pure work is in store/scriptSheet.ts and
// compose.ts; this hook only calls the store and translates.
import { useCallback, useMemo, useSyncExternalStore } from 'react'

import type { CustomScript, Homebrew, Locale, NightMarker, ScriptId } from '../../content'
import { editions, gameText } from '../../content'
import { editionArt } from '../../content/generated/art'
import type { SavedCharacter, SavedScript, SavedScriptId } from '../../store'
import { mintScriptId, serializeScript, useStore } from '../../store'
import { minuteClock, relativeTime } from './relativeTime'
import type { ScriptSheetLabels } from '../../ui/ScriptSheet'
import { teamWords } from './character'
import type { Draft } from './compose'
import { fileName, fileOf, importText } from './compose'
import { downloadText } from '../../store/browser'
import type { CountRowLabels, TeamLabels } from '../../store/scriptSheet'
import { listed, sheetLabels, sheetTeams, teamLabels } from '../../store/scriptSheet'

export interface EditionRow {
  readonly id: ScriptId
  readonly name: string
  readonly count: number // characters on the sheet, Travellers included
  readonly logo?: number
}

export interface CustomRow {
  readonly saved: SavedScript
  readonly name: string
  readonly count: number
  readonly edited: string // the edited time in the locale's words
  readonly logo?: number
}

export interface CharacterRow {
  readonly saved: SavedCharacter
  readonly name: string
  readonly team: string // the team's word in the locale
  readonly scripts: number // saved scripts that carry it
}

export interface Scripts {
  readonly locale: Locale
  readonly t: (key: string, values?: Readonly<Record<string, string | number>>) => string
  readonly editions: readonly EditionRow[]
  readonly custom: readonly CustomRow[]
  readonly save: (draft: Draft) => Promise<SavedScript>
  readonly importFile: (text: string) => Promise<{ readonly errors: readonly string[] } | { readonly saved: SavedScript }>
  readonly keep: (script: CustomScript) => Promise<SavedScript> // a script read from a file or a link
  readonly remove: (id: SavedScriptId) => Promise<void>
  readonly exportFile: (saved: SavedScript) => void
  readonly characters: readonly CharacterRow[] // by team, then name
  readonly saveCharacter: (character: Homebrew) => Promise<void>
  readonly removeCharacter: (id: string) => Promise<void>
}

const editionLogo = (id: string): { readonly logo?: number } => {
  const logo = editionArt[id]
  return logo === undefined ? {} : { logo }
}

export const useScripts = (): Scripts => {
  const store = useStore()
  const { t, saveScript, removeScript, characters, saveCharacter, removeCharacter } = store
  const locale = store.settings.locale

  const editionRows = useMemo(
    () =>
      editions.map(
        (e): EditionRow => ({
          id: e.id as ScriptId,
          name: gameText(locale).edition(e.id).name,
          count: listed(e.id as ScriptId, locale).length,
          ...editionLogo(e.id),
        }),
      ),
    [locale],
  )

  const now = useSyncExternalStore(minuteClock.subscribe, minuteClock.now, minuteClock.now)
  const custom = useMemo(() => {
    // "Just now" is capitalised to stand alone, so mid-sentence it needs its own phrase.
    const editedWords = (time: string) => time === t('common.justNow') ? t('scripts.editedJustNow') : t('scripts.edited', { time })
    return store.scripts.map(
      (saved): CustomRow => ({
        saved,
        name: saved.script.name,
        count: listed(saved.script, locale).length,
        edited: editedWords(relativeTime(saved.updatedAt, now, t, locale)),
        ...editionLogo('custom'),
      }),
    )
  }, [store.scripts, locale, t, now])

  const save = useCallback(
    async (draft: Draft) => {
      const own = characters.map((c) => c.character)
      const saved: SavedScript = { id: draft.id ?? mintScriptId(), script: fileOf(draft, own), updatedAt: Date.now() }
      await saveScript(saved)
      return saved
    },
    [saveScript, characters],
  )

  const keep = useCallback(
    async (script: CustomScript) => {
      const saved: SavedScript = { id: mintScriptId(), script, updatedAt: Date.now() }
      await saveScript(saved)
      return saved
    },
    [saveScript],
  )

  const importFile = useCallback(
    async (text: string) => {
      const read = importText(text)
      if ('errors' in read) return read
      return { saved: await keep(read.script) }
    },
    [keep],
  )

  const characterRows = useMemo(() => {
    const teamWord = teamWords(t)
    const carriedBy = (id: string) => store.scripts.filter((s) => s.script.items.some((item) => typeof item !== 'string' && item.id === id)).length
    return [...characters]
      .sort((a, b) => sheetTeams.indexOf(a.character.team) - sheetTeams.indexOf(b.character.team) || a.character.name.localeCompare(b.character.name, locale))
      .map((saved): CharacterRow => ({ saved, name: saved.character.name, team: teamWord[saved.character.team], scripts: carriedBy(saved.character.id) }))
  }, [characters, store.scripts, t, locale])

  const exportFile = useCallback((saved: SavedScript) => downloadText(fileName(saved.script.name), serializeScript(saved.script)), [])

  return useMemo(
    () => ({ locale, t, editions: editionRows, custom, save, importFile, keep, remove: removeScript, exportFile, characters: characterRows, saveCharacter, removeCharacter }),
    [locale, t, editionRows, custom, save, importFile, keep, removeScript, exportFile, characterRows, saveCharacter, removeCharacter],
  )
}

// Every word the sheet prints that is not a character's own: the team bands, the count table's
// rows, the markers, the headings.
export interface SheetWords {
  readonly teams: TeamLabels
  readonly countRows: CountRowLabels
  readonly marker: (kind: NightMarker) => string
  readonly labels: ScriptSheetLabels
}

export const useSheetWords = (): SheetWords => {
  const t = useStore().t
  return useMemo(() => {
    return {
      teams: teamLabels(t),
      countRows: { townsfolk: t('scripts.townsfolk'), outsiders: t('scripts.outsiders'), minions: t('scripts.minions'), demon: t('scripts.demon') },
      marker: (kind) => t(`scripts.${kind}`),
      labels: sheetLabels(t),
    }
  }, [t])
}
