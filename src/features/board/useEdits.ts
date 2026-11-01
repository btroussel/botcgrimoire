// The board's edits bound to the store: the open board and log, the words in the locale, and one
// `append` for every edit on the board. The seat menu, the pickers and the corners read this;
// the pure module beside it decides what each row shows and what each tap appends.
import { useCallback, useMemo } from 'react'

import type { Locale, Team, Translate } from '../../content'
import { asCharacterId, gameText } from '../../content'
import type { Event, Grimoire, Payload } from '../../engine'
import { useStore } from '../../store'
import { teamLabels } from '../../store/scriptSheet'

export interface Edits {

  readonly locale: Locale
  readonly t: Translate
  readonly board?: Grimoire
  readonly log: readonly Event[]
  readonly lookingBack: boolean // every appending control is disabled while set
  readonly name: (id: string) => string // a character's name in the locale
  readonly ability: (id: string) => string
  readonly teamLabel: (team: Team) => string
  readonly append: (payload: Payload) => void
  readonly appendAll: (payloads: readonly Payload[]) => void
}

export const useEdits = (): Edits => {
  const store = useStore()
  const locale = store.settings.locale
  const t = store.t
  const text = useMemo(() => gameText(locale), [locale])
  const name = useCallback((id: string) => text.role(asCharacterId(id)).name, [text])
  const ability = useCallback((id: string) => text.role(asCharacterId(id)).ability, [text])
  const teams = useMemo(() => teamLabels(t), [t])
  const teamLabel = useCallback((team: Team) => teams[team], [teams])
  const board = store.board
  const log = store.session?.game.log
  const lookingBack = store.session?.lookingAt !== undefined
  const { append, appendAll } = store

  // One record, remade only when the board or the words move, so a sheet reading it does not
  // re-render on every store tick.
  return useMemo<Edits>(
    () => ({
      locale,
      t,
      ...(board ? { board } : {}),
      log: log ?? [],
      lookingBack,
      name,
      ability,
      teamLabel,
      append,
      appendAll,
    }),
    [locale, t, board, log, lookingBack, name, ability, teamLabel, append, appendAll],
  )
}
