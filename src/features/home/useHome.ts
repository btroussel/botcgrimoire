import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'

import { boardOf, useStore } from '../../store'
import { describeGame } from '../../store/gameSummary'
import { randomHomeCharacters } from './artwork'

export const useHome = () => {
  const { t, ready, games, settings, session, returnToPresent } = useStore()
  const router = useRouter()
  const [artwork, setArtwork] = useState<{ readonly characters: ReturnType<typeof randomHomeCharacters>; readonly visit: number }>()
  useFocusEffect(useCallback(() => {
    const characters = randomHomeCharacters()
    setArtwork(previous => ({ characters, visit: (previous?.visit ?? 0) + 1 }))
  }, []))
  // The game to resume is the most recently played one that has not ended. Games arrive newest
  // first, so the search usually stops at the first.
  const row = useMemo(() => {
    const game = games.find(game => boardOf({ game, redo: [] }).clock.phase !== 'over')
    return game ? describeGame(game, t, settings.locale) : undefined
  }, [games, t, settings.locale])
  // Every edit on the board behind Home hands this game a new row; the action changes only when
  // what it says does.
  const id = row?.id
  const detail = row && `${row.name} · ${row.phase}`
  const a11y = row?.a11y
  const current = useMemo(() => (id !== undefined && detail !== undefined && a11y !== undefined ? { id, detail, a11y } : undefined),
    [id, detail, a11y])
  // A device with no saved game is a first visit, often from a search: it is offered what the app is.
  const newcomer = games.length === 0
  const openId = session?.game.id
  // Stable handlers let the memoized buttons skip the renders an edit on the board causes.
  const resume = useCallback(() => {
    if (!current) return
    // A game left open in replay resumes at its present, as it does from History.
    if (openId === current.id) returnToPresent()
    router.push(`/game/${current.id}`)
  }, [current, openId, returnToPresent, router])
  const navigate = useMemo(() => ({
    newGame: () => router.push('/new'),
    openHistory: () => router.push('/history'),
    openScripts: () => router.push('/scripts'),
    openSettings: () => router.push('/settings'),
  }), [router])
  return { t, ready, artwork, current, newcomer, resume, ...navigate }
}
